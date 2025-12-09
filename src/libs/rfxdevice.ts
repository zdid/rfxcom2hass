'use strict';

var rfxcom  = require('rfxcom');
import Rfxcom, {IRfxcom} from './rfxcombridge';
import {SettingHass, SettingDevice} from './settings';
import Mqtt from './Mqtt';
import { MQTTMessage } from './models';
import {AbstractDevice} from './abstractdevice';
import { Logger } from './logger';

const logger = new Logger(__filename)

// interface Complement {
//   icon?: string,
//   entity_category?: string,
//   enabled_by_default?: boolean,
//   payload_off? : string,
//   payload_on? : string,
//   state_off? : string,
//   state_on? : string,
//   value_template?: String, 
//   device_class?: string,
//   state_class?: string,
//   unit_of_measurement?: string,
//   name?: string,
//   commands?: string[]
// }


// interface ComplementsByDataname {
//   [s: string]:  Complement ;
// };

export class RfxDevice extends AbstractDevice  {
  protected device: SettingDevice;
  //static parms: ComplementsByDataname;
 
  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, device: SettingDevice){
    super(mqtt, rfxtrx, config);
    this.device = device;
    this.device.commands = Rfxcom.getFunctionsForProtocol(this.device.protocol);
    this.device.device_name = rfxtrx.getDeviceNames(this.device.protocol,this.device.subtype);
    //this.device.sensors_types = rfxtrx.get
        //correct sensors types according to commands 
    // it s bug originellly in newrfxdevice.ts
    if(this.device.commands 
      && this.device.commands.switchOn > -1 
      && this.device.commands.switchOff >-1) {
        this.device.sensors_types = 
            this.device.sensors_types
              .filter((value: string) => value != 'switch' && value != 'trigger_on' && value != 'trigger_off'
                   && !value.startsWith('blank'))
              .concat(["blank model=switch","blank model=trigger_on","blank model=trigger_off"]);  
              if(logger.isDebug())logger.debug(`rfxdevice constructor,  before add sensors types :  ${this.device.sensors_types}`);                
              if( ! this.device.as_trigger) {
                if(logger.isDebug())logger.debug(`rfxdevice constructor,  add switch sensor type `);
                this.device.sensors_types.push('switch')
              } else {
                if(logger.isDebug())logger.debug(`rfxdevice constructor,  add trigger_on and trigger_off sensor types `);
                this.device.sensors_types = this.device.sensors_types.concat(['trigger_on','trigger_off']);
                if(logger.isDebug())logger.debug(`rfxdevice constructor,  after add trigger sensor types :  ${this.device.sensors_types}`);
              }
              if(logger.isDebug())logger.debug(`rfxdevice constructor,  after add sensors types :  ${this.device.sensors_types}`);
        }
    if(logger.isDebug())logger.debug(`rfxdevice constructor,  after correct sensors types :  ${this.device.sensors_types}`);
    // fin correct sensors types according to commands 
    // it s bug originellly in newrfxdevice.ts

    logger.info(`deviceDiscovery new device ${JSON.stringify(this.device)}`)
  }

  
  get() {
    return this.device;
  }

   

  publishAllDiscovery() {
    logger.info(`publishAllDiscovery,  ${this.device.name} , ${this.device.sensors_types}}`);
    if(logger.isDebug())logger.debug(`publishAllDiscovery,  device:  ${JSON.stringify(this.device)}`);

  
    super.publishDiscoveryAll('device',
      this.device.sensors_types,
      this.device.unique_id,
      this.device.name||'',
      this.device.protocol, 
      this.device.suggested_area)
  }  
  subscribeTopic(): string[]{
    return [AbstractDevice.getTopicCompleteName('command',this.device.unique_id)];
  }
   
  async onMQTTMessage(data: MQTTMessage){
    if(logger.isDebug())logger.debug(`onMQTTMessage : ${JSON.stringify(data)}`);
    if(data.command?.toLowerCase() === 'switch') {
      data.command = data.command?.toLowerCase() + data.message; 
      data.message = undefined;
    }
    let command : string | undefined= Object.keys(this.device.commands)
       .find((cmd: string) => cmd.toLowerCase()===data.command?.toLowerCase());
    if(logger.isDebug())logger.debug(`onMQTTMessage find: '${command}' '${data.command}'`)
    await this.execute(command as string,data.message,(error:any, d2:any,numseq:any)=>{
      if(logger.isDebug())logger.debug(`onMQTTMessage callback : error '${error}', d2 '${d2}', D3 '${numseq}'`)
    }) 
    
  }
 
  async execute (commandName: string, value: any, callback: Function ) {
    return new Promise((resolve, reject) => {
      this.rfxtrx.execute(this.device, commandName , value, (error: any, d2:any, numseq: any)=> {
          callback(error, d2, numseq);
          if(error) {
            reject(error)
          } else {
            resolve('ok');
          }
          }
        )
      } 
    )
  }
}