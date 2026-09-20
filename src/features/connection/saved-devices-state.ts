import { loadSavedDevices } from "../../lib/storage/saved-devices";
import type { SavedRokuDevice } from "../../types/roku";

export type SavedDevicesState =
  | { status: "loading"; devices: [] }
  | { status: "ready"; devices: SavedRokuDevice[] };

export function createInitialSavedDevicesState(): SavedDevicesState {
  return { status: "loading", devices: [] };
}

export function hydrateSavedDevices(storage: Storage | null): SavedDevicesState {
  return { status: "ready", devices: loadSavedDevices(storage) };
}

export function readySavedDevices(devices: SavedRokuDevice[]): SavedDevicesState {
  return { status: "ready", devices };
}
