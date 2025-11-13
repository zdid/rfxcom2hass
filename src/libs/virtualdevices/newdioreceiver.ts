import { AbstractDevice } from "../abstractdevice";
import { RfxDevice } from "../rfxdevice";
import Devices from "../devices";
import { Logger } from "../logger";
import { MQTTMessage } from "../models";
import Mqtt from "../Mqtt";
import { IRfxcom } from "../rfxcombridge";
import { SettingHass   } from "../settings";
import { SettingDioReceiver } from "./settingsvirtual";

const logger = new Logger(__filename,"debug")

interface SettingNewDioReceiver extends SettingDioReceiver {
    exists_choice: string;
    list_exists_choice: string[];
    appaired_str: string;
    message?: string;
}

export class NewDioReceiverDevice extends AbstractDevice {
    static dataNames = [
        'exists_choice',
         'name', 
         'suggested_area',
         'is_variator',
         'is_cover',
         'appaired_str',
         'add_appaired',
         'sub_appaired',
         'ref_appaired',
         'openduration',
         'closeduration',
         'clicvalid', 
         'clicclear',
   //      'unique_id',  
         'clicdelete',
         'message'
    ];
      
    private settingVirtualDevice: SettingNewDioReceiver ;
    private unique_id_of_new = 'NEW_DIO_RECEIVER'
    private topicState : string;
    private devices: Devices;

    static  vide : string = JSON.stringify({

        protocol: 'DioReceiver',
        exists_choice : '',
        unique_id: '',
        device_id: '',
        name: '',
        device_name: ['Dio Receiver'],
        id_rfxcom: '',
        subtype: 0,
        subtypeValue: '',
        is_variator: false,
        is_cover: false,
        repetitions: 1,
        sensors_types: ['switch', 'level'],
        commands : ['switchOn', 'switchOff', 'setLevel'],
        suggested_area: '',
        appaired: [],
        appaired_str: '',
        ref_appaired: ''
    } );

    constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass, devices: Devices) {
        super(mqtt, rfxtrx, config )
        this.devices = devices;
        this.settingVirtualDevice = JSON.parse(NewDioReceiverDevice.vide);
        this.topicState = AbstractDevice.getTopicCompleteName('state',this.unique_id_of_new)
        this.clearDevice(true);
    }
    get() : SettingNewDioReceiver {
        return this.settingVirtualDevice;
    }
    /**
     * 
     * actions from hass dioreceiver parameters
     */
    clearDevice(nosend:boolean = false) {
        this.settingVirtualDevice = JSON.parse(NewDioReceiverDevice.vide);
        if(!nosend)
        this.sendData();
    }

    setUniqueId(ident: string) {
        this.settingVirtualDevice.unique_id = this.settingVirtualDevice.device_id = ident;
    }
    setName(name: string) {
        this.settingVirtualDevice.name = name;
        // this.sendData();
    }
    setSuggested_area(name: string) {
        this.settingVirtualDevice.suggested_area = name;
        // this.sendData();
    }
    setIsVariator(bol: string) {
        this.settingVirtualDevice.is_variator = bol.toLowerCase()==='true'?true:false;
        this.sendData();
    }
    addAppaired(name: string) {
        this.settingVirtualDevice.appaired.push(name)
        this.setAppaired_str();
        this.sendData();
    }
    subAppaired(name: string) {
        //let unique_id = this.devices.getAllDevicesByName()[name];
        this.settingVirtualDevice.appaired = this.settingVirtualDevice.appaired.filter(nam => nam!= name)
        this.setAppaired_str();
        this.sendData();
    }
    setRefAppaired(name:string ){
        this.settingVirtualDevice.ref_appaired = name;
    }
    setIsCover(bol: string) {
        let bol1 = bol.toLowerCase()==="true"?true:false;
        this.settingVirtualDevice.is_cover = bol1;
        if(bol1){
            if(! this.settingVirtualDevice.openduration) {
                this.settingVirtualDevice.openduration = 9;
            }
            if(! this.settingVirtualDevice.closeduration) {
                this.settingVirtualDevice.closeduration = 8.5;
            }
        } else {
            this.settingVirtualDevice.openduration = 0;
            this.settingVirtualDevice.closeduration = 0;
        }
        this.sendData();
    }
    setClicDelete() {
        if(logger.isDebug())logger.debug(`setClicDelete de newdioreceiver`)
        if(this.settingVirtualDevice.exists_choice != 'NONE') {
            this.devices.deleteVirtualDevice(this.settingVirtualDevice.unique_id);
        }
        this.clearDevice();
    }
    setClicValid() {
        let anomalie : string = this.verifDevice();
        this.settingVirtualDevice.message = anomalie
        if(anomalie) {
            this.sendData();
            return;
        }
        if(! anomalie) {
            this.createDevice();
            this.clearDevice();
        }
    }
    private setAppaired_str() {
        this.settingVirtualDevice.appaired_str = this.settingVirtualDevice.appaired.join(', \n')
    } 
    setExistsChoice(existName: string) {
        if(logger.isDebug())logger.debug("setExistsChoice "+ existName);
        if(existName === "NEW") {
            this.settingVirtualDevice = JSON.parse(NewDioReceiverDevice.vide);
        } else {
            this.settingVirtualDevice = JSON.parse(JSON.stringify(this.devices.getVirtualDeviceByName(existName)))
            this.settingVirtualDevice.exists_choice = this.settingVirtualDevice.name as string;
            this.settingVirtualDevice.is_variator = this.settingVirtualDevice.is_variator || false;
            this.settingVirtualDevice.is_cover = this.settingVirtualDevice.is_cover || false;
            this.settingVirtualDevice.ref_appaired = this.settingVirtualDevice.ref_appaired || '';
            if(this.settingVirtualDevice.is_cover){
                if(! this.settingVirtualDevice.openduration) {
                    this.settingVirtualDevice.openduration = 9;
                }
                if(! this.settingVirtualDevice.closeduration) {
                    this.settingVirtualDevice.closeduration = 8.5;
                }
            } else {
                this.settingVirtualDevice.openduration = 0;
                this.settingVirtualDevice.closeduration = 0;
            }
    
            this.convertUniqueid2Names()
         }
        this.setAppaired_str();
        this.sendData();
    }
    setopenduration(secondesduration: any) {
         this.settingVirtualDevice.openduration = secondesduration;
    }
    setcloseduration(secondesduration: any) {
        this.settingVirtualDevice.closeduration = secondesduration;
    }
   /**
     * end 
     * actions from hass dioreceiver parameters
     */   
    private convertUniqueid2Names() {
        let namesDevices =  this.devices.getAllDevicesByName();
        if(this.settingVirtualDevice.ref_appaired && this.settingVirtualDevice.ref_appaired != '') {
            this.settingVirtualDevice.ref_appaired = this.devices.getNameOfRfxDevice(this.settingVirtualDevice.ref_appaired) || '';
        }
        if(this.settingVirtualDevice.appaired && this.settingVirtualDevice.appaired.length >0) {
            for(let i in this.settingVirtualDevice.appaired) {
                this.settingVirtualDevice.appaired[i] = this.devices.getNameOfRfxDevice(this.settingVirtualDevice.appaired[i]) || '';
            }
            this.settingVirtualDevice.appaired.sort()
        }
    }

   onMQTTMessage(data: MQTTMessage): void {
    if(logger.isDebug())logger.debug(`newdioreceiver  device ${JSON.stringify(data)}`);
       switch (data.command) {
        case 'set_exists_choice':
            this.setExistsChoice(data.message)
            break;
        case 'set_clicvalid':
            this.setClicValid();
        break;
        case 'set_clicclear':
            this.clearDevice();
        break;
        case 'set_clicdelete':
            this.setClicDelete();
        break;
        case 'set_name':
            this.setName(data.message)
        break;
        case 'set_suggested_area':
            this.setSuggested_area(data.message)
            break;
        case 'set_is_variator':
            this.setIsVariator(data.message)
            break;
        case 'add_appaired':
            this.addAppaired(data.message)
            break;
        case 'sub_appaired':
            this.subAppaired(data.message)
            break;
        case 'set_is_cover':
            if(logger.isDebug())logger.debug('appel setIsCover')
            this.setIsCover(data.message)
            break;
        case 'set_refappaired':
            this.setRefAppaired(data.message)
            break;
        case 'set_openduration':
            this.setopenduration(data.message)
        break;
        case 'set_closeduration':
            this.setcloseduration(data.message)
        break;
        default:
            logger.error(`on mqtt message unexpected command: ${JSON.stringify(data)} `)
            break;
       }
    }

    protected sendData() {
        this.publishAllDiscovery();
    }
 
    protected verifDevice() : string {
        let anomalie = '';
        if( ! this.settingVirtualDevice.unique_id ||  this.settingVirtualDevice.unique_id.startsWith('VD_..') ) {
             return 'no identifier';
        }
        if( ! this.settingVirtualDevice.name ) {
             return `no name`
        }
        if( ! this.settingVirtualDevice.suggested_area ) {
             return `no room`
        }
        if(this.settingVirtualDevice.appaired.length === 0 ) {
            return `no device appaired`
        }
        if(this.settingVirtualDevice.appaired.length === 1 ) {
            this.settingVirtualDevice.ref_appaired = this.settingVirtualDevice.appaired[0]
        }
        return anomalie;
    }

    protected createDevice() {
        //recuperer les identifiants à la place des noms
        let namesDevices =  this.devices.getAllDevicesByName();
        this.settingVirtualDevice.ref_appaired = namesDevices[this.settingVirtualDevice.ref_appaired];

        for(let num in this.settingVirtualDevice.appaired) {
            this.settingVirtualDevice.appaired[num] = namesDevices[this.settingVirtualDevice.appaired[num]];
        }
        if(this.settingVirtualDevice.exists_choice === 'NEW') {
            this.settingVirtualDevice.unique_id = 'VD_'+Math.round(Math.random()*100000)
        }
        if(this.settingVirtualDevice.is_cover === true) {
            this.settingVirtualDevice.protocol = 'DioCover'
        } else {
          this.settingVirtualDevice.protocol = 'DioReceiver'
        }
        this.devices.setVirtualDevice(this.settingVirtualDevice)
    }

    publishAllDiscovery() {
        logger.info(`publishAllDiscovery NewDioReceiverDevice ${JSON.stringify(this.settingVirtualDevice)}`)
        super.publishDiscoveryAll('newdioreceiver',NewDioReceiverDevice.dataNames,
            this.unique_id_of_new,'New Dio Receiver','')
        super.publishState(this.topicState,this.settingVirtualDevice)
      }
    protected onNewComponent(componentName: string, component: any) {

        let liste = Object.keys(this.devices.getAllDevicesByName()).sort();
        switch (componentName) {
            case 'exists_choice':
                let liste1 : any = Object.keys(this.devices.getAllVirtualDevicesByName())
                   .filter((name: any)  => this.settingVirtualDevice.protocol === 'DioReceiver')
                liste1.unshift('NEW');
                this.settingVirtualDevice.exists_choice = this.settingVirtualDevice.exists_choice || 'NEW'
                component.options=liste1;
                break;
             case 'add_appaired':
                 let liste2 : any = liste
                    .filter((name: any)  => ! this.settingVirtualDevice.appaired.includes(name))
                component.options=liste2;
               break;
            case 'sub_appaired':
                component.options=this.settingVirtualDevice.appaired
                break;
            case 'ref_appaired':
                component.options=this.settingVirtualDevice.appaired
                break;
            default:
                break;
        }
        return component;
      }

} 