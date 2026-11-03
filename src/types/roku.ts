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
  | "PowerOff"
  | "Backspace"
  | "FindRemote";

export type RokuTransportMode = "bridge" | "direct";

/**
 * Tri-state capability derived only from values the device reports over ECP.
 * "unknown" means the field was missing or not a recognized value.
 */
export type RokuCapabilityState = "supported" | "unsupported" | "unknown";

export interface RokuCapabilities {
  /** Device reports `is-tv`; Roku TVs natively handle volume/power keys. */
  tv: RokuCapabilityState;
  /** Device reports `supports-find-remote` and `find-remote-is-possible`. */
  findRemote: RokuCapabilityState;
}

export interface RokuDeviceInfo {
  ip: string;
  friendlyName: string;
  modelName: string;
  modelNumber?: string;
  isTv: boolean;
  screenSize?: number;
  powerMode?: string;
  softwareVersion?: string;
  /** Optional so older bridges and saved data remain compatible. */
  capabilities?: RokuCapabilities;
}

export type RokuAppType = "appl" | "tvin" | "menu" | "unknown";

export interface RokuApp {
  id: string;
  name: string;
  type: RokuAppType;
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
  | "invalid_text"
  | "invalid_app_id"
  | "malformed_apps_response"
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
