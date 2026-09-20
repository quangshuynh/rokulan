import { isPrivateOrLocalIPv4 } from "@/lib/network/ipv4";
import type { RokuDeviceInfo, SavedRokuDevice } from "@/types/roku";

interface SavedDevicesEnvelope {
  version: number;
  devices: SavedRokuDevice[];
}

const STORAGE_KEY = "rokulan.savedDevices";
const STORAGE_VERSION = 1;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asSavedDevice(value: unknown): SavedRokuDevice | null {
  if (!isRecord(value)) return null;

  const ip = typeof value.ip === "string" ? value.ip : "";
  const friendlyName = typeof value.friendlyName === "string" ? value.friendlyName : "";
  const model = typeof value.model === "string" ? value.model : "";
  const lastConnectedAt =
    typeof value.lastConnectedAt === "number" ? value.lastConnectedAt : Number(value.lastConnectedAt);

  if (!isPrivateOrLocalIPv4(ip) || !friendlyName || !model || !Number.isFinite(lastConnectedAt)) {
    return null;
  }

  return { ip, friendlyName, model, lastConnectedAt };
}

function normalizeSavedDevices(value: unknown): SavedRokuDevice[] {
  if (Array.isArray(value)) {
    return value.map(asSavedDevice).filter((device): device is SavedRokuDevice => Boolean(device));
  }

  if (isRecord(value) && value.version === STORAGE_VERSION && Array.isArray(value.devices)) {
    return value.devices
      .map(asSavedDevice)
      .filter((device): device is SavedRokuDevice => Boolean(device));
  }

  return [];
}

export function loadSavedDevices(storage: Storage | null): SavedRokuDevice[] {
  if (!storage) return [];

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    return normalizeSavedDevices(parsed).sort((a, b) => b.lastConnectedAt - a.lastConnectedAt);
  } catch {
    return [];
  }
}

export function persistSavedDevices(storage: Storage | null, devices: SavedRokuDevice[]): void {
  if (!storage) return;

  const payload: SavedDevicesEnvelope = {
    version: STORAGE_VERSION,
    devices,
  };

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Persistence is optional; storage can be disabled, full, or denied.
  }
}

export function rememberDevice(storage: Storage | null, device: RokuDeviceInfo): SavedRokuDevice[] {
  const now = Date.now();
  const existing = loadSavedDevices(storage).filter((saved) => saved.ip !== device.ip);

  const updated: SavedRokuDevice[] = [
    {
      ip: device.ip,
      friendlyName: device.friendlyName,
      model: device.modelName,
      lastConnectedAt: now,
    },
    ...existing,
  ].slice(0, 8);

  persistSavedDevices(storage, updated);
  return updated;
}

export function removeSavedDevice(storage: Storage | null, ip: string): SavedRokuDevice[] {
  const updated = loadSavedDevices(storage).filter((saved) => saved.ip !== ip);
  persistSavedDevices(storage, updated);
  return updated;
}
