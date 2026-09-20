import { normalizePrivateIPv4 } from "../src/lib/network/ipv4";
import type { RokuClient } from "../src/lib/roku/client";
import { isRokuCommand } from "../src/lib/roku/commands";
import { RokuHttpError } from "../src/lib/roku/errors";
import { RokuError } from "../src/types/roku";

export const DEFAULT_ALLOWED_ORIGINS = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);
const MAX_BODY_BYTES = 1024;

function json(body: unknown, status: number, origin?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function failure(code: string, message: string, status: number, origin?: string, rokuStatus?: number) {
  return json({ error: { code, message, ...(rokuStatus ? { rokuStatus } : {}) } }, status, origin);
}

export async function handleBridgeRequest(
  request: Request,
  client: RokuClient,
  allowedOrigins: ReadonlySet<string> = DEFAULT_ALLOWED_ORIGINS,
): Promise<Response> {
  const origin = request.headers.get("Origin") ?? undefined;
  if (!origin || !allowedOrigins.has(origin)) {
    return failure("origin_forbidden", "Origin is not allowed by the RokuLAN bridge.", 403);
  }

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      },
    });
  }

  const url = new URL(request.url);
  const match = /^\/v1\/roku\/([^/]+)\/(device|keypress)$/.exec(url.pathname);
  if (!match || url.search) return failure("not_found", "Unsupported bridge operation.", 404, origin);

  let ip: string;
  try {
    ip = normalizePrivateIPv4(decodeURIComponent(match[1]));
  } catch (error) {
    return failure("invalid_ip", error instanceof Error ? error.message : "Invalid Roku IP.", 400, origin);
  }

  try {
    if (match[2] === "device" && request.method === "GET") {
      return json(await client.queryDeviceInfo(ip), 200, origin);
    }
    if (match[2] === "keypress" && request.method === "POST") {
      if (request.headers.get("Content-Type")?.split(";", 1)[0].trim() !== "application/json") {
        return failure("unsupported_media_type", "Content-Type must be application/json.", 415, origin);
      }
      const bodyText = await request.text();
      if (new TextEncoder().encode(bodyText).byteLength > MAX_BODY_BYTES) {
        return failure("body_too_large", "Request body is too large.", 413, origin);
      }
      let body: unknown;
      try {
        body = JSON.parse(bodyText);
      } catch {
        return failure("invalid_json", "Request body must be valid JSON.", 400, origin);
      }
      const key = typeof body === "object" && body !== null && "key" in body ? body.key : undefined;
      if (!isRokuCommand(key)) {
        return failure("unsupported_command", "Unsupported Roku command.", 400, origin);
      }
      await client.sendKeypress(ip, key);
      return new Response(null, {
        status: 204,
        headers: { "Access-Control-Allow-Origin": origin, Vary: "Origin", "Cache-Control": "no-store" },
      });
    }
    return failure("method_not_allowed", "Method is not allowed for this operation.", 405, origin);
  } catch (error) {
    if (error instanceof RokuHttpError) {
      return failure("roku_http_error", `Roku returned HTTP ${error.status}.`, error.status === 403 ? 403 : 502, origin, error.status);
    }
    if (error instanceof RokuError) return failure(error.code, error.message, 502, origin);
    if (error instanceof Error && error.name === "AbortError") {
      return failure("request_timeout", "Timed out while contacting the Roku.", 504, origin);
    }
    return failure("roku_unreachable", "The bridge could not complete the Roku request.", 502, origin);
  }
}
