import { normalizePrivateIPv4 } from "../network/ipv4";
import { isRokuAppId } from "./apps-parser";
import { SUPPORTED_COMMANDS } from "./commands";
import { isLiteralKeypressPath } from "./text-entry";

export type RokuPath =
  | "/query/device-info"
  | "/query/apps"
  | `/keypress/${(typeof SUPPORTED_COMMANDS)[number]}`
  | `/keypress/Lit_${string}`
  | `/launch/${string}`;

function isAllowedRokuPath(path: string): path is RokuPath {
  if (path === "/query/device-info" || path === "/query/apps") return true;
  if (path.startsWith("/launch/")) return isRokuAppId(path.slice("/launch/".length));
  if (!path.startsWith("/keypress/")) return false;
  if (path.startsWith("/keypress/Lit_")) return isLiteralKeypressPath(path);

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
