import Devices from "../devices";
import Mqtt from "../Mqtt";
import { IRfxcom } from "../rfxcombridge";
import { SettingHass, SettingMinDevice } from "../settings";
import { DioReceiver } from "./dioreceiver";
import { VirtualDevice } from "./virtualdevices";

import { NewDioReceiverDevice } from "./newdioreceiver";
import {Logger} from "../logger";
import { SettingDioReceiver, SettingVirtualDevice } from "./settingsvirtual";

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
    
        default:
            logger.error('getNewVirtualDeviceFrom : protocol not found ' + dev.protocol);
            break;
    }
    return retour as VirtualDevice;
}