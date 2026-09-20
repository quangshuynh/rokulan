import { describe, expect, it, vi } from "vitest";
import { createLocalBridgeClient } from "../local-bridge-client";

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
  });
});
