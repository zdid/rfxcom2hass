import Devices from "../devices";
import Mqtt from "../Mqtt";
import { IRfxcom } from "../rfxcombridge";
import { SettingHass } from "../settings";
import { AbstractCover } from "./abstractcover";
import { SettingCover } from "./settingsvirtual";

export class SomfyCover  extends AbstractCover {
    constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, devices: Devices, virtualDevice: SettingCover){
    super(mqtt, rfxtrx, config , devices, virtualDevice);
  }
  async __realCoverSend(sens: string) { // 'a: ascending' d: descending s: stop'
    if(sens === 's') { //stop
        await this.devices.execute(this.getRefAppairedDevice(),"stop",null,()=>{});
    } else {
        await this.devices.execute(this.getRefAppairedDevice(),(sens=='a'?'up':'down'),null,()=>{});
    }
  }
}