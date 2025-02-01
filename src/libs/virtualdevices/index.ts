import Devices from "../devices";
import Mqtt from "../Mqtt";
import { IRfxcom } from "../rfxcombridge";
import { SettingHass, SettingMinDevice } from "../settings";
import { DioReceiver } from "./dioreceiver";
import { VirtualDevice } from "./virtualdevice";

import { NewDioReceiverDevice } from "./newdioreceiver";
import {Logger} from "../logger";
import { SettingCover, SettingDioReceiver, SettingVirtualDevice } from "./settingsvirtual";
import { DioCover } from "./diocover";
import { SomfyCover } from "./somfycover";

var logger = new Logger(__filename)

/**
 * Creation of additional HomeAssistant config panels for setting up virtual devices
 * Each component must have a different protocol
 * @param mqtt 
 * @param irfxcom 
 * @param config 
 * @param devices 
 * @returns list of news panels homeassistant
 */
export function getListOfNewsParameters(mqtt: Mqtt, irfxcom: IRfxcom,config: SettingHass,devices: Devices) : any {
    return [
        new NewDioReceiverDevice(mqtt, irfxcom,config,devices)
    ]
}

/**
 * Creating a Virtual Device: Uses the setting protocol to create the expected device
 * @param mqtt 
 * @param irfxcom 
 * @param config 
 * @param devices 
 * @param dev 
 * @returns virtual device
 */
export function getNewVirtualDeviceFrom(mqtt: Mqtt, irfxcom: IRfxcom,config: SettingHass,devices: Devices,dev:SettingVirtualDevice): VirtualDevice {
    let retour: any;
    switch (dev.protocol) {
        case 'DioReceiver':
            retour =  new DioReceiver(mqtt, irfxcom,config,devices,dev as SettingDioReceiver)
            break;
            case 'DioCover':
                retour =  new DioCover(mqtt, irfxcom,config,devices,dev as SettingCover)
            break;
            case 'SomfyCover':
                retour =  new SomfyCover(mqtt, irfxcom,config,devices,dev as SettingCover)
            break;
            case 'SomfyDioCover':
                retour =  new SomfyDioCover(mqtt, irfxcom,config,devices,dev as SettingCover)
            break;
                       
        default:
            logger.error('getNewVirtualDeviceFrom : protocol not found ' + dev.protocol);
            break;
    }
    return retour as VirtualDevice;
}