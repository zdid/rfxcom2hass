import { AbstractDevice } from "./abstractdevice";
//import { RfxDevice } from "./rfxdevice";
import { Logger } from "./logger";
import { MQTTMessage } from "./models";
import Mqtt from "./Mqtt";
import Rfxcom, { IRfxcom } from "./rfxcombridge";
import { SettingHass, SettingDevice } from "./settings";
import Devices from "./devices";
import { send } from "process";

const logger = new Logger(__filename,"debug")

interface SettingNew extends SettingDevice {
      options: string;
      exists_choice: string;
      discovery?: boolean;
      message?: string;
}


/**
 * create rfxcom device
 * mode  discovery is on/off on create interface panel (in home assistant) 
 * viewing ano in message on panel 
 */
export class NewRfxDevice  extends AbstractDevice {
    static dataNames = ['exists_choice',
        'discovery', 
        'subtypevalue', 
        'protocol',  
        'id_rfxcom',
        'name', 
        'as_trigger',
        'suggested_area',
        'options',
        'message',
        'clicvalid', 'clicdelete','clicclear'];
      
    private settingDevice: SettingNew ;
    private unique_id_of_new = 'NEWRFX-1'
    private topicState : string;
    private devices: Devices;
    static  vide : string = JSON.stringify({
        protocol: '',
        exists_choice: 'NEW',
        discovery: false,
        unique_id: '',
        device_id: '',
        name: '',
        as_trigger: false,
        device_name: [],
        id_rfxcom: '',
        subtype: 0,
        subtypeValue: '',
        repetitions: 1,
        sensors_types: [],
        commands : [],
        suggested_area: '',
        options:''
    } );

    /**
     * create rfxcom device instance 
     * 
     * @param mqtt mqtt client
     * @param rfxtrx RfxcomBridge 
     * @param config config home assistant from config file
     * @param devices all devices connus
     */

    constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, devices : Devices) {
        super(mqtt, rfxtrx, config )
        this.devices = devices;
        this.settingDevice = JSON.parse(NewRfxDevice.vide);
        this.topicState = AbstractDevice.getTopicCompleteName('state',this.unique_id_of_new)
        this.clearDevice();
    }
    /**
     * clear device (initial , after create device)
     */
    clearDevice() {
        this.settingDevice = JSON.parse(NewRfxDevice.vide);
        this.settingDevice.subtypeValue = 'NONE'
        this.sendData();
    }

    /**
     * set discovery on off from new frx device panel
     * @param val 
     */
    setDiscovery(val:any) {
        val = val === 'False' ? false: true
        this.config.discovery = this.settingDevice.discovery = val
        this.sendData();
    }
    /**
     * set packet name (from list)
     * @param packetName packetname is lighting2 ligthting1 blindts etc...
     */
    setPacketName(packetName: string) {
        this.settingDevice.protocol = packetName;
        if(this.settingDevice.protocol === 'lighting2') {
            if (! this.settingDevice.suggested_area) {
                this.settingDevice.suggested_area = 'Boutons';
            }
        }
    }

    /**
     * protocol subcommand choice from liste or discovery
     */
    setSubtypeValue(subtypeValue: string) {
        this.settingDevice.subtypeValue = subtypeValue;
        let temp = this.rfxtrx.getListPacketNamesForSubtypeValue(subtypeValue);
        if(temp.length ===1 || this.settingDevice.protocol === '') {
            this.settingDevice.protocol = temp[0];
        }
        this.sendData();
    }

    /**
     * generate id
     * @param rfxIdent is rfxcom ident for command or sensor 
     */
    setId_rfxcom(rfxIdent: string) {
        this.settingDevice.id_rfxcom = rfxIdent;
    }
    setOptions(options: string) {
        this.settingDevice.options =options;
    }
    /**
     * set name from panel (need)
     * @param name for device in yaml file 
     */
    setName(name: string) {
        this.settingDevice.name = this.capitalizeFirstLetter(name);
        // this.sendData();
    }
    /**
     * inform if device is use as trigger only
     * @param as_trigger 
     */
    setAs_trigger(val: any) {
        val = val === 'False' ? false: true
        this.settingDevice.as_trigger = val;
        this.sendData();
    } 
    capitalizeFirstLetter(val: any) {
        val = val.toLowerCase();
        return String(val).charAt(0).toUpperCase() + String(val).slice(1);
    }
    /**
     * suggested area is use in home assistant (need exist in home assistant)
     * @param suggested_area area, room
     */
    setSuggested_area(suggested_area: string) {
        this.settingDevice.suggested_area = this.capitalizeFirstLetter(suggested_area);
    }
    /**
     * validation clic on panel homeassistant
     * verif data 
     * send message
     * or write in yaml file and sent to homeassiatent as new device
     * @returns 
     */    
    setClicValid() {
        let anomalie: string = this.verifDevice();
        this.settingDevice.message = anomalie;
        if(anomalie) {
            this.sendData();
            return;
        }
        if(! anomalie) {
            this.createDevice();
            this.clearDevice();
            this.config.discovery = false;
        }
    }
    setClicDelete() {
        if(this.settingDevice.unique_id) {
            this.devices.deleteDevice(this.settingDevice.unique_id);
        }
        this.clearDevice();
    }
    setExistsChoice(rfxDeviceName: string) {
        this.clearDevice();
        if(rfxDeviceName !== 'NEW') {
          this.settingDevice = this.devices.getDeviceByAreaAndName(rfxDeviceName) as SettingNew;
          if(logger.isDebug())logger.debug(`lecture du device ${rfxDeviceName}   ${this.settingDevice}`)
        }
        this.settingDevice.exists_choice = this.settingDevice.name || 'NEW';
        this.settingDevice.discovery = false;
        
        this.config.discovery = false;
        this.settingDevice.message = '';
        this.sendData();
    }
    /**
     * recept data from home assistant panel 
     * one data
     * and set action  
     * @param data 
     */
    onMQTTMessage(data: MQTTMessage): void {
       if(logger.isDebug())logger.debug(`onMQTTMessage newrfx ${JSON.stringify(data)}`);
       this.settingDevice.message = '';
       switch (data.command) {
        case 'set_exists_choice':
            this.setExistsChoice(data.message);    
        break;

        case 'state':
            break;
        case 'setdiscovery':
            this.setDiscovery(data.message);
        break;
        case 'setclicvalid':
            this.setClicValid();
        break;
        case 'setclicdelete':
            this.setClicDelete();
        break;
        case 'setclicclear':
            this.clearDevice();
        break;
        case 'setsubtypevalue':
            this.setSubtypeValue(data.message)
        break;
        case 'setprotocol':
            this.setPacketName(data.message)
        break;
        case 'setid_rfxcom':
            this.setId_rfxcom(data.message)
        break;
        case 'setname':
            this.setName(data.message)
        break;
        case 'setas_trigger':
            this.setAs_trigger(data.message)
        break;
        case 'setsuggested_area':
            this.setSuggested_area(data.message)
            break;
        case 'setoptions':
            this.setOptions(data.message)
            break;
        default:
            logger.error(`onMQTTMessage: command ${data.command} not found`)
            break;
       }
    }
 
    /**
     * verif all data before add device 
     * @returns ano || ''
     */
    protected verifDevice() : string {
        let anomalie = '';
        if( ! this.settingDevice.name) {
            return 'no name for this device'
        }
        if( ! this.settingDevice.protocol) {
            return 'no packet name ex: elec3 or lighting1';
        }
        if( ! this.settingDevice.id_rfxcom ) {
            return `no ident rfx ex: 0x12546789/1 for AC lighting2`
        }
        //if( ! this.settingDevice.as_trigger
        if( ! this.settingDevice.subtypeValue && this.settingDevice.protocol != 'lighting4' ) {
            return `no ident rfx ex: AC for lighting2`
        }
        if(this.settingDevice.subtypeValue) {
            this.settingDevice.subtype = this.rfxtrx.getSubtypeForSubtypeValue(this.settingDevice.subtypeValue)
        }
        if(this.settingDevice.options && this.settingDevice.options.trim()) {
             try {
                JSON.parse(this.settingDevice.options.trim())
            } catch (error) {
                anomalie = "options parameter is a JSON string or empty"
            }
        }
        return anomalie;
    }
    /**
     * create device and verif before add device
     * send ano in message if not good
     */
    protected createDevice() {
        logger.info(`createDevice NewRfxDevice ${JSON.stringify(this.settingDevice)}`)
        /* positionner le numero de subtype */
        this.settingDevice.unique_id =this.settingDevice.protocol+'_'+
            this.settingDevice.subtypeValue+'_'+
            (this.settingDevice.id_rfxcom.replaceAll('/','_'))
        if(this.settingDevice.subtypeValue== 'NONE') {
             this.settingDevice.subtype = 0; 
        } else {
            this.settingDevice.subtype = this.rfxtrx.getSubtypeForSubtypeValue(this.settingDevice.subtypeValue as string)
        }
        this.settingDevice.device_id = this.settingDevice.id_rfxcom,
        this.settingDevice.repetitions = 2;
        
        if(this.settingDevice.commands 
            && this.settingDevice.commands.switchOn > -1 
            && this.settingDevice.commands.switchOff >-1) {
               this.settingDevice.sensors_types = 
                this.settingDevice.sensors_types
                  .filter((value: string) => value != 'switch' && value != 'trigger_on' && value != 'trigger_off'
                       && !value.startsWith('blank'))
                  .concat(["blank model=switch","blank model=trigger_on","blank model=trigger_off"]);                  
                if( ! this.settingDevice.as_trigger) {
                  this.settingDevice.sensors_types.push('switch')
                } else {
                  this.settingDevice.sensors_types.push('trigger_on')
                  this.settingDevice.sensors_types.push('trigger_off');
                }
        }
        delete(this.settingDevice.discovery);
        delete(this.settingDevice.message)
        if(logger.isDebug())logger.debug(`avant appel setNewDevice, ${this.settingDevice}`)
        this.devices.setNewDevice(this.settingDevice);
     }
   /**
     * send data
     * 1) send a discovery message for create new rfx panel (for list options) 
     * 2) send all data
     * 
     */
    protected sendData() { 
        this.publishAllDiscovery();
    }
    publishAllDiscovery() {
        logger.info(`publishAllDiscovery NewRfxDevice `)
        super.publishDiscoveryAll('newrfx',NewRfxDevice.dataNames,
            this.unique_id_of_new,'Rfx new device','','Rfx New Device')
        logger.info(`publishAllDiscovery NewRfxDevice envoi state ${JSON.stringify(this.settingDevice)}`)
        super.publishState(this.topicState,this.settingDevice)
      }
    protected onNewComponent(componentName: string, component: any) {
        switch (componentName) {
            case 'exists_choice':
                let list1 = Object.keys(this.devices.getAllDevicesByAreaAndName());
                list1.unshift('NEW');
                component.options= list1;
            break;
            case 'subtypevalue':
                let liste : any = this.rfxtrx.getAllSubtypeValues()
                liste.unshift('NONE')
                component.options=liste;
            break;
            case 'protocol':
                component.options=this.rfxtrx.getListPacketNamesForSubtypeValue(this.settingDevice.subtypeValue||'NONE')
            break;
            default:
                break;
        }
        return component;
      }
    setDiscoveryDevice(dev: SettingDevice) {
        if(logger.isDebug())logger.debug(`setDiscoveryDevice ${JSON.stringify(dev)}`)
        this.settingDevice = {
            exists_choice: dev.name || '',
            protocol: dev.protocol,
            discovery: this.config.discovery,
            unique_id: dev.unique_id,
            device_id: dev.device_id,
            name: dev.name || '',
            as_trigger: dev.as_trigger || false,
            device_name: Array.isArray(dev.device_name)?dev.device_name:[],
            id_rfxcom: dev.id_rfxcom,
            subtype: dev.subtype,
            subtypeValue: dev.subtypeValue,
            repetitions: dev.repetitions,
            sensors_types: dev.sensors_types,
            commands : dev.commands,
            suggested_area: dev.suggested_area || dev.protocol==='lighting2' ? 'Boutons' : '',
            message: '',
            options:dev.options || ''
        } ;
        if(logger.isDebug())logger.debug(`setDiscoveryDevice ${JSON.stringify(this.settingDevice)}`)
 
        this.sendData();
    }

} 