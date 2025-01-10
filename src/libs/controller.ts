/**
 * Main Module Drives the start It is associated with the general settings of the config file.
 * 
 * Loading the main modules: MQTT, RfxcomBridge (RFXCOM), All RFX devices, All virtual devices
 * 
 * It monitors the topic avaibility of homeassistant in order to return all discovery messages
 * 
 * It monitors messages from RFXCombridge, in order to position the data when the device is not 
 * known in the RFX discovery panel if discovery is enabled, or to transmit the information to 
 * Home Assistant.
 * 
 * At the home assistant level, there are several configuration units, in appareils of MQTT
 * 1)  RFXCOMBRIDGE allows you to set the log level, add or remove RFX protocols to listen to
 * 2)  NewRfxDevice Create a new RFX device, either manually or by enabling discovery mode.
 * 3)  NewDioReceiver Create a new Dio receiver, with appaired rfx device for On/off or Cover
 * 
 * Other virtual devices can be added in the src/virtuals directory. You have to declare 
 * the elements in the file 'src/virtuals/settingsvirtual.ts'
 * 
 */
import {Settings, SettingDevice, read} from './settings';
import Mqtt from './Mqtt';
import Rfxcom, {IRfxcom} from './rfxcombridge';
import { RfxcomInfo,MQTTMessage, MqttEventListener } from './models';
import utils from './utils';
import { Logger } from './logger';
import { AbstractDevice } from './abstractdevice';
import { Devices } from './devices';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import YAML from 'yaml';
interface DataEvent {
    quoi: string;
    value: any;
}
const logger = new Logger(__filename);

export  const evenement : EventEmitter  = new EventEmitter();
export  interface ToEmit  {
    signal: string;
    value: any
}
export default class Controller implements MqttEventListener{
    private config : Settings;
    private devices : Devices;
    private rfxBridge : IRfxcom
    private mqttClient : Mqtt
    static ignoreDataName = [
        'seqnbr', 'subtype', 'id', 'unitCode', 'houseCode', 'commandNumber',
        'protocol', 'deviceName', 'subtypeValue', 'id_rfxcom', 'unique_id'
        ];
    private file: string;
    private indexElementaryTopic: number;
    private indexCommand: number;
    private topicMqtt2Subscribe: string;
    
    private exitCallback: (code: number, restart: boolean) => void;
  
    constructor(exitCallback: (code: number, restart: boolean) => void){
        this.exitCallback = exitCallback;
        
        this.file = process.env.RFXCOM2HASS_CONFIG ?? "/app/data/config.yml";
        this.config = read(this.file);
        logger.setLevel(this.config.loglevel);
        logger.info("file"+this.file)
        logger.info("configuration : "+JSON.stringify(this.config,null,2));
        //this.rfxBridge = this.config.mock ? new MockRfxcom(this.config.rfxcom) : new Rfxcom(this.config.rfxcom);
        this.devices = new Devices(this.config);
        this.rfxBridge =  new Rfxcom(this.config.rfxcom,this.devices);
        
        this.mqttClient = new Mqtt(this.config)
        this.mqttClient.addListener(this);
        let temp = this.config.homeassistant.topics.command
            .split('/')
        this.indexElementaryTopic = temp.indexOf('%device_unique_id%');
        this.indexCommand = temp.indexOf('%sensortype%');
        this.topicMqtt2Subscribe = AbstractDevice.getTopicCompleteName('command',this.config.homeassistant.discovery_bridge_unique_id,'toto',this.config.homeassistant)
    }

    async start(): Promise<void> {
        logger.info('Controller Starting');
        this.devices.start(this.mqttClient,this.rfxBridge);
       try {
            await this.rfxBridge.start();
        } catch (error: any) {
            logger.error('Failed to start Rfxcom');
            logger.error('Exiting...');
            logger.error(error.stack);
        }
        
         // MQTT
        try {
            await this.mqttClient.connect();
        } catch (error: any) {
            logger.error(`MQTT failed to connect, exiting...`);
            logger.error(error);
            logger.error(error.stack)
            await this.rfxBridge.stop();
            await this.exitCallback(1,false);
        }
        
        this.rfxBridge.subscribeProtocolsEvent((evt: any) => this.sendToMQTT(evt));

        // RFXCOM Status
        this.rfxBridge.onStatus((coordinatorInfo: RfxcomInfo) => {
            logger.info(`receive status from rfxcom`)
            coordinatorInfo.unique_id = this.config.homeassistant.discovery_bridge_unique_id
            coordinatorInfo.version = utils.getRfxcom2hassVersion();
            coordinatorInfo.logLevel = this.config.loglevel;
            coordinatorInfo.discovery = this.config.homeassistant.discovery;
            this.devices.setBridge(coordinatorInfo);
            this.topicMqtt2Subscribe = AbstractDevice.getTopicCompleteName('command',this.config.homeassistant.discovery_bridge_unique_id,'toto')
            .split('/')    
            .slice(0,this.indexElementaryTopic)
            .join('/')+"#";   

            this.__send2mqtt(coordinatorInfo)
        });
        
        // RFXCOM Disconnect
        this.rfxBridge.onDisconnect((evt: any) => {
            this.mqttClient.disconnect();
        });  

        this.scheduleHealthcheck()
        evenement.on('update',(data: DataEvent)=>{
            logger.info(`evenement on update : ${JSON.stringify(data)}`)
            switch (data.quoi) {
                case 'enabledProtocols':
                    this.config.rfxcom.enable_protocols = data.value 
                    this.writeConfig()
                    this.rfxBridge.enableRFXProtocols();
                    break;
            case 'loglevel':
                    this.config.rfxcom.debug = data.value === 'debug'? true : false
                    this.config.loglevel  = data.value
                    this.writeConfig()
                    break;
                default:
                break;
            }
        })
        logger.info('Started');
    }
    private writeConfig() {
        try {
            const valyaml = YAML.stringify(this.config);
            fs.writeFileSync(this.file, valyaml, 'utf8');
        } catch (error) {
            logger.error(`write config file ${this.file} failed , ${error}`)            
        }
    }
    async stop(restart = false): Promise<void> {
 //       await this.discovery.stop();
        await this.mqttClient.disconnect();
        await this.rfxBridge.stop();
        await this.exitCallback(0, restart);
    }
    
    private getIntervalFunction(): any {
        let rfxBridge = this.rfxBridge;
        let mqttClient = this.mqttClient;
        let stop = this.stop
        let intervalFunction = function ()  {
            rfxBridge.getStatus((status: string) => {
                mqttClient.publishState(status);
                if (status === 'offline') {
                    stop();
                } 
            })
        }
        return intervalFunction;
    }

    scheduleHealthcheck(){
        let func: any = this.getIntervalFunction();
        setTimeout(func,2000);
        let delay = this.config.healthcheckminutesfrequency
        setInterval(func,(this.config.healthcheckminutesfrequency || 5)*60000)
    }

   
    subscribeTopic(): string[]{
        return [AbstractDevice.getTopicCompleteName('ecoute',this.config.homeassistant.discovery_bridge_unique_id),
            AbstractDevice.getTopicCompleteName('homeassistant_availability','')];
    }
    // home assistant avaibility
    private avaibilityHomeAssistant(data: MQTTMessage) {
        if(data.message === 'online') {
            this.devices.startPublishDiscovery();
        } else {
            this.devices.stopPublishDiscovery();
        }
    }

    onMQTTMessage(data: MQTTMessage) {
        if(AbstractDevice.getTopicCompleteName('homeassistant_availability','') ==data.topic) {
            this.avaibilityHomeAssistant(data)
            return;
        }
        let topicSplit = data.topic.split('/')
        let elementaryTopic = topicSplit[this.indexElementaryTopic];
        data.topic = elementaryTopic
        data.command = topicSplit[this.indexCommand];
        if(!data.command || data.command === 'state' ) {
            return;
        }
        logger.debug(`controller on mqtt ${JSON.stringify(data)}`)
        evenement.emit('MQTT:'+elementaryTopic, data)
    }
    sendToMQTT(evt: any) {
        logger.info("receive from rfxcom : "+JSON.stringify(evt));
        // inform virtual device from appaired device or equivalent
        evenement.emit('RFX:'+evt.unique_id, evt);
        let device = this.devices.setDeviceFromEvent(evt);
        if (! device ) {
            return;
        }
        this.__send2mqtt(evt);
    }
    private __send2mqtt(evt: any) { 
        const topicName = AbstractDevice.getTopicCompleteName('state',evt.unique_id);
        const json = JSON.stringify(evt, 
            (k: any, v: any) =>  Controller.ignoreDataName.includes(k)?undefined:v, 2);
 
        this.mqttClient.publish(topicName, json, 
            (error: any) => {
                if(error) { 
                    logger.error(`erreur à l'envoi de ${topicName}, ${error}`)
                }
            });
      
    };

}
