import { AbstractDevice } from "../abstractdevice";
import { Devices } from "../devices";
import { Logger } from "../logger";
import Mqtt from "../Mqtt";
import { IRfxcom } from "../rfxcombridge";
import { SettingHass} from "../settings";
import { onEvenement } from "../utils";
import { SettingVirtualDevice } from "./settingsvirtual";

var logger = new Logger(__filename);

export class VirtualDevice extends AbstractDevice {
    protected virtualDevice: SettingVirtualDevice;
    protected devices: Devices;
    protected state: any;
    protected level: any;
    protected topicState: string;
     

    
    constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, devices: Devices, virtualDevice: SettingVirtualDevice){
        super(mqtt, rfxtrx, config);
        this.virtualDevice = virtualDevice;
        this.devices = devices;
        if(logger.isDebug())logger.debug(`deviceDiscovery new device ${JSON.stringify(this.virtualDevice)}`)
        this.topicState = AbstractDevice.getTopicCompleteName("state",this.virtualDevice.unique_id) 
        if(! Array.isArray( this.virtualDevice.appaired)) {
            this.virtualDevice.appaired = [];
        }
        for (const unique_id_device of this.virtualDevice.appaired) {
            this.receiveEventForDelete.push(onEvenement('RFX:'+unique_id_device, this, 'onRFXMessage'));
            this.receiveEventForDelete.push(onEvenement('MQTT:'+unique_id_device, this,  'onMQTTMessage'));
        }

    }
    onRFXMessage(evt: any) {
        throw new Error("this method could be overload, no treatment for device"+JSON.stringify(evt));
    };
    onMQTTMessage(evt: any) {
        throw new Error("this method could be overload, no treatment for device"+JSON.stringify(evt));
    };
    getRefAppairedDevice() : any {
        return this.virtualDevice.ref_appaired;
    }
    get() {
        return this.virtualDevice;
    }
    publishAllDiscovery(): void {
        super.publishDiscoveryAll('device',this.virtualDevice.sensors_types,this.virtualDevice.unique_id,
            this.virtualDevice.name||'',this.virtualDevice.protocol,this.virtualDevice.suggested_area)
    }
    
}