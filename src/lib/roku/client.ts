import type { RokuCommand, RokuDeviceInfo } from "../../types/roku";
import { parseRokuDeviceInfo } from "./device-info-parser";
import { RokuHttpError } from "./errors";
import { toKeypressPath } from "./commands";
import { buildRokuUrl, type RokuPath } from "./url";

export interface RokuClient {
  queryDeviceInfo(ip: string): Promise<RokuDeviceInfo>;
  sendKeypress(ip: string, command: RokuCommand): Promise<void>;
}

interface RequestOptions {
  method: "GET" | "POST";
  path: RokuPath;
}

const MAX_RESPONSE_BYTES = 1024 * 1024;

export function createDirectBrowserClient(fetchImpl: typeof fetch = fetch): RokuClient {
  async function request(ip: string, options: RequestOptions): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetchImpl(buildRokuUrl(ip, options.path), {
        method: options.method,
        signal: controller.signal,
      });

      const declaredLength = Number(response.headers?.get?.("Content-Length"));
      if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
        throw new Error("Roku response exceeded the size limit.");
      }

      const text = await response.text();
      if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
        throw new Error("Roku response exceeded the size limit.");
      }
      if (!response.ok) {
        throw new RokuHttpError(response.status, options.path, text);
      }

      return text;
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    async queryDeviceInfo(ip: string) {
      const xml = await request(ip, { method: "GET", path: "/query/device-info" });
      return parseRokuDeviceInfo(xml, ip);
    },
    async sendKeypress(ip: string, command: RokuCommand) {
      await request(ip, { method: "POST", path: toKeypressPath(command) });
    },
  };
}

/** @deprecated Prefer the transport-specific factory name. */
export const createRokuClient = createDirectBrowserClient;
