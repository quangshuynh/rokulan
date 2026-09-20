import { describe, expect, it } from "vitest";
import {
  RokuHttpError,
  classifyDeviceInfoError,
  classifyKeypressError,
} from "@/lib/roku/errors";

describe("error classification", () => {
  it("classifies request timeout", () => {
    const abortError = new DOMException("Aborted", "AbortError");
    expect(classifyDeviceInfoError(abortError).code).toBe("request_timeout");
  });

  it("classifies secure-context type errors as browser blocked", () => {
    expect(classifyDeviceInfoError(new TypeError("Failed to fetch"), { secureContext: true }).code).toBe(
      "browser_blocked",
    );
  });

  it("classifies keypress 403 as remote-control blocked", () => {
    const error = classifyKeypressError(new RokuHttpError(403, "/keypress/Home"));
    expect(error.code).toBe("http_403");
    expect(error.message).toMatch(/remote control is blocked/i);
  });
});
