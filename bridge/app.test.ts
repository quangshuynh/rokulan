import { describe, expect, it, vi } from "vitest";
import type { RokuClient } from "../src/lib/roku/client";
import { RokuHttpError } from "../src/lib/roku/errors";
import { RokuError, type RokuDeviceInfo } from "../src/types/roku";
import { handleBridgeRequest } from "./app";

const ORIGIN = "http://localhost:3000";
const DEVICE: RokuDeviceInfo = {
  ip: "192.168.1.20",
  friendlyName: "Synthetic Roku",
  modelName: "Synthetic Model",
  isTv: true,
};

function client(overrides: Partial<RokuClient> = {}): RokuClient {
  return {
    queryDeviceInfo: vi.fn().mockResolvedValue(DEVICE),
    sendKeypress: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`http://127.0.0.1:8787${path}`, {
    ...init,
    headers: { Origin: ORIGIN, ...init.headers },
  });
}

describe("local bridge API", () => {
  it("queries a validated private Roku IP", async () => {
    const roku = client();
    const response = await handleBridgeRequest(request("/v1/roku/192.168.1.20/device"), roku);
    expect(response.status).toBe(200);
    expect(roku.queryDeviceInfo).toHaveBeenCalledWith("192.168.1.20");
  });

  it.each(["not-an-ip", "8.8.8.8", "127.0.0.1", "169.254.2.3"])(
    "rejects unsafe target %s",
    async (ip) => {
      expect((await handleBridgeRequest(request(`/v1/roku/${ip}/device`), client())).status).toBe(400);
    },
  );

  it("rejects arbitrary paths and query strings", async () => {
    expect((await handleBridgeRequest(request("/proxy?url=http://example.test"), client())).status).toBe(404);
    expect((await handleBridgeRequest(request("/v1/roku/192.168.1.20/device?path=x"), client())).status).toBe(404);
  });

  it("accepts allowlisted commands and rejects unsupported commands", async () => {
    const roku = client();
    const accepted = await handleBridgeRequest(request("/v1/roku/192.168.1.20/keypress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "Home" }),
    }), roku);
    expect(accepted.status).toBe(204);
    expect(roku.sendKeypress).toHaveBeenCalledWith("192.168.1.20", "Home");

    const rejected = await handleBridgeRequest(request("/v1/roku/192.168.1.20/keypress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: "../../query/device-info" }),
    }), client());
    expect(rejected.status).toBe(400);
  });

  it("allows configured origins and rejects missing or foreign origins", async () => {
    const allowed = await handleBridgeRequest(request("/v1/roku/192.168.1.20/device"), client());
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    const url = "http://127.0.0.1:8787/v1/roku/192.168.1.20/device";
    expect((await handleBridgeRequest(new Request(url, { headers: { Origin: "https://malicious.example" } }), client())).status).toBe(403);
    expect((await handleBridgeRequest(new Request(url), client())).status).toBe(403);
  });

  it.each([
    [new RokuHttpError(403, "/keypress/Home"), 403, 403],
    [new RokuHttpError(500, "/keypress/Home"), 502, 500],
    [new DOMException("Aborted", "AbortError"), 504, undefined],
    [new RokuError("malformed_device_response", "Malformed synthetic XML"), 502, undefined],
  ])("maps Roku failures safely", async (error, bridgeStatus, rokuStatus) => {
    const response = await handleBridgeRequest(
      request("/v1/roku/192.168.1.20/device"),
      client({ queryDeviceInfo: vi.fn().mockRejectedValue(error) }),
    );
    expect(response.status).toBe(bridgeStatus);
    if (rokuStatus) expect(await response.json()).toMatchObject({ error: { rokuStatus } });
  });
});
