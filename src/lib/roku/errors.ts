import { RokuError } from "../../types/roku";

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
  _options: { secureContext?: boolean } = {},
): RokuError {
  void _options;
  if (error instanceof RokuError) return error;

  if (error instanceof RokuHttpError && error.status === 403) {
    return new RokuError(
      "http_403",
      "Roku responded with HTTP 403 for device information.",
      error,
    );
  }

  if (error instanceof RokuHttpError) {
    return new RokuError(
      "not_roku",
      `A device responded with HTTP ${error.status}, but not with Roku device information.`,
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
    return new RokuError(
      "browser_blocked",
      "Direct browser access failed. The Roku may have responded but browser CORS or private-network policy can hide that response; the Roku may also be unreachable. Use the local bridge for compatible access.",
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

export type RokuOperation = "text" | "apps" | "launch";

const OPERATION_LABELS: Record<RokuOperation, string> = {
  text: "send text",
  apps: "load channels",
  launch: "launch the channel",
};

/** Classifies text-entry, channel-list, and launch failures without echoing user input. */
export function classifyOperationError(error: unknown, operation: RokuOperation): RokuError {
  if (error instanceof RokuError) return error;
  const label = OPERATION_LABELS[operation];
  const partial = operation === "text" ? " Some characters may already have been entered." : "";

  if (error instanceof RokuHttpError && error.status === 403) {
    return new RokuError(
      "http_403",
      `Roku blocked the request to ${label} (HTTP 403). Check the Roku network-control permission for mobile/network apps.${partial}`,
      error,
    );
  }

  if (error instanceof RokuHttpError) {
    return new RokuError(
      "unknown_error",
      `Roku could not ${label} (HTTP ${error.status}).${partial}`,
      error,
    );
  }

  if (isAbortError(error)) {
    return new RokuError(
      "disconnected_device",
      `The Roku stopped responding while trying to ${label}.${partial}`,
      error,
    );
  }

  if (error instanceof TypeError) {
    return new RokuError(
      "disconnected_device",
      `The Roku appears disconnected or unreachable, so RokuLAN could not ${label}.${partial}`,
      error,
    );
  }

  return new RokuError("unknown_error", `Unable to ${label}.${partial}`, error);
}
