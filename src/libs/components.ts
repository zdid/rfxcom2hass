import * as fs from 'fs'
import YAML from 'yaml'


export class Components {
    static components = YAML.parse(fs.readFileSync(__dirname+'/../../config/components.yml', 'utf8'));

    static get(typeDevice: string, componentName: string) {
        let comp: any;
         if(Components.components[typeDevice]) {
            if(Components.components[typeDevice][componentName]) {
               comp =  Components.components[typeDevice][componentName]
            } else if(Components.components[typeDevice]["__default"]) {
               comp = Components.components[typeDevice]["__default"]
            }
            if(comp) {
                return JSON.parse(JSON.stringify(comp))
            }
        }
        return undefined;
    }
}
