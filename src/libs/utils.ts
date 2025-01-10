import { evenement } from "./controller";
import Mqtt from "./Mqtt";
import Rfxcom from "./rfxcombridge";
import { Logger } from './logger';

const logger = new Logger(__filename)



export function getRfxcom2hassVersion(): string {
  const packageJSON = require('../..' + '/package.json');
  return packageJSON.version;
}  

export function capitalize(str : string) {
  let lstr = str.split("");
  if(lstr[0]) { 
    lstr[0] = lstr[0].toUpperCase();
  }
  return lstr.join('');
}


export function onEvenement(eventname: string, instance: any, method:string){
  let receive =  (data: any) => {
    logger.debug(`onevenement  ${JSON.stringify(data)}`)
    try {
      instance[method](data);
     } catch (error) {
       logger.error(`onEvenement plantage sur appel de methode ${method} ${error}`);
     }
  }
  evenement.on(eventname, receive)
  return receive;
}

export default { getRfxcom2hassVersion }