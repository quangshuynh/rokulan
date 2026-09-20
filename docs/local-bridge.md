# Local bridge architecture and threat model

## Purpose

The RokuLAN bridge is a narrow local companion for the web UI. It sends Roku ECP requests from a normal local process, where Roku responses are not hidden by browser CORS enforcement. It is not a generic HTTP proxy.

```text
RokuLAN web UI -> http://127.0.0.1:8787 -> http://<validated-private-ip>:8060
```

The current dependency-free Node/TypeScript foundation is intended for development and architecture validation. It does not include an installer, background startup, service manager, tray UI, auto-update, SSDP, or native GUI.

## API

- `GET /v1/roku/<validated-ip>/device` performs only `GET /query/device-info` and returns the small typed Roku device model.
- `POST /v1/roku/<validated-ip>/keypress` accepts only JSON shaped as `{ "key": <allowlisted Roku command> }` and performs only the corresponding `POST /keypress/<key>`.
- `OPTIONS` supports browser preflight only after the request Origin is accepted.

Protocols, ports, URLs, arbitrary paths, query strings, public IPs, localhost targets, link-local targets, and unknown commands are rejected. Roku requests use a five-second timeout and responses are limited to 1 MiB. Browser request bodies are limited to 1 KiB. XML is parsed by the existing bounded domain parser, which rejects DTD/entity declarations and retains no sensitive hardware identifiers.

## Local startup and origins

```bash
npm run bridge:build
npm run bridge:start
```

The service binds only to `127.0.0.1:8787`. Its default exact Origin allowlist is:

- `http://localhost:3000`
- `http://127.0.0.1:3000`

Override the complete list with a comma-separated environment variable before starting the bridge:

```text
ROKULAN_ALLOWED_ORIGINS=https://your-exact-ui-origin.example
```

The bridge reflects `Access-Control-Allow-Origin` only for an exact allowed Origin, never uses `*`, rejects missing origins, validates the loopback Host header, allows only `GET`, JSON `POST`, and preflight, and sends `no-store` responses. Requiring `application/json` makes keypress requests preflighted, so an ordinary unapproved website cannot issue them through a simple HTML form.

## Threat model and residual risk

Loopback binding prevents other LAN hosts from connecting but does not make the service inherently trusted. A malicious website can attempt requests to localhost. Exact Origin validation and preflight protect against ordinary browser-based cross-origin command attempts. Host validation reduces DNS-rebinding exposure. The semantic API and independent private-IP/command validation constrain impact even if a request reaches the service.

Origin is a browser security signal, not authentication: non-browser local processes and privileged extensions can forge it. A compromised allowed origin can use the bridge. Environment configuration can also accidentally allow an untrusted origin. Before distributing an always-running packaged bridge, RokuLAN should evaluate a pairing or per-install authorization mechanism, origin lifecycle, HTTPS-page-to-loopback behavior, DNS rebinding across target browsers, and safe update/install practices. The current bridge should be run only when needed.

The bridge logs only its loopback listening address at startup. It does not persist Roku data, send telemetry, use accounts, or log device responses. A future local process could legitimately implement SSDP using UDP multicast, but discovery is intentionally outside this milestone.
