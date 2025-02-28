'use strict';

import Controller from './libs/controller';

let controller: Controller;
let stopping = false;

function exit(code: number, restart: boolean = false) {
  if (!restart) {
      process.exit(code);
  }
}

async function start() {
  controller = new Controller(exit)
  await controller.start()
}


function handleQuit() {
  if (!stopping && controller) {
      stopping = true;
      controller.stop(false);
  }
}

export function loadDev() {
   console.log('Developpement m appelle')
}
process.on('SIGINT', handleQuit);
process.on('SIGTERM', handleQuit);
start();