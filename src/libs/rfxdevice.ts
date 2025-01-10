'use strict';

var rfxcom  = require('rfxcom');
import Rfxcom, {IRfxcom} from './rfxcombridge';
import {SettingHass, SettingDevice} from './settings';
import Mqtt from './Mqtt';
import { MQTTMessage } from './models';
import {AbstractDevice} from './abstractdevice';
import { Logger } from './logger';

const logger = new Logger(__filename)

interface Complement {
  icon?: string,
  entity_category?: string,
  enabled_by_default?: boolean,
  payload_off? : string,
  payload_on? : string,
  state_off? : string,
  state_on? : string,
  value_template?: String, 
  device_class?: string,
  state_class?: string,
  unit_of_measurement?: string,
  name?: string,
  commands?: string[]
}


interface ComplementsByDataname {
  [s: string]:  Complement ;
};

export class RfxDevice extends AbstractDevice  {
  protected device: SettingDevice;
  static parms: ComplementsByDataname;
 
  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, device: SettingDevice){
    super(mqtt, rfxtrx, config);
    this.device = device;
    this.device.commands = Rfxcom.getFunctionsForProtocol(this.device.protocol);
    this.device.device_name = rfxtrx.getDeviceNames(this.device.protocol,this.device.subtype);
    //this.device.sensors_types = rfxtrx.get
    logger.info(`deviceDiscovery new device ${JSON.stringify(this.device)}`)
  }

  
  get() {
    return this.device;
  }

   

  publishAllDiscovery() {
    logger.info(`publishAllDiscovery,  ${this.device.name}`)
    super.publishDiscoveryAll('device',this.device.sensors_types,this.device.unique_id,this.device.name||'',this.device.protocol, this.device.suggested_area)
  }  
  subscribeTopic(): string[]{
    return [AbstractDevice.getTopicCompleteName('command',this.device.unique_id)];
  }
   
  onMQTTMessage(data: MQTTMessage){
      logger.error(`no traitment for: ${data.topic} : ${JSON.stringify(data.message)}`)
  }
 
  async execute (commandName: string, value: any, callback: Function ) {
    return new Promise((resolve, reject) => {
      this.rfxtrx.execute(this.device, commandName , value, ()=> {
          callback();
          resolve('ok');
          }
        )
      } 
    )
  }
}