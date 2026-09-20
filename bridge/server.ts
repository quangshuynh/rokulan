import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createDirectBrowserClient } from "../src/lib/roku/client";
import { DEFAULT_ALLOWED_ORIGINS, handleBridgeRequest } from "./app";

const HOST = "127.0.0.1";
const PORT = 8787;
const MAX_BODY_BYTES = 1024;

function configuredOrigins(): Set<string> {
  const configured = process.env.ROKULAN_ALLOWED_ORIGINS;
  return configured
    ? new Set(configured.split(",").map((value) => value.trim()).filter(Boolean))
    : new Set(DEFAULT_ALLOWED_ORIGINS);
}

async function toRequest(request: IncomingMessage): Promise<Request> {
  const host = request.headers.host;
  if (host !== `${HOST}:${PORT}` && host !== `localhost:${PORT}`) throw new Error("Invalid Host header.");
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new Error("Request body is too large.");
    chunks.push(buffer);
  }
  const method = request.method ?? "GET";
  return new Request(`http://${host}${request.url ?? "/"}`, {
    method,
    headers: request.headers as HeadersInit,
    body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
  });
}

async function writeResponse(response: ServerResponse, bridgeResponse: Response) {
  response.writeHead(bridgeResponse.status, Object.fromEntries(bridgeResponse.headers.entries()));
  response.end(Buffer.from(await bridgeResponse.arrayBuffer()));
}

const rokuClient = createDirectBrowserClient();
const allowedOrigins = configuredOrigins();
createServer(async (request, response) => {
  try {
    await writeResponse(response, await handleBridgeRequest(await toRequest(request), rokuClient, allowedOrigins));
  } catch {
    response.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ error: { code: "bad_request", message: "Invalid bridge request." } }));
  }
}).listen(PORT, HOST, () => {
  console.log(`RokuLAN bridge listening on http://${HOST}:${PORT}`);
});
