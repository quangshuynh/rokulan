# RokuLAN

A responsive, open-source web remote for manually connecting to and controlling Roku devices on your local network.

> RokuLAN is an independent project and is not affiliated with, endorsed by, or sponsored by Roku, Inc.

## Screenshots

- _Placeholder: add connection and remote screenshots here._

## Current capabilities

- Manual Roku connection via private/local IPv4 entry
- Typed Roku ECP device-info query (`GET /query/device-info`)
- Responsive remote UI with touch-friendly controls
- Saved-device management in browser localStorage (reconnect + remove)
- Keyboard shortcuts on desktop (arrows, Enter, Escape/Backspace)
- Distinct handling for malformed and non-private IPs, timeout, unreachable, malformed/non-Roku responses, ambiguous browser blocking, disconnections, and HTTP 403 command blocking
- A minimal loopback-only Node/TypeScript bridge for browser-compatible local ECP access
- Direct browser transport retained as an experimental diagnostic mode

## Architecture

```text
src/
  app/
  features/
    connection/
    discovery/
    remote/
  lib/
    network/
    roku/
    storage/
  types/
bridge/
  app.ts
  server.ts
```

- `lib/roku`: transport-neutral client interface, direct and local-bridge clients, command mapping, URL construction, XML parsing, and error classification
- `bridge`: narrow loopback service that performs allowlisted Roku ECP operations outside the browser sandbox
- `features/discovery`: discovery abstraction (`DiscoveryProvider`) with an honest browser implementation explaining limitations
- `lib/storage`: versioned browser persistence for saved Roku devices
- `app/page.tsx`: orchestration between connection flow and remote control UI

## Roku ECP communication

Roku devices expose ECP on the local network, typically:

- `http://<roku-ip>:8060/query/device-info`
- `http://<roku-ip>:8060/keypress/<key>`

The UI depends only on the typed `RokuClient` interface. It can use the recommended local-bridge client or the experimental direct-browser client without duplicating domain or command logic.

The recommended local-bridge path has completed a successful end-to-end test with real Roku hardware: browser UI to loopback bridge to Roku ECP. On that tested setup, the bridge resolved the CORS limitation that prevented direct browser JavaScript from reading Roku responses. This is one sanitized hardware result, not a claim of universal browser, platform, firmware, or model compatibility.

## Browser/LAN limitations

RokuLAN uses a browser UI with a small local companion bridge. It does **not** route private Roku IPs through a cloud backend. Direct browser ECP remains available only as an experimental diagnostic transport.

Important constraints:

- Vercel cannot directly access devices on a user private LAN
- Browser sandboxing does not provide UDP multicast sockets for SSDP discovery
- An HTTPS deployment sends ECP requests from the browser to an HTTP device; mixed-content, CORS, and Private Network Access policy may prevent the request
- Browser `fetch` often reports these policy failures and an unreachable device with the same opaque `TypeError`, so RokuLAN cannot always identify the exact cause
- Direct browser-to-Roku JavaScript communication is not reliable in the tested configuration because Roku did not provide CORS permission

### Sanitized hardware finding

On one real Roku TV/browser configuration, with identifying values removed:

1. `curl` received HTTP 200 and valid XML from `http://<ROKU_PRIVATE_IP>:8060/query/device-info`.
2. `curl -X POST` to `/keypress/Home` received HTTP 200 and the command worked while ECP control was permissive.
3. A previous restricted configuration returned HTTP 403 for the command; successful device identification and command authorization remain separate states.
4. Direct browser navigation displayed device-info XML.
5. JavaScript `fetch` from `http://localhost:3000` reached the Roku and DevTools showed HTTP 200, but the response omitted `Access-Control-Allow-Origin`.
6. The browser prevented JavaScript from reading the response and surfaced `ERR_FAILED 200 (OK)`.

This proves the local process-to-Roku path for that setup and demonstrates a concrete CORS failure for browser JavaScript. It does not establish behavior across all Roku models, firmware, browsers, HTTPS deployments, or future Private Network Access policy.

### Why SSDP discovery is limited in browsers

Roku discovery commonly uses SSDP over UDP multicast (`239.255.255.250:1900`). Standard web pages do not have direct UDP socket/multicast access, so reliable in-browser SSDP discovery is not generally possible without additional platform-specific capabilities.

## Manual connection

1. Open RokuLAN in a browser on the same LAN as your Roku device.
2. Enter the Roku IPv4 address in `10.0.0.0/8`, `172.16.0.0/12`, or `192.168.0.0/16` (for example `192.168.1.12`). Localhost, link-local, public IPs, URLs, and paths are rejected.
3. Build and start the local bridge in a separate terminal with `npm run bridge:build` and `npm run bridge:start`.
4. Keep **Local bridge (recommended)** selected and connect. Direct browser mode is for diagnostics only.
5. After successful device identification, RokuLAN stores the device in local browser storage for quick reconnect.

## Privacy model

- Roku IP addresses are treated as local-only data.
- Saved device entries are stored in browser localStorage.
- No accounts, analytics, telemetry, or database storage.
- No private network requests are proxied through RokuLAN servers.
- The selected private IP is sent only to the loopback bridge, which uses it for the requested local ECP operation.

## Security model

- Accepts only the three RFC 1918 private IPv4 ranges for this milestone.
- Prevents arbitrary URL injection by constructing only allowlisted device-info and keypress ECP endpoints.
- Treats local IP input as untrusted.
- No secrets are required for this project.
- The bridge binds to `127.0.0.1`, validates Host and exact Origin values, permits only two semantic operations, requires JSON for keypresses, limits request/response sizes, and reuses the RFC 1918 and command allowlists.

See [Local bridge architecture and threat model](docs/local-bridge.md) for the API, configuration, and residual risks.
See [Zero-clone distribution and mobile architecture](docs/distribution-architecture.md) for current browser/Roku constraints, candidate models, and the manual test matrix.

## Local development

```bash
npm install
npm run dev
npm run bridge:build
npm run bridge:start
```

Open `http://localhost:3000`.

## Testing and validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run bridge:build
npm audit
```

## Deployment (Vercel)

The web UI is deployable to Vercel, but Vercel cannot reach a user's LAN. A deployed origin must be explicitly added to `ROKULAN_ALLOWED_ORIGINS` for the local bridge, and HTTPS-page-to-loopback behavior still needs real-browser validation.

## Troubleshooting

### Device found but controls return 403

If `GET /query/device-info` succeeds but `POST /keypress/<key>` returns HTTP 403, Roku is reachable but command authorization is blocked.

Check Roku settings related to control from mobile/network applications and allow network control where appropriate.

RokuLAN keeps the successfully identified device connected and shows a restricted-control notice. It does not attempt to bypass Roku security settings.

### Browser blocked local request

Use the local bridge transport. Direct mode may expose the same generic failure for CORS, HTTPS-to-HTTP policy, Private Network Access, and an unreachable device. `mode: "no-cors"` cannot expose device-info or status and is not a solution. This is intentionally not solved with a cloud proxy: Vercel is outside the private LAN, and a generic proxy would create an SSRF risk and disclose the Roku IP to a backend.

### Device unreachable

Verify the Roku IP address, LAN connectivity, and that the Roku is powered and connected.

## Roadmap

- Bridge packaging and a pairing/authorization design suitable for broader distribution
- SSDP discovery through the local bridge, where UDP multicast is available
- Installable PWA experience
- App/channel launcher
- Improved multi-device workflows
- TV input controls
- Text entry support
- Wake/advanced ECP behaviors where supported

## Contributing

Contributions are welcome. Please run lint, typecheck, tests, and build before opening a PR.

## License

MIT (see `LICENSE`).

## Trademark / non-affiliation notice

RokuLAN is an independent project and is not affiliated with, endorsed by, or sponsored by Roku, Inc. Roku and related marks are the property of their respective owners.
