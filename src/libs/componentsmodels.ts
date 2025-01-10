import * as fs from 'fs'
import YAML from 'yaml'


export class Components {
    static components = YAML.parse(fs.readFileSync(__dirname+'/../../config/components.yml', 'utf8'));

    static get(typeDevice: string, componentName: string) {
         return Components.components[typeDevice][componentName];
    }
}
