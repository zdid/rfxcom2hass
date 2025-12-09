'use strict';

var rfxcom  = require('rfxcom');
import {IRfxcom} from './rfxcombridge';
import { SettingHass,  SettingMinDevice} from './settings';
import Mqtt from './Mqtt';
import { DeviceEntity, MQTTMessage,MqttEventListener } from './models';
import utils, { onEvenement  } from './utils';
import {Logger} from './logger';
import { Components } from './components';
import { evenement } from './controller';
import { throws } from 'assert';
import { log } from 'console';
const logger = new Logger(__filename);

/**
 * Analyse une chaîne de configuration de type clé=valeur.
 * * - Les paires sont séparées par des espaces.
 * - Le séparateur clé/valeur est `=`.
 * - Les valeurs peuvent être simples (sans espaces/guillemets) ou encadrées par 
 * des guillemets doubles (") ou des apostrophes (').
 * - Les guillemets peuvent être échappés (ex: "valeur avec \"quote\"").
 * * @param configString La chaîne de configuration à analyser.
 * @returns Un objet Record<string, string> des paires clé-valeur.
 */
function parseConfigString(configString: string): Record<string, string> {
    const results: Record<string, string> = {};

    // Cette expression régulière est conçue pour capturer une paire complète :
    // 1. Clé : ([^=\s]+) : Une suite de caractères qui n'est pas = ou espace. (Groupe 1)
    // 2. Séparateur : =
    // 3. Valeur : (le reste)
    //    - Option A (Valeur simple): ([^\s"']+) : Pas d'espace, pas de guillemet. (Groupe 3)
    //    - Option B (Guillemet double): "((?:[^"\\]|\\.)*)" : Capture le contenu sans les guillemets. (Groupe 4)
    //    - Option C (Apostrophe): '((?:[^'\\]|\\.)*)' : Capture le contenu sans les apostrophes. (Groupe 5)
    //
    // L'expression complète est très longue, mais elle gère l'ensemble des cas.
    const regex = /([^=\s]+)=(([^\s"']+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/gi;

    let match;
    while ((match = regex.exec(configString)) !== null) {
        const key = match[1]; // Toujours dans le groupe 1

        let value = '';
        
        // La valeur capturée est dans le groupe 3, 4 ou 5, selon le type (simple, double, simple quote)
        if (match[3] !== undefined) {
            // Option A : Valeur simple
            value = match[3];
        } else if (match[4] !== undefined) {
            // Option B : Valeur entre guillemets doubles, on supprime l'échappement
            value = match[4].replace(/\\(.)/g, '$1'); 
        } else if (match[5] !== undefined) {
            // Option C : Valeur entre apostrophes, on supprime l'échappement
            value = match[5].replace(/\\(.)/g, '$1');
        }

        // On assigne la paire au résultat
        results[key] = value;
    }

    return results;
}



/**
 * 
 */
export class AbstractDevice   { //implements MqttEventListener{

  protected mqtt: Mqtt;
  protected rfxtrx: IRfxcom;
  protected config : SettingHass;
  protected topics2Subscribe : string[];
  private   static discoveryOrigin: any;
  private json2delete: any;
  private fordelete_unique_id : string;
  protected lastStatus: any;
  static mqtt: any;
  static config: SettingHass ;
  protected isFirstTime : boolean;
  protected receiveEventForDelete: any[]; //( data: any) => void;
  //protected receiveEventMqtt?: ( data: any) => void;
  
  
  constructor(mqtt: Mqtt, rfxtrx: IRfxcom, config : SettingHass){
    this.mqtt = mqtt;
    this.rfxtrx = rfxtrx;
    this.topics2Subscribe = [];
    this.isFirstTime = true;
    this.fordelete_unique_id ='';
    this.config = config;//.homeassistant;
    this.receiveEventForDelete = [];
    if( !AbstractDevice.mqtt) {
        AbstractDevice.mqtt = mqtt;
    }
    if( !AbstractDevice.config) {
        AbstractDevice.config = config;
    }
  }
  
   
  

  static getDiscoveryOrigin() {
    if (! AbstractDevice.discoveryOrigin) {
        AbstractDevice.discoveryOrigin=  {
        name: 'RFX bridge', 
        sw: utils.getRfxcom2hassVersion(), 
        //url: 'https://zdid.github.io/rfxcom2hass/'
        };
    }
    return AbstractDevice.discoveryOrigin;
  }
  /**
 * Analyse une chaîne de configuration de type clé=valeur.
 * * - Les paires sont séparées par des espaces.
 * - Le séparateur clé/valeur est `=`.
 * - Les valeurs peuvent être simples (sans espaces/guillemets) ou encadrées par 
 * des guillemets doubles (") ou des apostrophes (').
 * - Les guillemets peuvent être échappés (ex: "valeur avec \"quote\"").
 * * @param configString La chaîne de configuration à analyser.
 * @returns Un objet Record<string, string> des paires clé-valeur.
 */
static  parseConfigString(configString: string): { componentName: string; results: Record<string, string> }{
    const results: Record<string, string> = {};
    //extraction du premier mot
    const premierMot = configString.trim().match(/^\S+/);
    const command = premierMot ? premierMot[0] : '';
    configString = configString.slice(command.length).trim();

    // Cette expression régulière est conçue pour capturer une paire complète :
    // 1. Clé : ([^=\s]+) : Une suite de caractères qui n'est pas = ou espace. (Groupe 1)
    // 2. Séparateur : =
    // 3. Valeur : (le reste)
    //    - Option A (Valeur simple): ([^\s"']+) : Pas d'espace, pas de guillemet. (Groupe 3)
    //    - Option B (Guillemet double): "((?:[^"\\]|\\.)*)" : Capture le contenu sans les guillemets. (Groupe 4)
    //    - Option C (Apostrophe): '((?:[^'\\]|\\.)*)' : Capture le contenu sans les apostrophes. (Groupe 5)
    //
    // L'expression complète est très longue, mais elle gère l'ensemble des cas.
    const regex = /([^=\s]+)=(([^\s"']+)|"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)')/gi;

    let match;
    while ((match = regex.exec(configString)) !== null) {
        const key = match[1]; // Toujours dans le groupe 1

        let value = '';
        
        // La valeur capturée est dans le groupe 3, 4 ou 5, selon le type (simple, double, simple quote)
        if (match[3] !== undefined) {
            // Option A : Valeur simple
            value = match[3];
        } else if (match[4] !== undefined) {
            // Option B : Valeur entre guillemets doubles, on supprime l'échappement
            value = match[4].replace(/\\(.)/g, '$1'); 
        } else if (match[5] !== undefined) {
            // Option C : Valeur entre apostrophes, on supprime l'échappement
            value = match[5].replace(/\\(.)/g, '$1');
        }

        // On assigne la paire au résultat
        results[key] = value;
    }

    return {componentName: command, results:results};
}



  
  static getTopicCompleteName(name: string, unique_id : string,sensortype: string='', config?: SettingHass) : string {
    if(config) {
      AbstractDevice.config = config;
    }
    let  model: string = AbstractDevice.config.topics[name];
    if (!model){
        logger.warn('No topic model for '+name+' in config');
        return '';
    }
    
    model = model.replaceAll('%discovery_bridge_unique_id%',AbstractDevice.config.discovery_bridge_unique_id)
            .replaceAll('%device_unique_id%', unique_id)
            .replaceAll('%base_topic%',AbstractDevice.config.base_topic)
            .replaceAll('%sensortype%',sensortype);
    
    return model;
  }

 


  protected onNewComponent(componentName: string, component: any) {
    return component;
  }
 
  public publishDeleteDevice() {
    /**
     * en deux temps 
     * 1) suppress des sensors
     * 2) suppress de l'appareil 2 secondes après
     */
      this.publishDiscovery(AbstractDevice.getTopicCompleteName('discovery',this.fordelete_unique_id),
        this.json2delete)
      for( let functio of this.receiveEventForDelete) {
        evenement.removeListener('RFX:'+this.fordelete_unique_id,functio);
      }
      setTimeout(()=>{
        this.publishDiscovery(AbstractDevice.getTopicCompleteName('discovery',this.fordelete_unique_id),null)
      },2000)
  }
  private static getDatas(typeDevice:string,modelName: string): { componentName:string, component: any , results: Record<string, string>}  { 
    let { componentName, results } = AbstractDevice.parseConfigString( modelName);
    let component = Components.get(typeDevice,componentName);
    return { componentName, component, results  };
  }
 
  protected publishDiscoveryAll(typeDevice:string, datanames: string [], unique_id: string, deviceName : string , protocol: string,suggested_area?: string) {
    logger.info(`publishDiscoveryAll  datanames=${datanames} ` );  
    this.fordelete_unique_id = unique_id; 
    let topics = {
      state : AbstractDevice.getTopicCompleteName('state',unique_id),
      will: AbstractDevice.getTopicCompleteName('will',unique_id),
      discovery: AbstractDevice.getTopicCompleteName('discovery',unique_id),
    }
    
     const json = {
      availability: [
        {
          "topic": AbstractDevice.getTopicCompleteName('will','')
        }
      ],
      origin: AbstractDevice.getDiscoveryOrigin(),
      availability_mode: "all",
      device: {
        identifiers: unique_id,
        name : deviceName,
        manufacturer : "RfxCom",
        model : protocol,
        sw: '1.0',
        sn: unique_id,
        hw: '1.0',
        suggested_area: suggested_area
      },
      state_topic : topics.state,
      components : {}
     }
     this.json2delete = JSON.parse(JSON.stringify(json));
     let components: {[key:string]:string} = {}
     for(let componentNameInit of datanames) {
        //recuperation des parametres du modele ex: platform=temperature value_template='{{ value_json.temperature_C }}'
        let modelInitial = AbstractDevice.getDatas(typeDevice,componentNameInit);
        if(logger.isDebug())logger.debug(`publishDiscoveryAll modelInitial=${JSON.stringify(modelInitial)}` );
        if(modelInitial.component === undefined ) {
          continue;
        }
        let model;
        if(modelInitial.results.model) {
          model = AbstractDevice.getDatas(typeDevice,modelInitial.results.model)         
        } else {
          model = modelInitial;
        }
        if(model.component === undefined ) {
          continue;
        }
        Object.assign(model.component,model.results)

        if(logger.isDebug())logger.debug(`publishDiscoveryAll after assign component=${JSON.stringify(model.component)}` );
        model.component.platform=model.component.platform||model.componentName;
        model.component.unique_id=model.component.unique_id||unique_id+'_'+model.componentName
        if(! model.component.value_template && model.component.value_template !== '') {
          model.component.value_template = `{{ value_json.${model.componentName} }}`
        } 


        let list2ignore=['light','switch'];
        model.component.name = model.component.name || model.component.platform;
        model.component.object_id=(suggested_area?suggested_area+'--':'')   + deviceName   
        if(! list2ignore.includes(model.componentName) ) {
          model.component.object_id += '_'+model.componentName  
          model.component.name = model.component.name || model.component.platform;
        } else {
          model.component.name = "";
        }
        model.component.default_entity_id=model.component.platform+'.'+model.component.object_id;
        for(let dataname in model.component) {
          if(dataname.includes('topic')) {
            model.component[dataname] = AbstractDevice.getTopicCompleteName('command',unique_id,model.component[dataname]);
          }
        }
        model.component = this.onNewComponent(model.componentName, model.component);
        if(model.component && modelInitial.component.isempty) {
          model.component = {"platform":model.component.platform} ;//, "unique_id":model.component.unique}
        }

        if(model.component) {
          components[unique_id+'_'+model.componentName] = model.component;
          this.json2delete.components[unique_id+'_'+model.componentName]= {platform:model.component.platform}
        }
      }
      json.components = components;
      if(this.isFirstTime) {
        this.receiveEventForDelete.push(onEvenement('RFX:'+unique_id, this, 'onRFXMessage'));
        this.receiveEventForDelete.push(onEvenement('MQTT:'+unique_id, this,  'onMQTTMessage'));
      }
      this.isFirstTime= false;
      this.publishDiscovery(topics.discovery,json)
    }  

  onRFXMessage(evt: any) {
    this.lastStatus = evt;
  }
  onMQTTMessage(data: MQTTMessage) {
    throw new Error(`no treatment defined for mqtt message: ${JSON.stringify(data)}` );
    
  }

  publishAllDiscovery() {
    throw new Error('publishAllDiscovery: Implement this Medhod');
    
  }
  
  publishDiscovery(topic : string, payload: any) {
    logger.info(`publishDiscovery topic=${topic} payload=${JSON.stringify(payload)}`  )
    this.mqtt.publish(topic, payload,  (error: any) => {},{retain: true, qos: 1}); //,this.config.discovery_topic);
  }

  execute(commandName: string,parms  : any, callback: any) {
    throw new Error('Method not implemented.');
  }
  publishState(topic : string, payload: any) {
     this.mqtt.publish(topic, payload,  (error: any) => {},{retain: true, qos: 1}); //,this.config.discovery_topic);
   }
}

