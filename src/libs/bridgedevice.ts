'use strict';

//var rfxcom  = require('rfxcom');
import { IRfxcom } from './rfxcombridge';
import { SettingHass } from './settings';
import Mqtt from './Mqtt';
import { DeviceBridge,RfxcomInfo,MQTTMessage } from './models';
import utils from './utils';
import { AbstractDevice } from './abstractdevice';
import { Logger } from './logger';
import { evenement, ToEmit } from './controller';

const logger = new Logger(__filename);

export class BridgeDevice extends AbstractDevice{
  private sensorsDiscovery: { [s:string]: any } = {};
  private device_id: string;

  private deviceBridge?: DeviceBridge;
  static  dataNames = ['receiverType', 'hardwareVersion', 'version', 'firmwareVersion', 
    'firmwareType',  'enabledProtocols', 'transmitterPower', 'logLevel',
    'addprotocol','subtractprotocol'];
  private haveReceiveRfxconInfo: boolean = false;
  private lastRfxcominfo?: RfxcomInfo;

  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass){
    super(mqtt, rfxtrx, config);
    this.device_id = this.config.discovery_bridge_unique_id;
  }

  
  onMQTTMessage(data: MQTTMessage){
     switch (data.command?.toLowerCase() ) {
      case 'setloglevel':
        this.setLoglevel(data.message)
        break;

      case 'addprotocol':
          this.addprotocol(data.message)
          break;
      case 'subtractprotocol':
          this.subtractprotocol(data.message)
          break;
      default:
        logger.error(`Reception dun message non reconnu ${data.topic} ${(data.message)}`)
        break;
    }   
  }

  protected onNewComponent(componentName: string, component: any) {
    let enabl: any = this.lastRfxcominfo?.enabledProtocols
    logger.info(`on ne component : ${ JSON.stringify(enabl)}`)
    switch (componentName) {
      case  'enabledProtocol':
        enabl.join(', ')  
      break;
      case 'addprotocol':
        component.options = this.rfxtrx.getAllProtocols()
          .filter( (protocol: string )=> ! enabl.includes(protocol))
        break;
      case 'subtractprotocol':
        component.options = this.lastRfxcominfo?.enabledProtocols
        break;
      case 'enabledprotocol':
        component.value_template = this.lastRfxcominfo?.enabledProtocols.join('\n')
      default:
        break;
    }
    logger.info(`onnewcomponent : ${JSON.stringify(component)} ${JSON.stringify(this.rfxtrx.getAllProtocols())}`)
    return component;
  }
  
  private setLoglevel(level: string) {
    evenement.emit('update', { quoi: 'loglevel', value: level}) 
  }
  private addprotocol(proto: any) {
    logger.info('_addprotocol '+proto);
    this.lastRfxcominfo?.enabledProtocols.push(proto) 
    this.lastRfxcominfo?.enabledProtocols.sort()
    evenement.emit('update', { quoi: 'enabledProtocols', value: this.lastRfxcominfo?.enabledProtocols}) 
    this.sendData()
   } 
  private subtractprotocol(proto: any) {
    logger.info('_subtractprotocol ' + proto);
    if(this.lastRfxcominfo){
      this.lastRfxcominfo.enabledProtocols = this.lastRfxcominfo?.enabledProtocols.filter((pr)=> pr!=proto) 
      this.lastRfxcominfo.enabledProtocols.sort() 
    } else {
      logger.error('error assignment lastRfxCominfo is undefined')
    }
    evenement.emit('update', { quoi: 'enabledProtocols', value: this.lastRfxcominfo?.enabledProtocols}) 
    this.sendData()
  } 
  

  publishAllDiscovery() {
    logger.info(`publishAllDiscovery ${Object.keys(this.sensorsDiscovery).length}`)
    super.publishDiscoveryAll('bridge',BridgeDevice.dataNames,this.config.discovery_bridge_unique_id,'Rfxcom bridge','','Rfxcom Bridge')
  }


  set(rfxcomInfo: RfxcomInfo) {
    if( ! this.deviceBridge) {
        this.deviceBridge = new DeviceBridge(
            ['rfxcom2hass_'+this.device_id],
            `${rfxcomInfo.hardwareVersion} ${rfxcomInfo.firmwareVersion}`,
            AbstractDevice.getDiscoveryOrigin().sw,
          );
    }
    this.lastRfxcominfo = rfxcomInfo;
    logger.info(`set ${JSON.stringify(rfxcomInfo)}`)
    rfxcomInfo.enabledProtocols = (rfxcomInfo.enabledProtocols || []).filter((proto: string) => proto != undefined);
    logger.info(`set rfxcom: enabledProtocols ${rfxcomInfo.enabledProtocols}`)
    this.haveReceiveRfxconInfo = true;
  }
  isReady() : boolean {
    return this.haveReceiveRfxconInfo
  }
  waitReady() {
    let interval: any;
    return new Promise((resolve,reject) => {
        interval = setInterval(() => {
            if(this.isReady()) {
                clearInterval(interval)   
                logger.info(`rfxcom is ready a waitReady resolve`) 
                resolve(true)
            }
        }, 1000);
    })
  }
  sendData() {
    this.rfxtrx.getStatus(()=>{});
    this.publishAllDiscovery();
  }
}
