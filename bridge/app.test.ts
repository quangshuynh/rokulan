import { afterEach, describe, expect, it, vi } from "vitest";
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
    sendText: vi.fn().mockResolvedValue(undefined),
    queryApps: vi.fn().mockResolvedValue([]),
    launchApp: vi.fn().mockResolvedValue(undefined),
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

function postJson(path: string, body: unknown, headers: Record<string, string> = {}) {
  return request(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("local bridge text entry", () => {
  afterEach(() => vi.restoreAllMocks());

  it("routes validated Unicode text to the typed client", async () => {
    const roku = client();
    const response = await handleBridgeRequest(postJson("/v1/roku/192.168.1.20/text", { text: "Café & ☕ 🎬" }), roku);
    expect(response.status).toBe(204);
    expect(roku.sendText).toHaveBeenCalledWith("192.168.1.20", "Café & ☕ 🎬");
  });

  it.each([
    [{ text: "" }, "invalid_text"],
    [{ text: 42 }, "invalid_text"],
    [{}, "invalid_text"],
    [{ text: "line\nbreak" }, "invalid_text"],
    [{ text: "x".repeat(129) }, "invalid_text"],
    [["text"], "invalid_json"],
    ["{not json", "invalid_json"],
  ])("rejects malformed text request %#", async (body, code) => {
    const roku = client();
    const response = await handleBridgeRequest(postJson("/v1/roku/192.168.1.20/text", body), roku);
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(roku.sendText).not.toHaveBeenCalled();
  });

  it("requires JSON, POST, and the existing body size limit", async () => {
    const roku = client();
    expect((await handleBridgeRequest(request("/v1/roku/192.168.1.20/text", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ text: "hi" }),
    }), roku)).status).toBe(415);
    expect((await handleBridgeRequest(request("/v1/roku/192.168.1.20/text"), roku)).status).toBe(405);
    expect((await handleBridgeRequest(postJson("/v1/roku/192.168.1.20/text", { text: "a", pad: "x".repeat(1100) }), roku)).status).toBe(413);
    expect(roku.sendText).not.toHaveBeenCalled();
  });

  it("never echoes or logs submitted text in failures", async () => {
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const secret = "hunter2-secret";
    const invalid = await handleBridgeRequest(postJson("/v1/roku/192.168.1.20/text", { text: `${secret}\u0007` }), client());
    const failed = await handleBridgeRequest(
      postJson("/v1/roku/192.168.1.20/text", { text: secret }),
      client({ sendText: vi.fn().mockRejectedValue(new RokuHttpError(403, "/keypress/Lit_<redacted>")) }),
    );
    expect(failed.status).toBe(403);
    expect(await invalid.text()).not.toContain(secret);
    expect(await failed.text()).not.toContain(secret);
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });
});

describe("local bridge channel operations", () => {
  it("returns typed apps from GET /apps only", async () => {
    const apps = [{ id: "12", name: "Synthetic Channel", type: "appl" }];
    const roku = client({ queryApps: vi.fn().mockResolvedValue(apps) });
    const response = await handleBridgeRequest(request("/v1/roku/192.168.1.20/apps"), roku);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ apps });
    expect((await handleBridgeRequest(postJson("/v1/roku/192.168.1.20/apps", {}), roku)).status).toBe(405);
    expect((await handleBridgeRequest(request("/v1/roku/192.168.1.20/apps?all=1"), roku)).status).toBe(404);
  });

  it("launches only validated channel identifiers", async () => {
    const roku = client();
    expect((await handleBridgeRequest(postJson("/v1/roku/192.168.1.20/launch", { appId: "12" }), roku)).status).toBe(204);
    expect(roku.launchApp).toHaveBeenCalledWith("192.168.1.20", "12");

    for (const appId of ["../query/device-info", "12?x=1", "http://example.test", "", 12, "tvinput.hdmi1/../x", null]) {
      const response = await handleBridgeRequest(postJson("/v1/roku/192.168.1.20/launch", { appId }), roku);
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: { code: "invalid_app_id" } });
    }
    expect(roku.launchApp).toHaveBeenCalledTimes(1);
  });

  it.each([
    [new RokuHttpError(404, "/launch/12"), 502, "roku_http_error"],
    [new RokuHttpError(403, "/launch/12"), 403, "roku_http_error"],
    [new TypeError("fetch failed"), 502, "roku_unreachable"],
    [new DOMException("Aborted", "AbortError"), 504, "request_timeout"],
  ])("maps launch failures safely", async (error, status, code) => {
    const response = await handleBridgeRequest(
      postJson("/v1/roku/192.168.1.20/launch", { appId: "12" }),
      client({ launchApp: vi.fn().mockRejectedValue(error) }),
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });

  it("maps malformed app lists through the shared error model", async () => {
    const response = await handleBridgeRequest(
      request("/v1/roku/192.168.1.20/apps"),
      client({ queryApps: vi.fn().mockRejectedValue(new RokuError("malformed_apps_response", "Bad list")) }),
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: { code: "malformed_apps_response" } });
  });

  it("keeps rejecting unknown operations, unsafe targets, and foreign origins", async () => {
    const roku = client();
    for (const path of ["/v1/roku/192.168.1.20/query/apps", "/v1/roku/192.168.1.20/launch/12", "/v1/roku/192.168.1.20/icon"]) {
      expect((await handleBridgeRequest(request(path), roku)).status).toBe(404);
    }
    expect((await handleBridgeRequest(postJson("/v1/roku/8.8.8.8/launch", { appId: "12" }), roku)).status).toBe(400);
    expect((await handleBridgeRequest(new Request("http://127.0.0.1:8787/v1/roku/192.168.1.20/apps", {
      headers: { Origin: "https://malicious.example" },
    }), roku)).status).toBe(403);
    expect(roku.queryApps).not.toHaveBeenCalled();
    expect(roku.launchApp).not.toHaveBeenCalled();
  });
});
