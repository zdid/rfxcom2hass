
var rfxcom  = require('rfxcom');
import { SettingRfxcom,SettingDevice, SettingMinDevice } from './settings';
import { RfxcomInfo } from './models';
import { Devices } from './devices';
import { Logger } from './logger';
import { info } from 'console';

const logger = new Logger(__filename,"debug")

export interface IRfxcom{
  getDeviceNames(protocol: string, subtype: number | undefined): string[];
  enableRFXProtocols(): void;
  getAllSubtypeValues() : string[]; 
  getListPacketNames(): string[];
  getListPacketNamesForSubtypeValue(subtypeValue: string): string[];
  getSubtypeForSubtypeValue(subtypeValue: string): number;
  execute(device : SettingMinDevice ,  commandName : string, value?: any, callback?: Function ): void;
  isGroup(payload: any): boolean;
  start(): Promise<void>;
  getStatus(callback: any): void;
  onStatus(callback: any): void;
  getAllProtocols() : string [];
  onDisconnect(callback: any): void;
  subscribeProtocolsEvent(callback: any): void;
  stop(): void;
  //sendCommand(deviceType: string ,subtypeValue: string ,command: string | undefined ,entityName: string, options?: string): void;
}

interface ListBySubtypeValue {
  [subtypeValue: string] : {
    subtype : string,
    packetNames: string[]
  }
}
interface FunctionsByProtocol {
  [s: string]:  number ;
};


export default class Rfxcom implements IRfxcom{
    private debug: boolean;
    private config: SettingRfxcom;
    private devices: Devices ;
    private rfxtrx: any;
    private allProtocols: string[];
    private receiverTypeCode: number =0;
    private listBySubtypeValue: ListBySubtypeValue = {};

    static functionsByProtocol: FunctionsByProtocol ;
  
    constructor(config: SettingRfxcom, devices: Devices){
      this.config = config
      this.debug = (config.debug) ? config.debug : false;
      this.rfxtrx = new rfxcom.RfxCom(config.usbport, {debug: this.debug});
      this.devices = devices;
      this.allProtocols = [];
      this.listBySubtypeValue = {'NONE': { packetNames : [], subtype: '-1'}};
    }
    getDeviceNames(spacketType: any, subtype: number ): string[] {
      let retValue = []
      let packetType= String(rfxcom.packetNames[spacketType])
      logger.info(`packettype ${spacketType} ${packetType}, subtype ${subtype}, ${rfxcom.deviceNames[spacketType]}`)
      if(packetType && rfxcom.deviceNames[packetType] && rfxcom.deviceNames[packetType][subtype]) {
        retValue = rfxcom.deviceNames[packetType][subtype];
      }
      return retValue;
    }
    static getFunctionsForProtocol(protocol: string) : any{
      if(Rfxcom.functionsByProtocol) {
        return Rfxcom.functionsByProtocol;
      }
      if (rfxcom[protocol] === undefined) {
        return [];
      }
      const list = Object.getOwnPropertyNames(rfxcom[protocol]?.transmitter.prototype);
      let ret : any= {}; 
      for(let uneFonction of list) {
        if(uneFonction !== 'constructor' && ! uneFonction.startsWith('_')){
          ret[uneFonction] = rfxcom[protocol].transmitter.prototype[uneFonction].length -2;
        }
      }
      Rfxcom.functionsByProtocol = ret;
      return ret;
    }
  
    getListPacketNames(): string[] {
      return  Object.values(this.rfxtrx.packetNames).filter((protocol: any) => Number(protocol) != protocol) as string[];
    }
   
    private getRfxcomDevices(){
      return Object.keys(rfxcom);
    }
  
    getListPacketNamesForSubtypeValue(subtypeValue: string) : string []{
       return this.listBySubtypeValue[subtypeValue]?.packetNames;
    }

    getSubtypeForSubtypeValue(subtypeValue: string) : number {
      return parseInt(this.listBySubtypeValue[subtypeValue]?.subtype);
    }

    getAllSubtypeValues() {
      return Object.keys(this.listBySubtypeValue)
        .filter((name: string) => ! name.includes('UNUSED'))
        .sort();
    }

    get(){
      return this.rfxtrx;
    }

    isGroup(payload: any): boolean {
      if(payload.type === 'lighting2'){
        return (payload.commandNumber === 3 || payload.commandNumber === 4);
      }
      if(payload.type === 'lighting1'){
        return (payload.commandNumber === 5 || payload.commandNumber === 6);
      }
      if(payload.type === 'lighting6'){
        return (payload.commandNumber === 2 || payload.commandNumber === 3);
      }
      return false;
    }
  
    async start(): Promise<void>{
      logger.info(`Connecting to RFXCOM at ${this.config.usbport}`);
      return new Promise((resolve, reject) => {
        this.rfxtrx.initialise((error: any) => {
          if (error) {
            logger.error('Unable to initialise the RFXCOM device');
            reject('Unable to initialise the RFXCOM device');
          } else {
            logger.info('RFXCOM device initialised');
            //this.getStatus();
            resolve();
          }
        });
      });
    }

    private validRfxcomDevice(device: any){
      return (this.getRfxcomDevices()
          .find((rfxcomDevice) => device === rfxcomDevice) !== undefined);
    }
  
    private validRfxcomDeviceFunction(device: any, deviceFunction: any) {
      if (rfxcom[device] === undefined) {
        return false;
      }
      let devic = rfxcom[device].transmitter;
      const deviceFunctions = Object.getOwnPropertyNames(devic.prototype);
      return (deviceFunctions.find((rfxcomDeviceFunction) => rfxcomDeviceFunction === deviceFunction) !== undefined);
    }
  
    enableRFXProtocols() {
      logger.info(`enableRFXProtocols ${this.config.enable_protocols.toLocaleString()}`);
      if ( ! this.receiverTypeCode) {
        logger.info("enableRFXProtocols : no receiver type code")
        return;
      }
      let protocolsToEnable = this.config.enable_protocols;
      let mapPr : any[] = protocolsToEnable.map(entry => rfxcom.protocols[this.receiverTypeCode][entry])
      mapPr = mapPr.filter( post => post !== undefined )
      this.rfxtrx.enableRFXProtocols(mapPr, (evt: any)=> {
        logger.info('RFXCOM return of enableRFXProtocols');
      })
    }
    
    getStatus(callback: any){
      this.rfxtrx.getRFXStatus((error: any) => {
        if (error) {
          logger.error('Healthcheck: RFX Status ERROR');
          callback && callback('offline');
        } else {
          callback &&  callback('online');
        }
      });
    }

    getAllProtocols() {
      return this.allProtocols;
    }
  
    private createListBySubtypeValue() {
      /* liste des packetsNames (veritables) */
      /* triés */
      /* creation de la table resultante */
      let temp = Object.keys(this.rfxtrx.packetNames)
        .filter((key:any)=> isNaN(parseInt(key)) && parseInt(this.rfxtrx.packetNames[key])> 10)
        .sort()
        console.log(temp)
       temp .forEach((packetname) => {
          let nb = 0;
          if(Array.isArray(rfxcom[packetname])){
          rfxcom[packetname].forEach((pname: any) => {
            if(pname   === 'transmitter') { 
              return; 
            }
            nb++;
            if(this.listBySubtypeValue[pname]) {
              this.listBySubtypeValue[pname].packetNames.push(packetname)
            } else {
              this.listBySubtypeValue[pname]=  {subtype:rfxcom[packetname][pname],packetNames:[packetname]};
            } 
          })
        }
          if(nb === 0) { // pas de subtype 
            this.listBySubtypeValue.NONE.packetNames.push(packetname)
          }
        })
    }

    onStatus(callback: any){
      logger.info('RFXCOM listen status event');
      this.rfxtrx.on('status',async (evt: any) => {
        logger.info('RFXCOM status event: '+JSON.stringify(evt));
        this.receiverTypeCode = evt.receiverTypeCode;
        
        if(this.allProtocols.length ===0) {
          this.allProtocols = Object.keys(rfxcom.protocols[evt.receiverTypeCode]).sort();
          logger.info(`All protocols: ${JSON.stringify(this.allProtocols)}`)
          this.enableRFXProtocols();
          this.createListBySubtypeValue();
          await this.devices.publishAllDiscovery();
        }
        //evt.allProtocols = this.allProtocols;
        evt.enabledProtocols = evt.enabledProtocols.sort();
        const json = JSON.stringify(evt, (key, value) => {
          if (key === 'subtype' || key === 'seqnbr' || key === 'cmnd') {
            return undefined;
          }
          return value;
        }, 2);
        if(json !== undefined){
          callback(JSON.parse(json) as RfxcomInfo);
	      }
      });
    }

    // private getAndAddDeviceConfig(evt: any  ): SettingDevice | undefined{
    //    if( ! this.devices.existsDevice(evt.unique_id )) {
    //     this.devices.setDevice(evt);
    //   }
    //   return this.devices.getDevice( evt.unique_id);
    // }
    
   
    execute(data: SettingMinDevice, commandName: string,  value?: any, callback?:Function     ){
      let transmitRepetitions: number| undefined;
      let subtype: string;
      let deviceFunction: string;

      if (!this.validRfxcomDevice(data.protocol)) {
        logger.warn(data.protocol+ ' is not a valid device');
        return;
      }

      if (!this.validRfxcomDeviceFunction(data.protocol, commandName)) {
        logger.warn(commandName+ ' is not a valid device function on '+ data.protocol);
        return;
      }
      // We may also get a value from the payload to use in the device function
      let o_options : any;
      if((''+data.options).trim()) {
        try {
          o_options = JSON.parse(''+data.options )
        } catch (error) {
          o_options = undefined;
        } 
      }

      // Instantiate the device class
      let device = new rfxcom[data.protocol].transmitter(this.rfxtrx, data.subtype, o_options);
   
      let nbParmsForFunction = Rfxcom.getFunctionsForProtocol(data.protocol);

      const repeat: number = (transmitRepetitions) ? transmitRepetitions : 2;
      for (let i: number = 0; i < repeat; i++) {
        // Execute the command with optional value if nb parm > 0
        if(nbParmsForFunction[commandName] === 0) { 
          device[commandName](data.id_rfxcom, callback);
        } else {
          device[commandName](data.id_rfxcom, value,callback);
        } 
      }
    }

    onDisconnect(callback: any){
      logger.info('RFXCOM listen disconnect event');
      this.rfxtrx.on('disconnect', (evt: any) => {
        callback(evt);
        logger.info('RFXCOM Disconnected');
      });
    }
    /**
     * souscription rfxcom events for all config receive declared
     * @param callback for event from rfxcom
     */
    subscribeProtocolsEvent(callback: any){
      logger.info('RFXCOM listen event for all protocol');
      this.getListPacketNames().forEach((protocol: string) => {
          if(protocol === 'status') {
            return;
          }
          this.rfxtrx.on(protocol, (evt: any, packetType: string) => {
            logger.info('receive '+protocol);
            evt.protocol = protocol;
            evt.deviceName = rfxcom.deviceNames[packetType][evt.subtype]
            let deviceId = evt.id || evt.data;
            if(evt.subtype || evt.subtype == 0) {
              evt.subtypeValue = rfxcom[protocol][evt.subtype];
            } else {
              evt.subtypeValue = 'NONE'
            }
            if(evt.houseCode && evt.unitCode) {
              evt.houseunit = evt.housecode+evt.unitCode;
            }
            evt.id_rfxcom = evt.houseunit? evt.houseunit:
               (evt.id+(evt.unitCode?'/'+evt.unitCode:''))|| evt.data;
               
            /**
             * protocol + subtypevalue (pour de nombreux type) + 
             * + house+unit (comme les lighting1)
             *   ou le deviceid + unit_code (comme les lighting2)
             *   ou l'evt.data (lighting 4)  
             */
            evt.unique_id = evt.protocol
                + (evt.subtypeValue?'_'+evt.subtypeValue:'')
                + (evt.houseunit? '_'+evt.houseunit:
                    (evt.id?'_'+evt.id+
                      (evt.unitCode?'_'+evt.unitCode:''):
                    (evt.data?'_'+evt.data:''))
                  );
            /**
             * mise a plat des tableaux pour les modeles  (current temperature)
             */
            for(let name in evt) {
              if (Array.isArray(evt[name]) ){
                for(let i = 0; i < evt[name].length; i++) {
                  evt[name+'_'+(i+1)] = evt[name][i]        
                }
                delete evt[name];
              }
            }
            callback(evt);
          });
        });
    }
  
    stop(){
      logger.info('Disconnecting from RFXCOM');
      this.rfxtrx.close();
    }

    private capitalize(str: string): string {
      return str.slice(0, 1).toUpperCase() + str.slice(1);
    }
  }
