import type { RokuCommand, RokuDeviceInfo } from "../../types/roku";
import { RokuError } from "../../types/roku";
import { RokuHttpError } from "./errors";
import type { RokuClient } from "./client";

const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8787";

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

  if (payload.error?.code === "roku_http_error" && payload.error.rokuStatus) {
    throw new RokuHttpError(payload.error.rokuStatus, path);
  }
  if (payload.error?.code === "origin_forbidden") {
    throw new RokuError(
      "browser_blocked",
      "The local bridge rejected this page origin. Add the exact RokuLAN origin to the bridge allowlist.",
    );
  }
  throw new Error(payload.error?.message ?? `Local bridge request failed with HTTP ${response.status}.`);
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
  return {
    async queryDeviceInfo(ip: string) {
      const path = `/v1/roku/${encodeURIComponent(ip)}/device`;
      const response = await request(`${baseUrl}${path}`);
      if (!response.ok) await throwBridgeError(response, "/query/device-info");
      return (await response.json()) as RokuDeviceInfo;
    },
    async sendKeypress(ip: string, command: RokuCommand) {
      const path = `/v1/roku/${encodeURIComponent(ip)}/keypress`;
      const response = await request(`${baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: command }),
      });
      if (!response.ok) await throwBridgeError(response, `/keypress/${command}`);
    },
  };
}
