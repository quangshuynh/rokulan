import type { RokuCapabilities, RokuCapabilityState, RokuDeviceInfo } from "../../types/roku";
import { RokuError } from "../../types/roku";

function readTag(xml: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}(?:\\s[^>]*)?>([^<]*)</${tagName}>`, "i").exec(xml);
  return match?.[1]?.trim().replace(/&(?:amp|lt|gt|quot|apos);/g, (entity) => ({
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&apos;": "'",
  })[entity] ?? entity);
}

function parseBoolean(value?: string): boolean {
  return value === "true";
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const CAPABILITY_STATES: readonly RokuCapabilityState[] = ["supported", "unsupported", "unknown"];

function parseCapability(value?: string): RokuCapabilityState {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return "supported";
  if (normalized === "false") return "unsupported";
  return "unknown";
}

/**
 * Reads only the device-reported fields that gate RokuLAN controls. Missing or
 * unrecognized values stay "unknown"; nothing is inferred from model names.
 */
export function parseRokuCapabilities(payload: string): RokuCapabilities {
  const supportsFindRemote = parseCapability(readTag(payload, "supports-find-remote"));
  const findRemotePossible = parseCapability(readTag(payload, "find-remote-is-possible"));
  return {
    tv: parseCapability(readTag(payload, "is-tv")),
    findRemote:
      supportsFindRemote === "supported" && findRemotePossible === "unsupported"
        ? "unsupported"
        : supportsFindRemote,
  };
}

/** Re-validates capability data that crossed the bridge boundary as JSON. */
export function sanitizeRokuCapabilities(value: unknown): RokuCapabilities | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const read = (key: keyof RokuCapabilities): RokuCapabilityState => {
    const state = (value as Record<string, unknown>)[key];
    return CAPABILITY_STATES.find((known) => known === state) ?? "unknown";
  };
  return { tv: read("tv"), findRemote: read("findRemote") };
}

export function parseRokuDeviceInfo(xml: string, ip: string): RokuDeviceInfo {
  const document = xml.match(/<device-info(?:\s[^>]*)?>([\s\S]*)<\/device-info>\s*$/i);
  if (!document || /<!DOCTYPE|<!ENTITY/i.test(xml)) {
    throw new RokuError(
      "malformed_device_response",
      "Device response was not a valid Roku device-info payload.",
    );
  }

  const payload = document[1];
  const vendorName = readTag(payload, "vendor-name");
  if (vendorName && vendorName.trim().toLowerCase() !== "roku") {
    throw new RokuError(
      "not_roku",
      "The device responded, but it does not appear to be a Roku device.",
    );
  }

  const friendlyName = readTag(payload, "friendly-device-name");
  const modelName = readTag(payload, "model-name");

  if (!vendorName || !friendlyName || !modelName) {
    throw new RokuError(
      "malformed_device_response",
      "Device-info payload is missing required Roku fields.",
    );
  }

  return {
    ip,
    friendlyName,
    modelName,
    modelNumber: readTag(payload, "model-number"),
    isTv: parseBoolean(readTag(payload, "is-tv")),
    screenSize: parseNumber(readTag(payload, "screen-size")),
    powerMode: readTag(payload, "power-mode"),
    softwareVersion: readTag(payload, "software-version"),
    capabilities: parseRokuCapabilities(payload),
  };
}
