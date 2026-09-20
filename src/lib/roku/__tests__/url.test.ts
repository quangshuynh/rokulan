import { describe, expect, it } from "vitest";
import { buildRokuBaseUrl, buildRokuUrl } from "@/lib/roku/url";

describe("roku url construction", () => {
  it("builds base URL from a private ip", () => {
    expect(buildRokuBaseUrl("192.168.1.22")).toBe("http://192.168.1.22:8060");
  });

  it("builds full endpoint URL", () => {
    expect(buildRokuUrl("10.0.0.4", "/query/device-info")).toBe(
      "http://10.0.0.4:8060/query/device-info",
    );
  });

  it("rejects non-leading slash paths", () => {
    expect(() => buildRokuUrl("10.0.0.4", "query/device-info")).toThrowError();
  });
});
