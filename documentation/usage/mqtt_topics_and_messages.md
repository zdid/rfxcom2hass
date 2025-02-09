---
headerDepth: 2
---

# MQTT Topics and Messages

This page describes which MQTT topics are used by Rfxcom2Hass. Note that the base topic (by default `rfxcom2hass`) is configurable in the [Rfxcom2Hass `config.yaml`](../configuration/README.md).

## rfxcom2hass/bridge/info
Contains information of the bridge.
Whenever one of the attributes in the payload changes, this is republished.
Example payload:

```json
{
  "receiverTypeCode": 83,
  "receiverType": "433.92MHz transceiver",
  "hardwareVersion": "1.2",
  "firmwareVersion": 242,
  "firmwareType": "Ext",
  "enabledProtocols": [
    "LIGHTING4",
    "LACROSSE",
    "AC",
    "OREGON",
    "HOMECONFORT"
  ],
  "transmitterPower": 10
}
```

## rfxcom2hass/bridge/state
Contains the state of the bridge, this message is published as retained. Payloads are:
* `online`: published when the bridge is running (on startup)
* `offline`: published right before the bridge stops

### rfxcom2hass/devices** to receive incoming messages.

Contains information of an device.

Example payload on topic `"rfxcom2hass/devices/0x01A4F9BE/2"`:
```
   {
    "seqnbr": 4,
    "subtype": 0,
    "id": "0x01A4F9BE",
    "unitCode": 2,
    "commandNumber": 0,
    "command": "Off",
    "level": 0,
    "rssi": 4,
    "type": "lighting2",
    "deviceName": [
        "KlikAanKlikUit",
        "HomeEasy UK",
        "Chacon",
        "NEXA",
        "Intertechno"
    ],
    "subTypeValue": "AC"
   }
```

### Publish command examples (topic/payload)

```
    rfxcom2hass/cmd/lighting2/0/0x01A4F9BE/2/set
    on

    rfxcom2hass/cmd/lighting2/0/0x01A4F9BE/2/set
    off

    rfxcom2hass/cmd/lighting2/0/0x01A4F9BE/2/set
    level 15

```