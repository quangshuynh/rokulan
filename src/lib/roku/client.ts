import type { RokuCommand, RokuDeviceInfo } from "@/types/roku";
import { parseRokuDeviceInfo } from "@/lib/roku/device-info-parser";
import { RokuHttpError } from "@/lib/roku/errors";
import { toKeypressPath } from "@/lib/roku/commands";
import { buildRokuUrl } from "@/lib/roku/url";

export interface RokuClient {
  queryDeviceInfo(ip: string): Promise<RokuDeviceInfo>;
  sendKeypress(ip: string, command: RokuCommand): Promise<void>;
}

interface RequestOptions {
  method: "GET" | "POST";
  path: string;
}

export function createRokuClient(fetchImpl: typeof fetch = fetch): RokuClient {
  async function request(ip: string, options: RequestOptions): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetchImpl(buildRokuUrl(ip, options.path), {
        method: options.method,
        signal: controller.signal,
      });

      const text = await response.text();
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
