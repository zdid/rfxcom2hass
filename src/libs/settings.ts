
import * as fs from 'fs'
import * as YAML from 'yaml'
import Rfxcom from './rfxcombridge';
import path from 'path';
import { Logger } from './logger';



const logger = new Logger(__filename)


type RecursivePartial<T> = {[P in keyof T]?: RecursivePartial<T[P]>;};
const listePropertiesToIgnore = [
    'unique_id','houseCode','seqnbr', 'subtype', 'type', 'protocol' , 
    'id', 'unitCode', 'commandNumber', 'command', 'deviceName', 
    'id_rfxcom', 'subtypeValue'
];

export interface SettingConfig {
    loglevel: 'warn' | 'debug' | 'info' | 'error',
    cacheDevices: {
        enable: boolean,
        saveInterval: number
    },
    healthcheckminutesfrequency?: number,
    homeassistant: SettingHass,
    mqtt: SettingMqtt,
    rfxcom: SettingRfxcom
}

export interface SettingMqtt{
    base_topic: string,
    include_device_information: boolean,
    retain: boolean
    qos: 0 | 1 | 2,
    version?: 3 | 4 | 5,
    username?: string,
    password?: string,
    port?: string,
    server: string,
    key?: string,
    ca?: string,
    cert?: string,
    keepalive?: number,
    client_id?: string,
    reject_unauthorized?: boolean,
    format_json?: boolean
}

export interface SettingHass{
    discovery: boolean,
    discovery_permanent: boolean
    discovery_bridge_unique_id: string,
    base_topic: string,
    topics:  { [key:string] : string } ;
}

export interface SettingRfxcom{
    usbport: string,
    debug: boolean,
    enable_protocols: string[],
    transmit: {
        repeat: number,
        lighting1: string[],
        lighting2: string[],
        lighting3: string[],
        lighting4: string[],
    },
    receive: string[],
}

export interface SettingMinDevice  {
    protocol: string,
    unique_id: string,
    device_id: string,
    name?: string,
    device_name?: string[],
    id_rfxcom: string,
    friendlyName?: string,
    subtype?: number,
    subtypeValue?: string,
    repetitions?: number,
    sensors_types: string[],
    commands?: any,
    suggested_area?: string,
    options?:string
}
export interface SettingDevice   extends SettingMinDevice {
      //house_code?: string,
      //unit_code?: string,
}

// export function read(file: string): Settings {
//     if (!_settingsWithDefaults) {
//         loadSettingsWithDefaults(file);
//     }

//     return _settingsWithDefaults;
// }


// export function readLocalFile(file: string): Settings {
//     return YAML.parse(fs.readFileSync(file).toString());
// }

// function getFileSettings(file: string): Partial<Settings> {
//     return readLocalFile(file);
// }

// const defaults: RecursivePartial<Settings> = {
   
//     loglevel: 'info',
//     healthcheckminutesfrequency:5,
//     homeassistant: {
//         discovery: true,
//         base_topic: 'homeassistant',
//         discovery_bridge_unique_id: 'BR'+(Math.abs(Math.random()*1000000)),
//         topics: {
//            discovery: 'homeassistant/%sensortype%/%discovery_bridge_unique_id/%device_unique_id%/config',
//            command: '%base_topic%/%discovery_bridge_unique_id%/%device_unique_id%/set',
//            state: '%base_topic%/%discovery_bridge_unique_id%/%device_unique_id%',
//            will: '%base_topic%/%discovery_bridge_unique_id%/status',
//            homeassistant_availability: 'homeassistant/status'
//        }

//     },
//     mqtt: {
//         base_topic: 'rfxcom2hass',
//         include_device_information: false,
//         qos: 0,
//         retain: true,
//     },
//     rfxcom: {
//         debug: true,
//         enable_protocols: ['AC', 'ATI', 'ARC', 'OREGON', 'X10', 'RUBICSON']
//     },
   
// }

//et _settingsWithDefaults: Settings;
// function loadSettingsWithDefaults(file: string): void {
//     _settingsWithDefaults = objectAssignDeep({}, defaults, getFileSettings(file)) as Settings;
//     applyEnvironmentVariables(_settingsWithDefaults);
// }



export function applyEnvironmentVariables(settings: Partial<SettingConfig>): void {
    const generalEnvVars = [
        { env: "RFXCOM2HASS_LOG_LEVEL", props: "loglevel"},
        { env: "RFXCOM2HASS_LOGLEVEL" , props: "loglevel"}
    ]

    generalEnvVars.forEach( envEntry => {
        if (process.env[envEntry.env]) {
            if(settings !== undefined){ 
                // @ts-ignore
                settings[envEntry.props] = process.env[envEntry.env];
            }
        }
    });

    const mqttEnvVars = [
        {env: "RFXCOM2HASS_MQTT_SERVER", props: "server"},
        {env: "RFXCOM2HASS_MQTT_USERNAME", props: "username"},
        {env: "RFXCOM2HASS_MQTT_PASSWORD", props: "password"},
        {env: "RFXCOM2HASS_MQTT_CLIENT_ID", props: "client_id"}];

        

    mqttEnvVars.forEach( envEntry => {
        if (process.env[envEntry.env]) {
            if(settings.mqtt !== undefined){
                // @ts-ignore
                settings.mqtt[envEntry.props] = process.env[envEntry.env];
            }
        }
    });

    const rfxcomEnvVars = [
        {env: "RFXCOM2HASS_USB_DEVICE", props: "usbport"}];

    rfxcomEnvVars.forEach( envEntry => {
        if (process.env[envEntry.env]) {
            // @ts-ignore
            settings.rfxcom[envEntry.props] = process.env[envEntry.env];
        }
    });
    
}
export function getSettingDeviceFromEvent( state: any) {
    //let deviceName: string[] =  rfxcom.deviceNames[packetType][evt.subtype]
    let device_id = (state.subtypeValue?state.subtypeValue+'_':'')+state.id;
    let dev: SettingDevice  = {
        protocol : state.protocol,
        subtype : state.subtype,
        subtypeValue: state.subtypeValue,
        unique_id: state.unique_id,
        id_rfxcom: state.id+(state.unitCode?'/'+state.unitCode:'') ,
        device_id: device_id,
        device_name: state.device_name,
        friendlyName: '',
        repetitions: state.repetitions ?? 2,
        sensors_types : [],
        commands : Rfxcom.getFunctionsForProtocol(state.protocol),
        suggested_area: '',
        options:''
    };
    let property: any ;
    for( property in state) {
         if ( ! listePropertiesToIgnore.includes(property)) {
            dev.sensors_types.push(property);
        }
    }
    // TODO 
    // regarder aussi dans settingDevices si on les mets en button or switch
    // cette fonction devra certainement changer de place et être placée 
    // dans un autre source 
    if(dev.commands && dev.commands.switchOn && dev.commands.switchOff) {
        dev.sensors_types.push('switch')
    }
   
    
    return dev;
}
export function getFileFromConfig(fileName:string) : any {
    let from = "";
    let cible = (process.env.RFXCOM2HASS_DATA_PATH ?? "/app/data")+'/'+fileName;
    if(logger.isDebug())logger.debug(`getFileFromConfig 1: ${fileName} ${cible}` )
    let temp = path.resolve(__dirname+'/../config_default/'+fileName)
    if(logger.isDebug())logger.debug(`test le fichier ${temp}`)
    if(fs.existsSync(temp)) { 
        from = temp;
        if(logger.isDebug())logger.debug(`le fichier ${from} existe`)
    } 
    temp = path.resolve(__dirname+'/../../config_default/'+fileName)
    if(logger.isDebug())logger.debug(`test le fichier ${temp}`)
    if(fs.existsSync(temp)) {
        from = temp
        if(logger.isDebug())logger.debug(`le fichier ${from} existe`)
    }
    // ne copie pas si existe déjà
    if(logger.isDebug())logger.debug(`getFileFromConfig copy de : '${from}' sur '${cible}'` )
    try {
        fs.copyFileSync(from,cible, fs.constants.COPYFILE_EXCL);
    } catch (error) {
       logger.info(` fichier ${cible} existe déjà ${error} `)   
    }
    logger.info(`load file ${cible}`)
    return YAML.parse(fs.readFileSync(cible, 'utf-8').toString());
}
export function writeFileToConfig(fileName: string, data: Object) {
    let cible  = (process.env.RFXCOM2HASS_DATA_PATH ?? "/app/data")+'/'+fileName
    try {
        const valyaml = YAML.stringify(data);
        fs.writeFileSync(cible , valyaml, 'utf8');
    } catch (error) {
        logger.error(`write  file ${cible} failed , ${error}`)            
    }
}
  
  
