#!/usr/bin/env node
process.env['RFXCOM2HASS_CONFIG'] = __dirname+'/../config/config.yml';
process.env['RFXCOM2HASS_DATA_STATE'] = __dirname+'/../data/state.yml';
process.env['RFXCOM2HASS_DATA_DEVICES'] = __dirname+'/../data/devices.yml';
process.env['RFXCOM2HASS_DATA_VIRTUALDEVICES'] = __dirname+'/../data/virtualdevices.yml';
process.env['RFXCOM2HASS_LOG_LEVEL'] = 'debug';
// process.env['RFXCOM2HASS_LOG_FILE'] = __dirname+'/var/log/rfxcom2hass-zdid.log';

require('./index.ts');