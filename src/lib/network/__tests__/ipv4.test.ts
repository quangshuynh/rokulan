import { describe, expect, it } from "vitest";
import {
  isPrivateOrLocalIPv4,
  isValidIPv4,
  normalizePrivateIPv4,
} from "@/lib/network/ipv4";

describe("ipv4 validation", () => {
  it("validates ipv4 format", () => {
    expect(isValidIPv4("192.168.1.12")).toBe(true);
    expect(isValidIPv4("256.1.1.1")).toBe(false);
    expect(isValidIPv4("1.2.3")).toBe(false);
  });

  it("accepts only private/local addresses", () => {
    expect(isPrivateOrLocalIPv4("10.0.0.2")).toBe(true);
    expect(isPrivateOrLocalIPv4("172.20.1.2")).toBe(true);
    expect(isPrivateOrLocalIPv4("192.168.1.2")).toBe(true);
    expect(isPrivateOrLocalIPv4("8.8.8.8")).toBe(false);
  });

  it("throws for non-private values", () => {
    expect(() => normalizePrivateIPv4("8.8.8.8")).toThrowError();
  });
});
