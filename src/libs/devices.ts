import {SettingConfig,  SettingDevice, getSettingDeviceFromEvent, getFileFromConfig, writeFileToConfig } from './settings';
import { RfxcomInfo } from './models';
import { BridgeDevice } from './bridgedevice';
import { RfxDevice } from './rfxdevice';

import { NewRfxDevice } from './newrfxdevice';
import { VirtualDevice } from './virtualdevices/virtualdevice';
import { SettingVirtualDevice } from './virtualdevices/settingsvirtual';
import { AbstractDevice } from './abstractdevice';
import { getListOfNewsParameters, getNewVirtualDeviceFrom } from './virtualdevices';
import { Logger } from './logger';

const logger = new Logger(__filename);
const VIRTUALDEVICES_YAML = 'virtualdevices.yml'
const DEVICES_YAML = 'devices.yml'


/**
 * Devices contains the devices detected with a flag for send to mqtt
 */
export class Devices {
   private config: SettingConfig;
    private devices: {[s: string]: RfxDevice}; 
    private virtuals:{[s: string]: VirtualDevice};
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

    constructor( config: SettingConfig) {
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
        if(this.hassStarted) {
            this.devices[dev.unique_id].publishAllDiscovery();
        }
    }
    private addVirtualDevice(dev:  SettingVirtualDevice) {
        this.virtuals[dev.unique_id] = getNewVirtualDeviceFrom(this.mqtt,this.irfxcom,this.config.homeassistant,
            this,dev);
        if(this.hassStarted) {
            this.virtuals[dev.unique_id].publishAllDiscovery();
        }
       }
   
    deleteVirtualDevice(numdevice: string) {
        if(logger.isDebug())logger.debug(`deleteVirtualDevice de virtuals ${numdevice}`)
        if(this.virtuals[numdevice]) {
            this.virtuals[numdevice].publishDeleteDevice();
            delete this.virtuals[numdevice];
        }
     }
    deleteDevice(numdevice: string) {
        if(logger.isDebug())logger.debug(`deleteDevice de devices ${numdevice}`)
        if(this.devices[numdevice]) {
            this.devices[numdevice].publishDeleteDevice();
            delete this.devices[numdevice];
        }
    }
   private loadDevices(): void {
        let tempDevices : SettingDevice[];
        this.devices = {};
        tempDevices = getFileFromConfig(DEVICES_YAML)
        for(let ident in tempDevices) {
            if(logger.isDebug())logger.debug(` read ident ${ident} `)
            this.addDevice(tempDevices[ident]);
        }
    }
    private loadVirtuals(): void {
        let tempVirtuals : SettingVirtualDevice[];
        this.virtuals = {};
        tempVirtuals = getFileFromConfig(VIRTUALDEVICES_YAML)
        for(let ident in tempVirtuals) {
            this.addVirtualDevice(tempVirtuals[ident]);
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
    getAllDevicesByAreaAndName(protocol? : string): any {
        let ret : any = {} ;
        for(let uniqueId in this.devices) {
            let device : SettingDevice = this.devices[uniqueId].get();
            ret[device.suggested_area +": "+(device.name as string) ] = uniqueId;
        }
        return ret;
     }
    // getAllDevicesByName(protocol? : string): any {
    //     let ret : any = {} ;
    //     for(let uniqueId in this.devices) {
    //         let device : SettingDevice = this.devices[uniqueId].get();
    //         ret[device.name as string ] = uniqueId;
    //     }
    //     return ret;
    // }
    getAllVirtualDevicesByName(protocol? : string): any {
        let ret : any = {} ;
        for(let uniqueId in this.virtuals) {
            let virtual : SettingVirtualDevice = this.virtuals[uniqueId].get();
            if(logger.isDebug())logger.debug(`getAllVirtualDevicesByName virtual ${JSON.stringify(virtual)}`)
            let nam =  `${virtual.suggested_area}: ${virtual.name as string}`
            ret[nam] = uniqueId;
        }
        return ret;
    }
    getNameOfRfxDevice(unique_id: string) {
        // if(this.devices[unique_id] ) {
        //     return this.devices[unique_id].get().name
        // }
        // return ''
        const ref : any | undefined = this.devices[unique_id]?.get();
        return ref?(ref.suggested_area +": "+ref.name):''; 
    }
    private save(): void {
        let devs = {}
        if (this.config.cacheDevices.enable  && this.isModifiedDevices === true) {
           logger.info(`Saving devices to file devices.yml`);
           let allDevices = this.getAllSettingDevice();

           writeFileToConfig(DEVICES_YAML, allDevices);//this.devices)
           this.isModifiedDevices = false;
        } 
        devs = {}
        if (this.config.cacheDevices.enable  && this.isModifiedVirtuals === true) {
            logger.info(`Saving virtuals to file virtuals.yml`);
            let allVirtuals = this.getAllSettingVirtualDevice();
            writeFileToConfig(VIRTUALDEVICES_YAML,allVirtuals)
            this.isModifiedVirtuals = false;
        }
    }
    existsDevice(uniq: string): boolean {
        return Boolean(this.devices[uniq]);
    }

    getDevice(uniq: string): SettingDevice | undefined{
        return this.devices[uniq]?.get() || undefined;
    }

    getDeviceByAreaAndName(name: string) {
        let devic = Object.values(this.devices)
          .find((devic:RfxDevice) => (devic.get().suggested_area+": "+devic.get().name )=== name) ;
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
        if(logger.isDebug())logger.debug(`setVirtualDevice for ${JSON.stringify(settingVirtualDevice)}`)
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
    getVirtualDeviceByAreaAndName(name: string): SettingVirtualDevice | undefined{
        let virt = Object.values(this.virtuals)
          .find((virtual:VirtualDevice) => (virtual.get().suggested_area+": "+virtual.get().name) === name) ;

        return virt?virt.get():undefined;
    }
    setBridge(evt: RfxcomInfo )  {
        logger.info(`setBridge evt ${JSON.stringify(evt)}`)
        this.bridgeDiscovery?.set(evt);
    }

    remove(id: string ): void {
        if(logger.isDebug())logger.debug(`remove entity device : `+id);
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
        logger.info("publishAllDiscovery debut")
        if(this.publishWait) return;
        this.publishWait = true;
        await this.bridgeDiscovery?.waitReady() 
        logger.info("publishAllDiscovery de bridgediscovery")
        this.bridgeDiscovery?.publishAllDiscovery();
        logger.info("publishAllDiscovery de newrfxdevice")
        this.newrfxDevice?.publishAllDiscovery();
        for(let ident in this.devices) {
            logger.info(`publish... avant le device ${ident}`)
            this.devices[ident].publishAllDiscovery();
        }

        for(let numparmdevice in this.listOfNewsParametersDevice) {
            logger.info(`publish... avant le new parameter device ${numparmdevice}`)
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
