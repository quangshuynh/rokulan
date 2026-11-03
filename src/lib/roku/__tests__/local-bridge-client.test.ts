import { describe, expect, it, vi } from "vitest";
import { classifyDeviceInfoError, classifyKeypressError, RokuHttpError } from "../errors";
import { createLocalBridgeClient } from "../local-bridge-client";

function bridgeError(code: string, message: string, status = 502, rokuStatus?: number) {
  return new Response(JSON.stringify({ error: { code, message, ...(rokuStatus ? { rokuStatus } : {}) } }), { status });
}

describe("local bridge client", () => {
  it("uses semantic bridge endpoints", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ip: "192.168.1.20", friendlyName: "Synthetic Roku", modelName: "Synthetic Model", isTv: true,
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createLocalBridgeClient(fetchMock as typeof fetch);
    await client.queryDeviceInfo("192.168.1.20");
    await client.sendKeypress("192.168.1.20", "Home");
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:8787/v1/roku/192.168.1.20/device");
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "POST", body: '{"key":"Home"}' });
  });

  it("reports an unavailable bridge distinctly", async () => {
    const client = createLocalBridgeClient(vi.fn().mockRejectedValue(new TypeError("failed")));
    await expect(client.queryDeviceInfo("192.168.1.20")).rejects.toMatchObject({ code: "bridge_unavailable" });
    await expect(client.queryApps("192.168.1.20")).rejects.toMatchObject({ code: "bridge_unavailable" });
    await expect(client.sendText("192.168.1.20", "a")).rejects.toMatchObject({ code: "bridge_unavailable" });
  });

  it("sends text, app, and launch requests only to semantic loopback operations", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [{ id: "12", name: "Synthetic", type: "appl" }] })))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    const client = createLocalBridgeClient(fetchMock as typeof fetch);

    await client.sendText("192.168.1.20", "Café 🎬");
    await expect(client.queryApps("192.168.1.20")).resolves.toEqual([{ id: "12", name: "Synthetic", type: "appl" }]);
    await client.launchApp("192.168.1.20", "12");

    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://127.0.0.1:8787/v1/roku/192.168.1.20/text",
      "http://127.0.0.1:8787/v1/roku/192.168.1.20/apps",
      "http://127.0.0.1:8787/v1/roku/192.168.1.20/launch",
    ]);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Café 🎬" }),
    });
    expect(fetchMock.mock.calls[2][1]).toMatchObject({ method: "POST", body: '{"appId":"12"}' });
    for (const [url] of fetchMock.mock.calls) expect(new URL(url).host).toBe("127.0.0.1:8787");
  });

  it("rejects invalid text and app IDs before contacting the bridge", async () => {
    const fetchMock = vi.fn();
    const client = createLocalBridgeClient(fetchMock as typeof fetch);
    await expect(client.sendText("192.168.1.20", "")).rejects.toMatchObject({ code: "invalid_text" });
    await expect(client.launchApp("192.168.1.20", "../device")).rejects.toMatchObject({ code: "invalid_app_id" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sanitizes untrusted bridge payloads", async () => {
    const client = createLocalBridgeClient(vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ apps: [{ id: "../x", name: "Bad" }, { id: "5", name: "Ok", type: "appl" }] })))
      .mockResolvedValueOnce(new Response("not json"))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        ip: "192.168.1.20", friendlyName: "R", modelName: "M", isTv: false, capabilities: { tv: "bogus" },
      }))) as typeof fetch);
    await expect(client.queryApps("192.168.1.20")).resolves.toEqual([{ id: "5", name: "Ok", type: "appl" }]);
    await expect(client.queryApps("192.168.1.20")).rejects.toMatchObject({ code: "malformed_apps_response" });
    await expect(client.queryDeviceInfo("192.168.1.20")).resolves.toMatchObject({
      capabilities: { tv: "unknown", findRemote: "unknown" },
    });
  });

  it("preserves Roku HTTP status and redacts text paths", async () => {
    const client = createLocalBridgeClient(vi.fn().mockResolvedValue(bridgeError("roku_http_error", "Roku returned HTTP 403.", 403, 403)));
    const error = await client.sendText("192.168.1.20", "secret").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RokuHttpError);
    expect((error as RokuHttpError).status).toBe(403);
    expect((error as RokuHttpError).message).not.toContain("secret");
  });

  // Regression: bridge error codes were previously discarded, so malformed or
  // non-Roku responses surfaced as "Unknown connection error."
  it.each([
    ["malformed_device_response", "malformed_device_response"],
    ["not_roku", "not_roku"],
    ["request_timeout", "request_timeout"],
    ["roku_unreachable", "device_unreachable"],
  ])("maps bridge error %s into the shared error model", async (bridgeCode, code) => {
    const client = createLocalBridgeClient(vi.fn().mockResolvedValue(bridgeError(bridgeCode, "Synthetic bridge message.")) as typeof fetch);
    const error = await client.queryDeviceInfo("192.168.1.20").catch((caught: unknown) => caught);
    expect(classifyDeviceInfoError(error)).toMatchObject({ code, message: "Synthetic bridge message." });
  });

  it("explains when a stale bridge does not support a new operation", async () => {
    const client = createLocalBridgeClient(vi.fn().mockResolvedValue(bridgeError("not_found", "Unsupported bridge operation.", 404)) as typeof fetch);
    const error = await client.queryApps("192.168.1.20").catch((caught: unknown) => caught);
    expect(classifyKeypressError(error)).toMatchObject({ code: "bridge_unavailable", message: expect.stringMatching(/rebuild/i) });
  });
});
