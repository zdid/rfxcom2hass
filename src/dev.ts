

process.env['RFXCOM2HASS_DATA_PATH'] = '/home/didier/Developpements/workspace6/rfxcom2hass_config';
process.env['RFXCOM2HASS_LOG_LEVEL'] = 'debug';
process.env['RFXCOM2HASS_MQTT_SERVER'] =  'ftp://falbala.local:1883'
//process.env['RFXCOM2HASS_MQTT_USERNAME'] = null
//process.env['RFXCOM2HASS_MQTT_PASSWORD'] = null

import { loadDev } from ".";

loadDev() 