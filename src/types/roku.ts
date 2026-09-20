export type RokuCommand =
  | "Home"
  | "Back"
  | "Up"
  | "Down"
  | "Left"
  | "Right"
  | "Select"
  | "InstantReplay"
  | "Play"
  | "Rev"
  | "Fwd"
  | "VolumeUp"
  | "VolumeDown"
  | "VolumeMute"
  | "Power"
  | "PowerOn"
  | "PowerOff";

export type RokuTransportMode = "bridge" | "direct";

export interface RokuDeviceInfo {
  ip: string;
  friendlyName: string;
  modelName: string;
  modelNumber?: string;
  isTv: boolean;
  screenSize?: number;
  powerMode?: string;
  softwareVersion?: string;
}

export interface SavedRokuDevice {
  ip: string;
  friendlyName: string;
  model: string;
  lastConnectedAt: number;
}

export type RokuErrorCode =
  | "invalid_ip"
  | "non_private_ip"
  | "device_unreachable"
  | "request_timeout"
  | "not_roku"
  | "browser_blocked"
  | "bridge_unavailable"
  | "http_403"
  | "malformed_device_response"
  | "disconnected_device"
  | "unknown_error";

export class RokuError extends Error {
  constructor(
    public readonly code: RokuErrorCode,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RokuError";
  }
}
