import { SettingMinDevice } from "../settings";


export interface SettingVirtualDevice   extends SettingMinDevice {
    appaired: string[];
    ref_appaired: string;
}

export interface SettingDioReceiver extends SettingVirtualDevice {
    closeduration: any;
    openduration: any;
    is_variator: boolean;
    is_cover: boolean;
}
export interface SettingCover extends SettingVirtualDevice{
    closeduration: any;
    openduration: any;
}
