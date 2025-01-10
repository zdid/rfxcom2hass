import {Settings,  SettingDevice, getSettingDeviceFromEvent } from './settings';
import * as fs from 'fs';
import * as  YAML from 'yaml';
import { RfxcomInfo } from './models';
import { BridgeDevice } from './bridgedevice';
import { RfxDevice } from './rfxdevice';
import {Logger} from './logger';
import { NewRfxDevice } from './newrfxdevice';
import { VirtualDevice } from './virtualdevices/virtualdevices';
import { SettingVirtualDevice } from './virtualdevices/settingsvirtual';
import { AbstractDevice } from './abstractdevice';
import { getListOfNewsParameters, getNewVirtualDeviceFrom } from './virtualdevices';

const logger = new Logger(__filename);

//interface IDevices {[s: string]: RfxDevice};

/**
 * Devices contains the devices detected with a flag for send to mqtt
 */
export class Devices {
   private config: Settings;
    private devices: {[s: string]: RfxDevice}; 
    private virtuals:{[s: string]: VirtualDevice};
    private fileDevices = process.env.RFXCOM2HASS_DATA_DEVICES ?? '/app/data/devices.yml';
    private fileVirtuals = process.env.RFXCOM2HASS_DATA_VIRTUALDEVICES ?? '/app/data/virtuals.yml';
    private timer?: NodeJS.Timeout= undefined;
    private saveInterval: number;
    private isModifiedDevices: boolean; 
    private isModifiedVirtuals: boolean; 
    private mqtt: any;
    private irfxcom: any;
    private bridgeDiscovery?: BridgeDevice;
    private hassStarted: boolean;
    private publishWait:boolean;
    private newrfxDevice?: NewRfxDevice;
    
    private listOfNewsParametersDevice: AbstractDevice[]

    constructor( config: Settings) {
        this.devices = {};
        this.virtuals = {};
        this.config = config;
        this.saveInterval = 1000 * 60 * (config.cacheDevices.saveInterval);
        this.timer = setInterval(() => this.save(), this.saveInterval);
        this.hassStarted = false;
        this.publishWait = false;
        this.isModifiedDevices = false;
        this.isModifiedVirtuals = false;
        this.listOfNewsParametersDevice = [];
    }
    // subscribeTopic(): string[] {
    //     return [AbstractDevice.getTopicCompleteName('homeassistant_availlability','')]    
    // }
 
    start(mqtt: any, irfxcom: any): void {
        this.mqtt = mqtt;
        this.irfxcom = irfxcom;
        this.bridgeDiscovery = new BridgeDevice(mqtt,irfxcom,this.config.homeassistant)
        this.newrfxDevice = new NewRfxDevice(mqtt,irfxcom,this.config.homeassistant,this)
        /**
         * parameter objects virtual for homeassistant
         */
        for(let newparameterdevice of getListOfNewsParameters(mqtt,irfxcom,this.config.homeassistant, this)) {
            this.listOfNewsParametersDevice[newparameterdevice.get().unique_id] = newparameterdevice;
        }
        /** 
         * load devices and virtuals devices
         */
        this.loadDevices();
        this.loadVirtuals();
   }

    stop(): void {
        clearInterval(this.timer);
        this.save();
    }

    private addDevice(dev:  SettingDevice) {
        this.devices[dev.unique_id] = new RfxDevice(this.mqtt,this.irfxcom,this.config.homeassistant,dev)
    }
    private addVirtualDevice(dev:  SettingVirtualDevice) {
        this.virtuals[dev.unique_id] = getNewVirtualDeviceFrom(this.mqtt,this.irfxcom,this.config.homeassistant,
            this,dev);
    }
   
    deleteVirtualDevice(numdevice: string) {
        logger.debug(`deleteVirtualDevice de virtuals ${numdevice}`)
        if(this.virtuals[numdevice]) {
            this.virtuals[numdevice].publishDeleteDevice();
            delete this.virtuals[numdevice];
        }
     }
    deleteDevice(numdevice: string) {
        logger.debug(`deleteDevice de devices ${numdevice}`)
        if(this.devices[numdevice]) {
            this.devices[numdevice].publishDeleteDevice();
            delete this.devices[numdevice];
        }
    }
   private loadDevices(): void {
        let tempDevices : SettingDevice[];
        this.devices = {};
        if (fs.existsSync(this.fileDevices)) {
 //           try {
                tempDevices = YAML.parse(fs.readFileSync(this.fileDevices, 'utf8'));
                logger.info(` read file ${this.fileDevices} `)
                for(let ident in tempDevices) {
                    logger.debug(` read ident ${ident} `)
                   
                    this.addDevice(tempDevices[ident]);
                }
            // } catch (e) {
            //     logger.error(`Failed to load devices from file ${this.fileDevices} (corrupt file?): ${e}`);
            // }
        } else {
            logger.error(`Can't load state from file ${this.fileDevices} (doesn't exist)`);
        }
    }
    private loadVirtuals(): void {
        let tempVirtuals : SettingVirtualDevice[];
        this.virtuals = {};

        if (fs.existsSync(this.fileVirtuals)) {
            try {
                tempVirtuals = YAML.parse(fs.readFileSync(this.fileVirtuals, 'utf8'));
                for(let ident in tempVirtuals) {
                    this.addVirtualDevice(tempVirtuals[ident]);
                }
            } catch (e) {
                logger.error(`Failed to load virtuals from file ${this.fileVirtuals} (corrupt file?), ${e}`);
            }
        } else {
            logger.error(`Can't load virtuals from file ${this.fileVirtuals} (doesn't exist)`);
        }
    }
    private getAllSettingDevice() {
        let ret: any = {}
        for ( let numDev in this.devices) {
            ret[numDev]= this.devices[numDev].get()
        }
        return ret;
    }
    private getAllSettingVirtualDevice() {
        let ret: any = {}
        for ( let numDev in this.virtuals) {
            ret[numDev]= this.virtuals[numDev].get()
        }
        return ret;
    }
    getAllDevicesByName(protocol? : string): any {
        let ret : any = {} ;
        for(let uniqueId in this.devices) {
            let device : SettingDevice = this.devices[uniqueId].get();
            ret[device.name as string ] = uniqueId;
        }
        return ret;
    }
    getAllVirtualDevicesByName(protocol? : string): any {
        let ret : any = {} ;
        for(let uniqueId in this.virtuals) {
            let virtual : SettingVirtualDevice = this.virtuals[uniqueId].get();
            ret[virtual.name as string ] = uniqueId;
        }
        return ret;
    }
    getNameOfRfxDevice(unique_id: string) {
        // if(this.devices[unique_id] ) {
        //     return this.devices[unique_id].get().name
        // }
        // return ''
        return this.devices[unique_id]?this.devices[unique_id].get().name:'';
    }
    private save(): void {
        let devs = {}
        if (this.config.cacheDevices.enable  && this.isModifiedDevices === true) {
            logger.info(`Saving devices to file ${this.fileDevices}`);
           let tempDevices = this.devices;
           tempDevices = {};
              try {
                let allDevices = this.getAllSettingDevice();
                const valyaml = YAML.stringify(allDevices);
                fs.writeFileSync(this.fileDevices, valyaml, 'utf8');
                this.isModifiedDevices = false;
            } catch (e: any) {
                logger.error(`Failed to write devices to '${this.fileDevices}' (${e.message})`);
            }
        } 
        else {
            //logger.debug(`Not saving devices`);
        }
        devs = {}
        if (this.config.cacheDevices.enable  && this.isModifiedVirtuals === true) {
            logger.info(`Saving virtuals to file ${this.fileVirtuals}`);
             try {
                let allVirtuals = this.getAllSettingVirtualDevice();
                const valyaml = YAML.stringify(allVirtuals);
                fs.writeFileSync(this.fileVirtuals, valyaml, 'utf8');
                this.isModifiedVirtuals = false;
            } catch (e: any) {
                logger.error(`Failed to write virtuals to '${this.fileVirtuals}' (${e.message})`);
            }
        }
          else {
//             logger.debug(`Not saving virtuals`);
        }
    }
    existsDevice(uniq: string): boolean {
        return Boolean(this.devices[uniq]);
    }

    getDevice(uniq: string): SettingDevice | undefined{
        return this.devices[uniq]?.get() || undefined;
    }

    getDeviceByName(name: string) {
        let devic = Object.values(this.devices).find((devic:RfxDevice) => devic.get().name === name) ;
        return devic?devic.get():undefined;
    }

    setDeviceFromEvent(evt: any ) : SettingDevice  | undefined  {
        if( ! this.devices[evt.unique_id] 
            &&  this.config.homeassistant.discovery) {
                this.newrfxDevice?.setDiscoveryDevice(getSettingDeviceFromEvent(evt))
         }
        //  if(this.devices[evt.unique_id]) {
        //     this.devices[evt.unique_id].informStatus(evt) 
        //  }
        return this.getDevice(evt.unique_id);
    }

    setNewDevice(setting: SettingDevice) {
        this.addDevice(setting);
        this.isModifiedDevices = true;
        this.save();

    }
    setVirtualDevice(settingVirtualDevice: SettingVirtualDevice) {
        this.addVirtualDevice(settingVirtualDevice);
        this.isModifiedVirtuals = true;
        this.save();
    }

    existsVirtualDevice(uniq: string): boolean {
        return Boolean(this.virtuals[uniq]);
    }

    getVirtualDevice(uniq: string): SettingVirtualDevice | undefined{
         return this.virtuals[uniq]?.get() || undefined;
    }
    getVirtualDeviceByName(name: string): SettingVirtualDevice | undefined{
        let virt = Object.values(this.virtuals).find((virtual:VirtualDevice) => virtual.get().name === name) ;
        return virt?virt.get():undefined;
    }
     setBridge(evt: RfxcomInfo )  {
        logger.info(`setBridge evt ${JSON.stringify(evt)}`)
        this.bridgeDiscovery?.set(evt);
    }

    remove(id: string ): void {
        logger.debug(`remove entity device : `+id);
        delete this.devices[id];
        this.isModifiedDevices = true;
    }
    stopPublishDiscovery() {
        this.hassStarted = false;
    }
    startPublishDiscovery() {
        logger.info('start to publish discovery message')
        this.hassStarted = true;
        this.publishAllDiscovery();
    }
 
    async publishAllDiscovery() {
        if(this.publishWait) return;
        this.publishWait = true;
        logger.info("publishAllDiscovery attente waitReady")
        await this.bridgeDiscovery?.waitReady() 
        logger.info("publishAllDiscovery avant bridgediscovery")
        this.bridgeDiscovery?.publishAllDiscovery();
        logger.info("publishAllDiscovery avant new rfx discovery")
        this.newrfxDevice?.publishAllDiscovery();
          logger.info('publish... avant les devices')
        for(let ident in this.devices) {
            logger.info(`publish... avant le device ${ident}`)
            this.devices[ident].publishAllDiscovery();
        }
        logger.info("publishAllDiscovery avant new onoff virtual")
        for(let numparmdevice in this.listOfNewsParametersDevice) {
            this.listOfNewsParametersDevice[numparmdevice].publishAllDiscovery();
        }

        for(let ident in this.virtuals) {
            logger.info(`publish... avant le virtual ${ident}`)
            this.virtuals[ident].publishAllDiscovery();
        }

        this.publishWait = false;
    }
    async execute(unique_id: string, command: string, parm : any, callback: Function) {
        if(this.devices[unique_id]) {
            await this.devices[unique_id].execute(command,parm, callback);
        } else {
            logger.error(`exec command on '${unique_id}' : device no exists`)
        }
    }
 
}

export default Devices;
