import type { RokuCommand, RokuDeviceInfo, RokuErrorCode } from "../../types/roku";
import { RokuError } from "../../types/roku";
import { isRokuAppId, sanitizeRokuApps } from "./apps-parser";
import { sanitizeRokuCapabilities } from "./device-info-parser";
import { RokuHttpError } from "./errors";
import { invalidAppIdError, type RokuClient } from "./client";
import { REDACTED_LITERAL_PATH, toTextEntryCharacters } from "./text-entry";

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8787";
const MAX_BRIDGE_MESSAGE_LENGTH = 300;

/** Bridge error codes that map directly onto the shared Roku error model. */
const FORWARDED_ERROR_CODES: readonly RokuErrorCode[] = [
  "invalid_ip",
  "non_private_ip",
  "request_timeout",
  "not_roku",
  "malformed_device_response",
  "malformed_apps_response",
  "invalid_text",
  "invalid_app_id",
];

interface BridgeErrorPayload {
  error?: { code?: string; message?: string; rokuStatus?: number };
}

async function throwBridgeError(response: Response, path: string): Promise<never> {
  let payload: BridgeErrorPayload = {};
  try {
    payload = (await response.json()) as BridgeErrorPayload;
  } catch {
    // Use the bounded generic message below.
  }

  const code = payload.error?.code;
  const message =
    typeof payload.error?.message === "string"
      ? payload.error.message.slice(0, MAX_BRIDGE_MESSAGE_LENGTH)
      : `Local bridge request failed with HTTP ${response.status}.`;

  if (code === "roku_http_error" && payload.error?.rokuStatus) {
    throw new RokuHttpError(payload.error.rokuStatus, path);
  }
  if (code === "origin_forbidden") {
    throw new RokuError(
      "browser_blocked",
      "The local bridge rejected this page origin. Add the exact RokuLAN origin to the bridge allowlist.",
    );
  }
  if (code === "not_found") {
    throw new RokuError(
      "bridge_unavailable",
      "The running local bridge does not support this feature. Rebuild and restart it with npm run bridge:build and npm run bridge:start.",
    );
  }
  if (code === "roku_unreachable") {
    throw new RokuError("device_unreachable", message);
  }
  const forwarded = FORWARDED_ERROR_CODES.find((known) => known === code);
  if (forwarded) throw new RokuError(forwarded, message);
  throw new Error(message);
}

export function createLocalBridgeClient(
  fetchImpl: typeof fetch = fetch,
  bridgeUrl = DEFAULT_BRIDGE_URL,
): RokuClient {
  const baseUrl = bridgeUrl.replace(/\/$/, "");
  const request = async (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      return await fetchImpl(input, init);
    } catch (error) {
      throw new RokuError(
        "bridge_unavailable",
        "RokuLAN could not reach the local bridge. Start the bridge, then try again.",
        error,
      );
    }
  };
  const operationUrl = (ip: string, operation: string) =>
    `${baseUrl}/v1/roku/${encodeURIComponent(ip)}/${operation}`;
  const postJson = (ip: string, operation: string, body: unknown) =>
    request(operationUrl(ip, operation), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  return {
    async queryDeviceInfo(ip: string) {
      const response = await request(operationUrl(ip, "device"));
      if (!response.ok) await throwBridgeError(response, "/query/device-info");
      const device = (await response.json()) as RokuDeviceInfo;
      return { ...device, capabilities: sanitizeRokuCapabilities(device.capabilities) };
    },
    async sendKeypress(ip: string, command: RokuCommand) {
      const response = await postJson(ip, "keypress", { key: command });
      if (!response.ok) await throwBridgeError(response, `/keypress/${command}`);
    },
    async sendText(ip: string, text: string) {
      toTextEntryCharacters(text);
      const response = await postJson(ip, "text", { text });
      if (!response.ok) await throwBridgeError(response, REDACTED_LITERAL_PATH);
    },
    async queryApps(ip: string) {
      const response = await request(operationUrl(ip, "apps"));
      if (!response.ok) await throwBridgeError(response, "/query/apps");
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        payload = undefined;
      }
      return sanitizeRokuApps(
        typeof payload === "object" && payload !== null ? (payload as { apps?: unknown }).apps : undefined,
      );
    },
    async launchApp(ip: string, appId: string) {
      if (!isRokuAppId(appId)) throw invalidAppIdError();
      const response = await postJson(ip, "launch", { appId });
      if (!response.ok) await throwBridgeError(response, `/launch/${appId}`);
    },
  };
}
