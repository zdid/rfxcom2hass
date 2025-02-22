
import * as mqtt from 'mqtt';

import {  IClientOptions }  from 'mqtt';
import fs from 'fs';
import { SettingConfig, SettingMqtt } from './settings';
import { AbstractDevice } from './abstractdevice';
import { Logger } from './logger';


const logger = new Logger(__filename)

declare type QoS = 0 | 1 | 2

interface MQTTOptions {qos?: QoS, retain?: boolean}

export interface MqttEventListener{
  subscribeTopic(): string[];
  onMQTTMessage(data: MQTTMessage): void;
}

export interface MQTTMessage{
  topic: string,
  message: any,
  command: string
}


export default class Mqtt{
    private defaultOptions: any;
    private client?: mqtt.MqttClient;
    private config : SettingConfig; 
    private mqttSettings: SettingMqtt;
    private listeners: MqttEventListener[] = [];
  
    constructor(config: SettingConfig) {
        this.config = config;
        this.mqttSettings = config.mqtt;
    }

    addListener(listener: MqttEventListener){
      this.listeners.push(listener);
    }

    async connect(): Promise<void> {
      let port = '1883';
      if (this.mqttSettings.port) {
        port = this.mqttSettings.port;
      }
  
      let qos = 0 as QoS;
      if (this.mqttSettings.qos) {
        qos = this.mqttSettings.qos as QoS;
      }

      this.defaultOptions = {qos: qos, retain: this.mqttSettings.retain }
      logger.info(`Connecting to MQTT server at ${this.mqttSettings.server}`);
      const will = {'topic': AbstractDevice.getTopicCompleteName('will','','',this.config.homeassistant),
           'payload': Buffer.from('offline'), 
           'qos': 1 as QoS,
           'retain': true};
      const options : IClientOptions = {'username':undefined, 'password':undefined, 'will': will};
      if (this.mqttSettings.username) {
        options.username = this.mqttSettings.username;
        options.password = this.mqttSettings.password;
      } else {
        logger.info(`Using MQTT anonymous login`);
      }

      if (this.mqttSettings.version) {
        options.protocolVersion = this.mqttSettings.version;
      }

      if (this.mqttSettings.keepalive) {
        logger.info(`Using MQTT keepalive: ${this.mqttSettings.keepalive}`);
          options.keepalive = this.mqttSettings.keepalive;
      }

      if (this.mqttSettings.ca) {
        logger.info(`MQTT SSL/TLS: Path to CA certificate = ${this.mqttSettings.ca}`);
          options.ca = fs.readFileSync(this.mqttSettings.ca);
      }

      if (this.mqttSettings.key && this.mqttSettings.cert) {
        logger.info(`MQTT SSL/TLS: Path to client key = ${this.mqttSettings.key}`);
        logger.info(`MQTT SSL/TLS: Path to client certificate = ${this.mqttSettings.cert}`);
          options.key = fs.readFileSync(this.mqttSettings.key);
          options.cert = fs.readFileSync(this.mqttSettings.cert);
      }
  
      if (this.mqttSettings.client_id) {
        logger.info(`Using MQTT client ID: '${this.mqttSettings.client_id}'`);
        options.clientId = this.mqttSettings.client_id;
      }

      return new Promise((resolve, reject) => {
        this.client = mqtt.connect(this.mqttSettings.server + ':' + port, options);
  
        // MQTT Connect
        this.onConnect(async () => {
          logger.info('Connected to MQTT');
          this.listeners.forEach( listener => {
             this.subscribe(listener.subscribeTopic());
           });
          this.publishState('online');
          this.onMessage();
          resolve();
        });

        this.client.on('error', (err: any) => {
          logger.error(err);
          logger.error(JSON.stringify(will))
          reject(err);
        });

      });
    }
  
    private onMessage(): void {
      this.client?.on('message', (topic: string, message: any) => {
        if(topic.endsWith('/state')) return;        
        this.listeners.forEach( listener => {
          if(listener.subscribeTopic().find(e => topic.includes(e.replace('#','')))){
            setImmediate(()=>
              listener.onMQTTMessage({topic: topic,message: message.toString()} as MQTTMessage)
            )
          }
        });
      });
    }
  
    private onConnect(callback: any): void {
      this.client?.on('connect', callback);
    }
  
    private subscribe(topics: any): void {
      this.client?.subscribe(topics, () => {
        logger.info(`Subscribing to topics '${topics}'`);
      });
    }
  
    publish(topic: string, payload: any, callback: any,options: MQTTOptions={}): void {
      const actualOptions: mqtt.IClientPublishOptions = {...this.defaultOptions, ...options};
      let temp = payload;
      if(typeof payload === 'object') {
        const marge = this.mqttSettings.format_json?2:0;
        if (marge) {
          temp = JSON.stringify(payload, undefined, marge)
        } else {
          temp = JSON.stringify(payload);
        }
      }
      this.client?.publish(topic, temp, actualOptions, (error: any) => {
        if (error) {
          logger.error(error);
        }
        callback(error)
      });
    }

    publishState(state :string) {
      this.publish(AbstractDevice.getTopicCompleteName('will',''), state,(error: any) => {}, {retain: true, qos: 0});
    }
  
    isConnected(): boolean {
      return this.client !== undefined && !this.client?.reconnecting;
    }

    disconnect(){
      this.publishState('offline');
      logger.info('Disconnecting from MQTT server');
      this.client?.end();
    }
    stop() {
      this.disconnect();
    }
  }