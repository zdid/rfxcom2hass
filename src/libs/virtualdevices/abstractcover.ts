import { throws } from "assert";
import { AbstractDevice } from "../abstractdevice";
import { IRfxcom } from "../rfxcombridge";
import { SettingHass } from "../settings";
import Mqtt from "../Mqtt";
import { VirtualDevice } from "./virtualdevice";
import { SettingCover, SettingVirtualDevice } from "./settingsvirtual";
import Devices from "../devices";

/**
 * cover abstract class
 * use for rfy and dio device
 * @author Didier  
 */
const datanames =  [ 'cover' ] ;
  
const STATE = {
  OPEN: 'open',
  CLOSED: 'closed',
  CLOSING: 'closing',
  OPENING: 'opening',
  STOPPED: 'stopped'
}

export class AbstractCover extends VirtualDevice {
  positionPercent : number;
  openDuration: number;
  closeDuration: number;
  stateCover: string;
  stopTimeout: any;
  startmovement: number;
  movementTimeout: any;
  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, devices: Devices, virtualDevice: SettingCover){
    super(mqtt, rfxtrx, config, devices, virtualDevice);
    this.positionPercent = 0;
    this.openDuration = virtualDevice.openduration * 1000;
    this.closeDuration = virtualDevice.closeduration *1000;
    this.stateCover = STATE.CLOSED
    this.stopTimeout = undefined;
    this.startmovement =0;
    this.movementTimeout = undefined;
    this.virtualDevice = 
  }
  /**
   * receive mqtt command opencover
   * @returns 
   */
  opencover() {
    if(this.stateCover===STATE.OPENING) {
      this.stopcover();
      return;
    }
    this._coverSend('a') ;
  }
  /**
    * reveice a mqtt command closecover
    * @returns 
    */
  closecover() {
    if(this.stateCover===STATE.CLOSING) {
      this.stopcover();
      return;
    }
    this._coverSend("d") ;
  }
  /**
   * send mqtt message for cover 
   */
  _sendCoverState() {
    let envoi = { position: this.positionPercent, state: this.stateCover}
    super.publishState(AbstractDevice.getTopicCompleteName('state',this.virtualDevice.unique_id,
    'cover',this.config), JSON.stringify(envoi))
  }
    
  _coverSend(sens: string) { // a: ascending d: descending
    this.stateCover = (sens==='a'?STATE.OPENING: STATE.CLOSING );
    let duration = (100-this.positionPercent)*(sens=== 'a'?this.openDuration:this.closeDuration)
    this.startmovement = Date.now()-duration;
    this.movementTimeout = setTimeout(()=>{
      this.stateCover = sens === 'a' ? STATE.OPEN : STATE.CLOSED;
      this.movementTimeout = undefined;
      this._sendCoverState();
    },duration);
    this.__realCoverSend(sens); // 'a: ascending' d: descending s: stop'
    this._sendCoverState();
  }
  __realCoverSend(sens: string) { // 'a: ascending' d: descending s: stop'
      throw new Error("need implements the __realCoverSend method");
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
    if( this.stateCover === STATE.STOPPED ||
      this.stateCover === STATE.OPEN || 
      this.stateCover === STATE.CLOSED)  {
      return;
    }
    if(this.movementTimeout){
      clearTimeout(this.movementTimeout)
      this.movementTimeout = undefined
    }
    let duration = Date.now() - this.startmovement ;
    if(this.stateCover === STATE.OPENING) {
      this.positionPercent = Math.round(duration*100/this.openDuration)
      this._coverSend('a'); // 2eme appuie sur open 
    }
    if(this.stateCover === STATE.CLOSING) {
      this.positionPercent = Math.round(duration*100/this.closeDuration)
      this._coverSend('d'); // 2eme appuie sur open
    }
    this.stateCover= STATE.STOPPED;
    this._sendCoverState();
  }
      
  /**
   * calculation of the time to go up or down according 
   * to the current position. 
   * stops the ascent or descent according to the calculated time 
   * @param value percent position
   */
  setpositioncover(value: number) : void{
    let duration = value - this.positionPercent;
    if(duration > 0) {
      this._coverSend('a');
    } else  if (duration < 0) {
      this._coverSend('d');
    } else {
      return;
    }
    let durationtime = (duration>0?this.openDuration:this.closeDuration)*duration*10; ///100*1000
    this.stopTimeout = setTimeout(()=>{
      this.stopTimeout = undefined;
      this.stopcover();        
    },durationtime);
  }
}
