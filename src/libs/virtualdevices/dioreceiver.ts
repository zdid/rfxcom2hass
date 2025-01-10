'use strict';

//var rfxcom  = require('rfxcom');
import {IRfxcom} from '../rfxcombridge';
import {SettingHass } from '../settings';
import Mqtt from '../Mqtt';
import { MQTTMessage } from '../models';
import * as utils from '../utils';
import { Devices} from '../devices';
import { Logger } from '../logger';
import { VirtualDevice } from './virtualdevices';
import { evenement } from '../controller';
import { SettingDioReceiver } from './settingsvirtual';
import { AbstractDevice } from '../abstractdevice';

const logger = new Logger(__filename)

const datanames = {
  onofflevel : ['switch', 'level', 'toogle'], 
  cover : [ 'cover' ]  //opencover', 'closecover', 'stopcover', 'positioncover', 'tooglecover']
  }

const STATE = {
  OPEN: 'open',
  CLOSED: 'closed',
  CLOSING: 'closing',
  OPENING: 'opening',
  STOPPED: 'stopped'
}

const ON = 'on'
const OFF = 'off' 

export class DioReceiver extends VirtualDevice{
  private positionpercent: number;
  private statecover: string;
  private durationopen: number;
  private durationclose: number;
  private startmovement: number;
  private movementTimeout: NodeJS.Timeout | undefined
  private stopTimeout:  NodeJS.Timeout | undefined;

/**
 * constructor DioReceiver create a virtual device dio
 * @param mqtt MQTT CLIENT
 * @param rfxtrx RfxComBridge
 * @param config homeassistant configuration
 * @param devices instance for  all devives 
 * @param receiver description setting for dio receiver
 */
  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, devices: Devices, receiver: SettingDioReceiver){
    super(mqtt, rfxtrx, config, devices, receiver);
    this.positionpercent = 0;
    this.startmovement = 0;
    this.statecover = 'closed';
    this.durationopen = receiver.openduration || 8000;
    this.durationclose = receiver.closeduration || 7500;
    if(receiver.is_cover) {
      this.virtualDevice.sensors_types = datanames.cover;

    } else {
      this.virtualDevice.sensors_types= ['switch'];
      if( receiver.is_variator ) {
        this.virtualDevice.sensors_types.push('level')
      }
    }
  }
  /**
   * 
   * @returns SettingDioReciver 
   */
  get(): SettingDioReceiver {
    return this.virtualDevice as SettingDioReceiver;
  }
  /**
   * send a mqtt state for on off level (not cover)
   */ 
  send() {
    let payload: any = {state:this.state,command: this.state, level:this.level};
    logger.debug(`publish to mqtt: ${this.topicState}, payload ${payload}`);
    this.publishState(this.topicState,payload)
  }
  /**
   * receive mqtt command opencover
   * @returns 
   */
  opencover() {
    if(this.statecover===STATE.OPENING) {
      this.stopcover();
      return;
    }
    this.coverSend('a') ;
  }
  /**
   * reveice a mqtt command closecover
   * @returns 
   */
  closecover() {
    if(this.statecover===STATE.CLOSING) {
      this.stopcover();
      return;
    }
    this.coverSend("d") ;
  }
  /**
   * send mqtt message for cover 
   */
  sendCoverState() {
    let envoi = { position: this.positionpercent, state: this.statecover}
    super.publishState(AbstractDevice.getTopicCompleteName('state',this.virtualDevice.unique_id,
      'cover',this.config), JSON.stringify(envoi))
  }

  coverSend(sens: string) { // a: ascending d: descending
    this.statecover = (sens==='a'?STATE.OPENING: STATE.CLOSING );
    let duration = (100-this.positionpercent)*(sens=== 'a'?this.durationopen:this.durationclose)
    this.startmovement = Date.now()-duration;

    this.movementTimeout = setTimeout(()=>{
      this.statecover = sens === 'a' ? STATE.OPEN : STATE.CLOSED;
      this.movementTimeout = undefined;
      this.sendCoverState();
    },duration);
  }
  /**
   * receive from mqtt a stopcover command
   * @returns 
   */
  stopcover() {
    if(this.stopTimeout) {
      clearTimeout( this.stopTimeout);
      this.stopTimeout = undefined;
    }
    if( this.statecover === STATE.STOPPED ||
      this.statecover === STATE.OPEN || 
      this.statecover === STATE.CLOSED)  {
      return;
    }
    if(this.movementTimeout){
      clearTimeout(this.movementTimeout)
      this.movementTimeout = undefined
    }
    let duration = Date.now() - this.startmovement ;
    if(this.statecover === STATE.OPENING) {
      this.positionpercent = Math.round(duration*100/this.durationopen)
      this.coverSend('a'); // 2eme appuie sur open 
    }
    if(this.statecover === STATE.CLOSING) {
      this.positionpercent = Math.round(duration*100/this.durationclose)
      this.coverSend('d'); // 2eme appuie sur open
    }
    this.statecover= STATE.STOPPED;
    this.sendCoverState();
  }
  
  /**
   * calculation of the time to go up or down according 
   * to the current position. 
   * stops the ascent or descent according to the calculated time 
   * @param value percent position
   */
  setpositioncover(value: number) : void{
    let duration = value - this.positionpercent;
    if(duration > 0) {
      this.coverSend('a');
    } else  if (duration < 0) {
      this.coverSend('d');
    } else {
      return;
    }
    let durationtime = (duration>0?this.durationopen:this.durationclose)*duration*10; ///100*1000
    this.stopTimeout = setTimeout(()=>{
      this.stopTimeout = undefined;
       this.stopcover();        
    },durationtime);
  }
  /**
   * Receiving an MQTT message, the topic is already cut and the data.command gives the request
   * @param data { topic command message }
   */
  async onMQTTMessage(data: MQTTMessage){
    logger.debug(`onMQTTMessage ${data.topic} ${data.command} ${data.message}`);
    let value = parseInt(data.message);
    switch (data.command) {
      case 'switch':
      case 'set':
        data.message = utils.capitalize(data.message.toLowerCase())
        await this.devices.execute(this.getRefAppairedDevice(),"switch"+data.message,null,()=>{});
        this.state = data.message;
       break;
      case "level":
      case "setlevel": 
        value = value / 15 * 100
        await this.devices.execute(this.getRefAppairedDevice(),"setLevel",value,()=>{});
        this.level = value;
        this.state = value == 0? OFF: ON
      break;
      // case 'toggleswitch':
      //   let temp : SettingDioReceiver = this.get() 
      //   this.state = this.state == ON ? OFF : ON;
      //   this.level = (this.state == ON && temp.is_variator) ? 15 : 0;
      //   await this.devices.execute(this.firstAppairedDevice,"switch"+this.state,null,()=>{});
      //   break;
      // case 'tooglecover':
      //   if(this.positionpercent< 50) {
      //     this.opencover();
      //   } else {
      //     this.closecover();
      //   }
      //   break;
      case 'opencover':
        this.opencover();
        break;
      case 'closecover':
        this.closecover();
        break;
      case 'stopcover':
        this.stopcover();
        break;
      case 'setpositioncover':
        this.setpositioncover(value);
        break;      

      default:
         logger.error(`dioreceiver: command not found: ${data.topic} ${data.message}`)
      break;
    }
    this.send();
  }


  /**
   * On an rfx device event
   * @param evt from rfxbridge
   */
  onRFXMessage(evt: any) {
    logger.debug(`onRFXMessage evt: ${JSON.stringify(evt)}`)
    if(!this.get().is_cover) { /** on off */
      this.level = evt.level;
      this.state = evt.command;
      this.send();
    } else { /** cover */
      if (evt.command === ON) { // descente
        this.opencover();
      } else { // OFF montée
        this.closecover();
      }
    } 
  }
}