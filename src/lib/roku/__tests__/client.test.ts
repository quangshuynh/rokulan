import { describe, expect, it, vi } from "vitest";
import { createRokuClient } from "@/lib/roku/client";
import { RokuHttpError } from "@/lib/roku/errors";

describe("roku client", () => {
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
