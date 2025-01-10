export interface KeyValue {[s: string]: any}

export class EntityState{
  id: string = "";
  type: string = "";
  subtype: string = "";
}

//  subtype: string,
//seqnbr:           seqnbr,
//cmnd:             cmnd,

export class RfxcomInfo {
    unique_id: any;
    receiverTypeCode: number = 0;
    receiverType:     string = '';
    hardwareVersion:  string = '';
    firmwareVersion:  number = 0;
    firmwareType:     string = '';
    enabledProtocols: string[] = [];
    version? : string;
    logLevel?: string;
    protocols?: string[];
    // allProtocols?: string[];
    commands: string[] = ["setLogLevel","setProtocols"];
    discovery: boolean = false;
}

export class DeviceEntity {
  public manufacturer: string = "Rfxcom";
  public via_device: string = 'rfxcom2hass_bridge';

  constructor(
    public identifiers: string[] = [],
    public model: string = '',
    public name:  string = '',
    public suggested_area = ''
  ) {}
  
}

export class DeviceBridge {
  public model: string = 'Bridge';
  public name:  string = 'Rfxcom2Hass Bridge';
  public manufacturer: string = 'Rfxcom2Hass';

  constructor(
    public identifiers: string[] = [],
    public hw_version: string = '',
    public sw_version:  string =''
  ) {}
  
}

export interface MqttEventListener{
    subscribeTopic(): string[];
    onMQTTMessage(data: MQTTMessage): void;
}
export interface MQTTMessage{
    topic: string,
    message: any,
    command?: string
}
