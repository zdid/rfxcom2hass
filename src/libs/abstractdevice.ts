'use strict';

var rfxcom  = require('rfxcom');
import {IRfxcom} from './rfxcombridge';
import { SettingHass,  SettingMinDevice} from './settings';
import Mqtt from './Mqtt';
import { DeviceEntity, MQTTMessage,MqttEventListener } from './models';
import utils, { onEvenement  } from './utils';
import {Logger} from './logger';
import { Components } from './components';
import { evenement } from './controller';
import { throws } from 'assert';
const logger = new Logger(__filename);

/**
 * 
 */
export class AbstractDevice   { //implements MqttEventListener{

  protected mqtt: Mqtt;
  protected rfxtrx: IRfxcom;
  protected config : SettingHass;
  protected topics2Subscribe : string[];
  private   static discoveryOrigin: any;
  private json2delete: any;
  private fordelete_unique_id : string;
  protected lastStatus: any;
  static mqtt: any;
  static config: SettingHass ;
  protected isFirstTime : boolean;
  protected receiveEventForDelete: any[]; //( data: any) => void;
  //protected receiveEventMqtt?: ( data: any) => void;
  
  
  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass){
    this.mqtt = mqtt;
    this.rfxtrx = rfxtrx;
    this.topics2Subscribe = [];
    this.isFirstTime = true;
    this.fordelete_unique_id ='';
    this.config = config;//.homeassistant;
    this.receiveEventForDelete = [];
    if( !AbstractDevice.mqtt) {
        AbstractDevice.mqtt = mqtt;
    }
    if( !AbstractDevice.config) {
        AbstractDevice.config = config;
    }
  }
  
   
  

  static getDiscoveryOrigin() {
    if (! this.discoveryOrigin) {
        this.discoveryOrigin=  {
        name: 'Rfxcom bridge', 
        sw: utils.getRfxcom2hassVersion(), 
        //url: 'https://zdid.github.io/rfxcom2hass/'
        };
    }
    return this.discoveryOrigin;
  }

  
  static getTopicCompleteName(name: string, unique_id : string,sensortype: string='', config?: SettingHass) : string {
    if(config) {
      AbstractDevice.config = config;
    }
    let  model: string = AbstractDevice.config.topics[name];
    if (!model){
        logger.warn('No topic model for '+name+' in config');
        return '';
    }
    
    model = model.replaceAll('%discovery_bridge_unique_id%',AbstractDevice.config.discovery_bridge_unique_id)
            .replaceAll('%device_unique_id%', unique_id)
            .replaceAll('%base_topic%',AbstractDevice.config.base_topic)
            .replaceAll('%sensortype%',sensortype);
    
    return model;
  }

 


  protected onNewComponent(componentName: string, component: any) {
    return component;
  }
 
  public publishDeleteDevice() {
    /**
     * en deux temps 
     * 1) suppress des sensors
     * 2) suppress de l'appareil 2 secondes après
     */
      this.publishDiscovery(AbstractDevice.getTopicCompleteName('discovery',this.fordelete_unique_id),
        this.json2delete)
      for( let functio of this.receiveEventForDelete) {
        evenement.removeListener('RFX:'+this.fordelete_unique_id,functio);
      }
      setTimeout(()=>{
        this.publishDiscovery(AbstractDevice.getTopicCompleteName('discovery',this.fordelete_unique_id),null)
      },2000)
  }


 
  protected publishDiscoveryAll(typeDevice:string, datanames: string [], unique_id: string, deviceName : string , protocol: string,suggested_area?: string) {
    this.fordelete_unique_id = unique_id; 
    let topics = {
      state : AbstractDevice.getTopicCompleteName('state',unique_id),
      will: AbstractDevice.getTopicCompleteName('will',unique_id),
      discovery: AbstractDevice.getTopicCompleteName('discovery',unique_id),
    }
    
     const json = {
      availability: [
        {
          "topic": AbstractDevice.getTopicCompleteName('will','')
        }
      ],
      origin: AbstractDevice.getDiscoveryOrigin(),
      availability_mode: "all",
      device: {
        identifiers: unique_id,
        name : deviceName,
        manufacturer : "RfxCom",
        model : protocol,
        sw: '1.0',
        sn: unique_id,
        hw: '1.0',
        suggested_area: suggested_area
      },
      state_topic : topics.state,
      components : {}
     }
     this.json2delete = JSON.parse(JSON.stringify(json));
     let components: {[key:string]:string} = {}
     for(const componentName of datanames) {
      let component = Components.get(typeDevice,componentName)
      if(component === undefined ) {
        continue;
      }
      component['unique_id']=unique_id+'_'+componentName
      component.value_template = component.value_template || `{{ valuejson.${componentName} }}` 
      if(! component.name) {
        component.name = componentName
      }
      for(let dataname in component) {
       if(dataname.includes('topic')) {
         component[dataname] = AbstractDevice.getTopicCompleteName('command',unique_id,component[dataname]);
       }
      }
      component = this.onNewComponent(componentName, component);
      components[unique_id+'_'+componentName] = component;
      this.json2delete.components[unique_id+'_'+componentName]= {platform:component.platform}
     }
     json.components = components;
     if(this.isFirstTime) {
      this.receiveEventForDelete.push(onEvenement('RFX:'+unique_id, this, 'onRFXMessage'));
      this.receiveEventForDelete.push(onEvenement('MQTT:'+unique_id, this,  'onMQTTMessage'));
     }
     this.isFirstTime= false;
     this.publishDiscovery(topics.discovery,json)
  }  

  onRFXMessage(evt: any) {
    this.lastStatus = evt;
  }
  onMQTTMessage(data: MQTTMessage) {
    throw new Error(`no treatment defined for mqtt message: ${JSON.stringify(data)}` );
    
  }

  publishAllDiscovery() {
    throw new Error('publishAllDiscovery: Implement this Medhod');
    
  }
  
  publishDiscovery(topic : string, payload: any) {
    this.mqtt.publish(topic, payload,  (error: any) => {},{retain: true, qos: 1}); //,this.config.discovery_topic);
  }

  execute(commandName: string,parms  : any, callback: any) {
    throw new Error('Method not implemented.');
  }
  publishState(topic : string, payload: any) {
     this.mqtt.publish(topic, payload,  (error: any) => {},{retain: true, qos: 1}); //,this.config.discovery_topic);
   }
}

