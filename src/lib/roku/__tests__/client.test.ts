import { describe, expect, it, vi } from "vitest";
import { createRokuClient } from "@/lib/roku/client";
import { RokuHttpError } from "@/lib/roku/errors";

describe("roku client", () => {
  it("queries and parses device information", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        "<device-info><vendor-name>Roku</vendor-name><friendly-device-name>Test Roku</friendly-device-name><model-name>Test Model</model-name><is-tv>false</is-tv></device-info>",
    });

    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await expect(client.queryDeviceInfo("192.168.1.50")).resolves.toMatchObject({
      friendlyName: "Test Roku",
      modelName: "Test Model",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://192.168.1.50:8060/query/device-info",
      expect.objectContaining({ method: "GET", signal: expect.any(AbortSignal) }),
    );
  });

  it("uses keypress endpoint for commands", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "",
    });

    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await client.sendKeypress("192.168.1.50", "Home");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://192.168.1.50:8060/keypress/Home",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws RokuHttpError for 403 keypress responses", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "forbidden",
    });

    const client = createRokuClient(fetchMock as unknown as typeof fetch);

    await expect(client.sendKeypress("192.168.1.50", "Home")).rejects.toBeInstanceOf(RokuHttpError);
  });
});

describe("direct client text, apps, and launch", () => {
  const ok = () => ({ ok: true, text: async () => "" });

  it("sends each code point as an encoded Lit_ keypress in order", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await client.sendText("192.168.1.50", "a é/🎬");
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual([
      "http://192.168.1.50:8060/keypress/Lit_a",
      "http://192.168.1.50:8060/keypress/Lit_%20",
      "http://192.168.1.50:8060/keypress/Lit_%C3%A9",
      "http://192.168.1.50:8060/keypress/Lit_%2F",
      "http://192.168.1.50:8060/keypress/Lit_%F0%9F%8E%AC",
    ]);
    expect(fetchMock.mock.calls.every((call) => call[1].method === "POST")).toBe(true);
  });

  it("validates the whole string before sending anything", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await expect(client.sendText("192.168.1.50", "ok\u0000")).rejects.toMatchObject({ code: "invalid_text" });
    await expect(client.sendText("192.168.1.50", "")).rejects.toMatchObject({ code: "invalid_text" });
    await expect(client.sendText("192.168.1.50", "x".repeat(129))).rejects.toMatchObject({ code: "invalid_text" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("stops at the first failure and redacts text from HTTP errors", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(ok())
      .mockResolvedValueOnce({ ok: false, status: 403, text: async () => "forbidden" });
    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    const error = await client.sendText("192.168.1.50", "pw123").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RokuHttpError);
    expect((error as RokuHttpError).message).not.toMatch(/Lit_w|pw/);
    expect((error as RokuHttpError).path).toBe("/keypress/Lit_<redacted>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("queries and parses installed apps", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => '<apps><app id="12" type="appl" version="1">Synthetic</app></apps>',
    });
    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await expect(client.queryApps("192.168.1.50")).resolves.toEqual([{ id: "12", name: "Synthetic", type: "appl" }]);
    expect(fetchMock).toHaveBeenCalledWith("http://192.168.1.50:8060/query/apps", expect.objectContaining({ method: "GET" }));
  });

  it("surfaces malformed app XML through the shared error model", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "<html>captive portal</html>" });
    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await expect(client.queryApps("192.168.1.50")).rejects.toMatchObject({ code: "malformed_apps_response" });
  });

  it("launches validated app IDs and rejects others without a request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await client.launchApp("192.168.1.50", "12");
    expect(fetchMock).toHaveBeenCalledWith("http://192.168.1.50:8060/launch/12", expect.objectContaining({ method: "POST" }));
    await expect(client.launchApp("192.168.1.50", "../keypress/Home")).rejects.toMatchObject({ code: "invalid_app_id" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("only contacts the validated private Roku host", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "<apps/>" });
    const client = createRokuClient(fetchMock as unknown as typeof fetch);
    await client.queryApps("10.1.2.3");
    await client.launchApp("10.1.2.3", "12");
    await client.sendText("10.1.2.3", "a");
    await client.sendKeypress("10.1.2.3", "Backspace");
    for (const [url] of fetchMock.mock.calls) expect(new URL(url).host).toBe("10.1.2.3:8060");
    await expect(client.queryApps("8.8.8.8")).rejects.toThrow();
  });
});
