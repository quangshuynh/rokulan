import type { RokuApp, RokuCommand, RokuDeviceInfo } from "../../types/roku";
import { RokuError } from "../../types/roku";
import { isRokuAppId, parseRokuApps } from "./apps-parser";
import { parseRokuDeviceInfo } from "./device-info-parser";
import { RokuHttpError } from "./errors";
import { toKeypressPath } from "./commands";
import { REDACTED_LITERAL_PATH, toLiteralKeypressPath, toTextEntryCharacters } from "./text-entry";
import { buildRokuUrl, type RokuPath } from "./url";

export interface RokuClient {
  queryDeviceInfo(ip: string): Promise<RokuDeviceInfo>;
  sendKeypress(ip: string, command: RokuCommand): Promise<void>;
  /** Sends validated text as sequential ECP `Lit_` keypresses. */
  sendText(ip: string, text: string): Promise<void>;
  queryApps(ip: string): Promise<RokuApp[]>;
  launchApp(ip: string, appId: string): Promise<void>;
}

interface RequestOptions {
  method: "GET" | "POST";
  path: RokuPath;
}

const MAX_RESPONSE_BYTES = 1024 * 1024;

export function invalidAppIdError(): RokuError {
  return new RokuError("invalid_app_id", "That channel identifier is not valid.");
}

export function createDirectBrowserClient(fetchImpl: typeof fetch = fetch): RokuClient {
  async function request(ip: string, options: RequestOptions): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    // Literal keypress paths contain user text; keep it out of error messages.
    const reportedPath = options.path.startsWith("/keypress/Lit_") ? REDACTED_LITERAL_PATH : options.path;

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
        throw new RokuHttpError(response.status, reportedPath, text);
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
    async sendText(ip: string, text: string) {
      // Validate the whole string before sending anything.
      const characters = toTextEntryCharacters(text);
      for (const character of characters) {
        await request(ip, { method: "POST", path: toLiteralKeypressPath(character) });
      }
    },
    async queryApps(ip: string) {
      const xml = await request(ip, { method: "GET", path: "/query/apps" });
      return parseRokuApps(xml);
    },
    async launchApp(ip: string, appId: string) {
      if (!isRokuAppId(appId)) throw invalidAppIdError();
      await request(ip, { method: "POST", path: `/launch/${appId}` });
    },
  };
}

/** @deprecated Prefer the transport-specific factory name. */
export const createRokuClient = createDirectBrowserClient;
