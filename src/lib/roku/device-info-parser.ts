import type { RokuDeviceInfo } from "../../types/roku";
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
  };
}
