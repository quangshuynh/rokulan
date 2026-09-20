import { normalizePrivateIPv4 } from "@/lib/network/ipv4";

export function buildRokuBaseUrl(ip: string): string {
  return `http://${normalizePrivateIPv4(ip)}:8060`;
}

export function buildRokuUrl(ip: string, path: string): string {
  if (!path.startsWith("/")) {
    throw new Error("Roku path must start with '/'.");
  }

  return `${buildRokuBaseUrl(ip)}${path}`;
}
