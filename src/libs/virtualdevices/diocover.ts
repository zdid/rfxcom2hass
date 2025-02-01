/**
 * Dio cover receiver 
 */

import Devices from "../devices";
import Mqtt from "../Mqtt";
import { IRfxcom } from "../rfxcombridge";
import { SettingHass } from "../settings";
import { AbstractCover } from "./abstractcover";
import { SettingCover } from "./settingsvirtual";

const ON = 'On'
const OFF = 'Off'
const ASCENDING = 'a'
const DESCENDING = 'd'

export class DioCover  extends AbstractCover {
  lastsens: string;

  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, devices: Devices, virtualDevice: SettingCover){
    super(mqtt, rfxtrx, config , devices, virtualDevice);
    this.lastsens = ASCENDING 
  }
  async __realCoverSend(sens: string) { // 'a: ascending' d: descending s: stop'
    if(sens === 's') { //stop
        await this.devices.execute(this.getRefAppairedDevice(),"switch"+(this.lastsens===ASCENDING?ON:OFF),null,()=>{});
        this.lastsens = sens;
    } else {
        await this.devices.execute(this.getRefAppairedDevice(),"switch"+(sens===ASCENDING?ON:OFF),null,()=>{});
        this.lastsens = sens===ASCENDING?ON:OFF;
    }
  }
}