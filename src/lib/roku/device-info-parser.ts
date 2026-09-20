import type { RokuDeviceInfo } from "@/types/roku";
import { RokuError } from "@/types/roku";

function readTag(xml: string, tagName: string): string | undefined {
  const match = new RegExp(`<${tagName}>([^<]*)</${tagName}>`).exec(xml);
  return match?.[1]?.trim();
}

function parseBoolean(value?: string): boolean {
  return value === "true";
}

function parseNumber(value?: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseRokuDeviceInfo(xml: string, ip: string): RokuDeviceInfo {
  if (!xml.includes("<device-info>")) {
    throw new RokuError(
      "malformed_device_response",
      "Device response was not a valid Roku device-info payload.",
    );
  }

  const friendlyName = readTag(xml, "friendly-device-name");
  const modelName = readTag(xml, "model-name");

  if (!friendlyName || !modelName) {
    throw new RokuError(
      "malformed_device_response",
      "Device-info payload is missing required Roku fields.",
    );
  }

  const vendorName = readTag(xml, "vendor-name")?.toLowerCase();
  if (vendorName && !vendorName.includes("roku")) {
    throw new RokuError(
      "not_roku",
      "The device responded, but it does not appear to be a Roku device.",
    );
  }

  return {
    ip,
    friendlyName,
    modelName,
    modelNumber: readTag(xml, "model-number"),
    isTv: parseBoolean(readTag(xml, "is-tv")),
    screenSize: parseNumber(readTag(xml, "screen-size")),
    powerMode: readTag(xml, "power-mode"),
    networkName: readTag(xml, "network-name"),
    softwareVersion: readTag(xml, "software-version"),
  };
}
