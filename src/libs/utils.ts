import { evenement } from "./controller";
import { Logger } from './logger';

//const logger = new Logger(__filename)

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
    instance[method](data);
  }
  evenement.on(eventname, receive)
  return receive;
}

export default { getRfxcom2hassVersion }