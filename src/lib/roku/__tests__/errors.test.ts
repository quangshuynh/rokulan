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
    const error = classifyDeviceInfoError(new TypeError("Failed to fetch"), { secureContext: true });
    expect(error.code).toBe("browser_blocked");
    expect(error.message).toMatch(/CORS|private-network/i);
  });

  it("does not misreport opaque direct fetch failures as unreachable", () => {
    const error = classifyDeviceInfoError(new TypeError("Failed to fetch"));
    expect(error.code).toBe("browser_blocked");
    expect(error.message).toMatch(/may have responded/i);
  });

  it("classifies non-success device-info HTTP responses as not Roku", () => {
    expect(classifyDeviceInfoError(new RokuHttpError(404, "/query/device-info")).code).toBe(
      "not_roku",
    );
  });

  it("classifies keypress 403 as remote-control blocked", () => {
    const error = classifyKeypressError(new RokuHttpError(403, "/keypress/Home"));
    expect(error.code).toBe("http_403");
    expect(error.message).toMatch(/remote control is blocked/i);
  });

  it("classifies aborted and failed commands as disconnected", () => {
    expect(classifyKeypressError(new DOMException("Aborted", "AbortError")).code).toBe(
      "disconnected_device",
    );
    expect(classifyKeypressError(new TypeError("Failed to fetch")).code).toBe(
      "disconnected_device",
    );
  });
});

describe("operation error classification", () => {
  it("classifies 403 for text, apps, and launch as blocked", async () => {
    const { classifyOperationError } = await import("@/lib/roku/errors");
    for (const operation of ["text", "apps", "launch"] as const) {
      const error = classifyOperationError(new RokuHttpError(403, "/x"), operation);
      expect(error.code).toBe("http_403");
      expect(error.message).toMatch(/HTTP 403/);
    }
  });

  it("classifies launch HTTP failures, timeouts, and offline devices", async () => {
    const { classifyOperationError } = await import("@/lib/roku/errors");
    expect(classifyOperationError(new RokuHttpError(404, "/launch/12"), "launch").message).toMatch(/launch.*HTTP 404/);
    expect(classifyOperationError(new DOMException("Aborted", "AbortError"), "apps").code).toBe("disconnected_device");
    expect(classifyOperationError(new TypeError("Failed to fetch"), "launch").code).toBe("disconnected_device");
    expect(classifyOperationError(new TypeError("Failed to fetch"), "text").message).toMatch(/partially|may already/i);
  });
});
