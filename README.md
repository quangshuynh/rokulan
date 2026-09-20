# RokuLAN

A responsive, open-source web remote for discovering and controlling Roku devices on your local network.

> RokuLAN is an independent project and is not affiliated with, endorsed by, or sponsored by Roku, Inc.

## Screenshots

- _Placeholder: add connection and remote screenshots here._

## Current capabilities

- Manual Roku connection via private/local IPv4 entry
- Typed Roku ECP device-info query (`GET /query/device-info`)
- Responsive remote UI with touch-friendly controls
- Saved-device management in browser localStorage (reconnect + remove)
- Keyboard shortcuts on desktop (arrows, Enter, Escape/Backspace)
- Clear error handling for invalid IP, timeout, unreachable, malformed/non-Roku responses, browser blocking, disconnections, and HTTP 403 command blocking

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
```

- `lib/roku`: typed Roku client, command mapping, URL construction, XML parsing, and error classification
- `features/discovery`: discovery abstraction (`DiscoveryProvider`) with an honest browser implementation explaining limitations
- `lib/storage`: versioned browser persistence for saved Roku devices
- `app/page.tsx`: orchestration between connection flow and remote control UI

## Roku ECP communication

Roku devices expose ECP on the local network, typically:

- `http://<roku-ip>:8060/query/device-info`
- `http://<roku-ip>:8060/keypress/<key>`

RokuLAN keeps this networking in a dedicated typed client abstraction (`createRokuClient`) so future strategies can be added without spreading raw requests through the UI.

## Browser/LAN limitations

RokuLAN is designed for browser-to-LAN communication. It does **not** route private Roku IPs through a cloud backend.

Important constraints:

- Vercel cannot directly access devices on a user private LAN
- Browser sandboxing does not provide UDP multicast sockets for SSDP discovery
- HTTPS pages may face additional private-network restrictions depending on browser/network policy
- Some browsers/environments may block direct local IP requests entirely

### Why SSDP discovery is limited in browsers

Roku discovery commonly uses SSDP over UDP multicast (`239.255.255.250:1900`). Standard web pages do not have direct UDP socket/multicast access, so reliable in-browser SSDP discovery is not generally possible without additional platform-specific capabilities.

## Manual connection

1. Open RokuLAN in a browser on the same LAN as your Roku device.
2. Enter the Roku private/local IPv4 address (for example `192.168.1.12`).
3. Connect.
4. After successful device identification, RokuLAN stores the device in local browser storage for quick reconnect.

## Privacy model

- Roku IP addresses are treated as local-only data.
- Saved device entries are stored in browser localStorage.
- No accounts, analytics, telemetry, or database storage.
- No private network requests are proxied through RokuLAN servers.

## Security model

- Accepts only private/local IPv4 input for this milestone.
- Prevents arbitrary URL injection by constructing fixed ECP endpoints.
- Treats local IP input as untrusted.
- No secrets are required for this project.

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Testing and validation

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Deployment (Vercel)

RokuLAN is deployable to Vercel as a Next.js app. Note that deployment target does not change LAN isolation constraints: device communication still depends on what the user browser can reach on its own local network.

## Troubleshooting

### Device found but controls return 403

If `GET /query/device-info` succeeds but `POST /keypress/<key>` returns HTTP 403, Roku is reachable but command authorization is blocked.

Check Roku settings related to control from mobile/network applications and allow network control where appropriate.

RokuLAN does not attempt to bypass Roku security settings.

### Browser blocked local request

Try another browser/device on the same LAN, and verify your environment allows private-network access from web pages.

### Device unreachable

Verify the Roku IP address, LAN connectivity, and that the Roku is powered and connected.

## Roadmap

- Discovery enhancements where browser/platform capabilities allow
- Installable PWA experience
- App/channel launcher
- Improved multi-device workflows
- TV input controls
- Text entry support
- Wake/advanced ECP behaviors where supported
- Optional companion/native discovery bridge if browser restrictions require it

## Contributing

Contributions are welcome. Please run lint, typecheck, tests, and build before opening a PR.

## License

MIT (see `LICENSE`).

## Trademark / non-affiliation notice

RokuLAN is an independent project and is not affiliated with, endorsed by, or sponsored by Roku, Inc. Roku and related marks are the property of their respective owners.
