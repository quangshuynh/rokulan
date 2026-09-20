import { describe, expect, it } from "vitest";
import { SUPPORTED_COMMANDS, toKeypressPath } from "@/lib/roku/commands";

describe("command mapping", () => {
  it("maps command names to keypress paths", () => {
    expect(toKeypressPath("Home")).toBe("/keypress/Home");
    expect(toKeypressPath("VolumeMute")).toBe("/keypress/VolumeMute");
  });

  it("includes expected command set", () => {
    expect(SUPPORTED_COMMANDS).toContain("PowerOff");
    expect(SUPPORTED_COMMANDS).toContain("InstantReplay");
  });
});
