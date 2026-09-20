import { RokuError } from "@/types/roku";

export class RokuHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    public readonly body?: string,
  ) {
    super(`Roku request failed with HTTP ${status} (${path})`);
    this.name = "RokuHttpError";
  }
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException
      ? error.name === "AbortError"
      : error instanceof Error && error.name === "AbortError"
  );
}

export function classifyDeviceInfoError(
  error: unknown,
  options: { secureContext?: boolean } = {},
): RokuError {
  if (error instanceof RokuError) return error;

  if (error instanceof RokuHttpError && error.status === 403) {
    return new RokuError(
      "http_403",
      "Roku responded with HTTP 403 for device information.",
      error,
    );
  }

  if (isAbortError(error)) {
    return new RokuError(
      "request_timeout",
      "Timed out while contacting the Roku device.",
      error,
    );
  }

  if (error instanceof TypeError) {
    if (options.secureContext) {
      return new RokuError(
        "browser_blocked",
        "Your browser blocked the private-network request. Try another browser/device or connect over HTTP in local development.",
        error,
      );
    }

    return new RokuError(
      "device_unreachable",
      "Could not reach the Roku at that IP address.",
      error,
    );
  }

  return new RokuError("unknown_error", "Unknown connection error.", error);
}

export function classifyKeypressError(error: unknown): RokuError {
  if (error instanceof RokuError) return error;

  if (error instanceof RokuHttpError && error.status === 403) {
    return new RokuError(
      "http_403",
      "Roku found, but remote control is blocked. Check the Roku network-control permission for mobile/network apps.",
      error,
    );
  }

  if (isAbortError(error)) {
    return new RokuError(
      "disconnected_device",
      "The Roku stopped responding while sending a command.",
      error,
    );
  }

  if (error instanceof TypeError) {
    return new RokuError(
      "disconnected_device",
      "The Roku appears disconnected or unreachable.",
      error,
    );
  }

  return new RokuError("unknown_error", "Unknown remote-control error.", error);
}
