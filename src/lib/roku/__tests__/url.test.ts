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

  it("rejects paths outside the fixed ECP allowlist", () => {
    expect(() => buildRokuUrl("10.0.0.4", "/query/media-player" as never)).toThrowError(
      /unsupported/i,
    );
    expect(() => buildRokuUrl("10.0.0.4", "/keypress/Home?x=y" as never)).toThrowError(
      /unsupported/i,
    );
  });

  it("allows only validated app, launch, and literal keypress paths", () => {
    expect(buildRokuUrl("10.0.0.4", "/query/apps")).toBe("http://10.0.0.4:8060/query/apps");
    expect(buildRokuUrl("10.0.0.4", "/launch/12")).toBe("http://10.0.0.4:8060/launch/12");
    expect(buildRokuUrl("10.0.0.4", "/launch/tvinput.hdmi1")).toBe("http://10.0.0.4:8060/launch/tvinput.hdmi1");
    expect(buildRokuUrl("10.0.0.4", "/keypress/Lit_%E2%82%AC")).toBe("http://10.0.0.4:8060/keypress/Lit_%E2%82%AC");
    for (const path of [
      "/launch/../query/device-info",
      "/launch/12?x=1",
      "/launch/",
      "/keypress/Lit_ab",
      "/keypress/Lit_%2F..",
      "/keypress/Unknown",
      "/install/12",
      "/input?x=1",
    ]) {
      expect(() => buildRokuUrl("10.0.0.4", path as never)).toThrowError(/unsupported/i);
    }
  });

  it("rejects URL-shaped and public hosts", () => {
    expect(() => buildRokuBaseUrl("http://192.168.1.22")).toThrowError();
    expect(() => buildRokuBaseUrl("203.0.113.5")).toThrowError();
  });
});
