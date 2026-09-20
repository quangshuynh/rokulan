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
    expect(isPrivateOrLocalIPv4("127.0.0.1")).toBe(false);
    expect(isPrivateOrLocalIPv4("169.254.1.2")).toBe(false);
    expect(isPrivateOrLocalIPv4("172.15.255.255")).toBe(false);
    expect(isPrivateOrLocalIPv4("172.32.0.0")).toBe(false);
  });

  it("distinguishes malformed and non-private values", () => {
    try {
      normalizePrivateIPv4("http://192.168.1.2/path");
      throw new Error("Expected invalid input to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "invalid_ip" });
    }

    try {
      normalizePrivateIPv4("8.8.8.8");
      throw new Error("Expected public input to throw");
    } catch (error) {
      expect(error).toMatchObject({ code: "non_private_ip" });
    }
  });

  it("trims a valid private address", () => {
    expect(normalizePrivateIPv4(" 192.168.1.12 ")).toBe("192.168.1.12");
  });
});
