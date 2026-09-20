import { normalizePrivateIPv4 } from "@/lib/network/ipv4";
import { SUPPORTED_COMMANDS } from "@/lib/roku/commands";

export type RokuPath = "/query/device-info" | `/keypress/${(typeof SUPPORTED_COMMANDS)[number]}`;

function isAllowedRokuPath(path: string): path is RokuPath {
  if (path === "/query/device-info") return true;
  if (!path.startsWith("/keypress/")) return false;

  const command = path.slice("/keypress/".length);
  return SUPPORTED_COMMANDS.some((supported) => supported === command);
}

export function buildRokuBaseUrl(ip: string): string {
  return `http://${normalizePrivateIPv4(ip)}:8060`;
}

export function buildRokuUrl(ip: string, path: RokuPath): string {
  if (!isAllowedRokuPath(path)) {
    throw new Error("Unsupported Roku ECP path.");
  }

  return `${buildRokuBaseUrl(ip)}${path}`;
}
