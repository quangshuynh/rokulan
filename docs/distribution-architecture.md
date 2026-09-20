# Zero-clone distribution and mobile architecture

Status: architecture decision record and experiment plan (2026-09-19). No installer or LAN-facing bridge is implemented.

## Goals and invariants

RokuLAN should require no repository clone, Node.js, npm, terminal, or bridge knowledge from a normal user. It should support desktop and mobile where the platform permits, remain local-first, never relay Roku commands through RokuLAN cloud infrastructure, and never send a Roku IP to that infrastructure. Compatibility claims must distinguish documented behavior from tested behavior.

Every design must retain the current narrow boundary: private IPv4 Roku validation, internally constructed port 8060 URLs, an allowlisted typed API, bounded bodies and responses, timeouts, safe XML handling, and no arbitrary proxy, arbitrary URL fetch, telemetry, accounts, database, or sensitive identifiers in logs. A LAN-facing companion additionally requires pairing and authentication before it can be considered safe.

## Proven facts

The following evidence is deliberately sanitized:

- A local process received valid device-info XML and successfully sent one allowlisted keypress to one Roku on one private LAN. A restrictive Roku setting had previously returned HTTP 403 for keypress.
- Direct browser navigation displayed Roku XML. A JavaScript `fetch` from the development origin reached that Roku and DevTools showed HTTP 200, but the response lacked `Access-Control-Allow-Origin`; the browser therefore withheld the response from JavaScript.
- On one desktop development setup, the browser UI successfully used the manually started loopback bridge to identify and control the Roku.
- The existing bridge binds only to `127.0.0.1:8787`, checks exact origins and loopback Host, exposes two semantic operations, and does not accept arbitrary URLs.
- The production deployment is `https://rokulan.vercel.app`. No browser-automated or manual production-origin-to-loopback test was completed in this interval, so that path is **untested**, not supported.

These facts do not establish behavior across other browsers, operating systems, networks, Roku models, or firmware.

## Current platform constraints

Sources in this section were accessed 2026-09-19.

### Roku ECP: technical behavior versus documented permission

Roku documents ECP as a LAN REST API discoverable with SSDP. As of Roku OS 14.1, `keypress`, `keydown`, and `keyup` require **Settings > System > Advanced system settings > Control by mobile apps** to be Enabled. The ordinary device-info and keypress subset used by RokuLAN does not require developer mode; Roku lists a separate group of diagnostic commands that does. Roku also says that ECP commands may not be sent from third-party platforms, giving mobile applications as its example. [Roku ECP documentation](https://developer.roku.com/dev/docs/external-control-api)

Therefore:

- **Technically demonstrated:** a local process and the loopback companion can use the small ECP subset on one permissively configured device.
- **Documented support/permission:** Roku's current third-party-platform prohibition is a material blocker for distributing RokuLAN as a third-party remote, especially a native mobile client. It may also encompass the web/companion designs; the wording does not define the exact boundary. RokuLAN must obtain clarification or policy approval before a public control product is claimed permissible. This document does not invent a bypass.

### Browser networking

Cross-origin `fetch` remains subject to CORS: JavaScript can read a response only when the target grants the requesting origin. `no-cors` produces an opaque response and cannot provide device data or reliable command status. [MDN CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS), [MDN Fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)

Chromium replaced the paused PNA-preflight rollout with Local Network Access (LNA). Chrome 142 gates public-origin requests to private and loopback destinations behind a secure-context permission. When granted, Chrome relaxes mixed-content blocking for recognized local destinations. This permission does **not** grant CORS: the target must still return appropriate CORS headers. Service-worker requests require the origin to have already received LNA permission. Chromium's documentation identifies WebSocket integration separately, so WebSockets must not be treated as a bypass. [Chrome LNA announcement](https://developer.chrome.com/blog/local-network-access), [Chrome 142 release notes](https://developer.chrome.com/release-notes/142)

Loopback HTTP is considered potentially trustworthy by the relevant web specifications and Chromium, allowing an HTTPS page to attempt `http://127.0.0.1`; however, browser implementation differs. Chromium's older guidance explicitly notes that WebKit blocked HTTPS-to-HTTP loopback as mixed content, and the public WebKit issue remains evidence of that compatibility risk. Current Safari behavior still needs device testing. [Chrome private-network guidance](https://developer.chrome.com/blog/private-network-access-update), [WebKit issue 171934](https://bugs.webkit.org/show_bug.cgi?id=171934)

For private-LAN HTTP such as a Roku or a LAN companion, HTTPS-to-HTTP is ordinarily mixed content unless a browser-specific local-network permission relaxes it. CORS remains independent. Apple documents that traffic originating from Safari, `SFSafariViewController`, and `WKWebView` is exempt from the *OS local-network privacy permission*; that statement does not remove WebKit mixed-content or CORS enforcement. [Apple TN3179](https://developer.apple.com/documentation/technotes/tn3179-understanding-local-network-privacy)

Android's native-app rules are evolving: Android 16 offers opt-in LAN protection and Android 17 requires `ACCESS_LOCAL_NETWORK` for apps targeting API 37+, including outgoing TCP and UDP. WebView traffic inherits the host app's permission. This does not establish current Chrome-browser behavior, which must be tested separately alongside Chromium LNA. [Android local-network permission](https://developer.android.com/privacy-and-security/local-network-permission)

Installing a PWA changes launch/distribution UX, not its fundamental browser security model: it still runs in the installing browser's environment. A service worker uses the normal browser networking stack and, in Chromium, cannot itself prompt for LNA. Consequently neither PWA installation nor a service worker bypasses CORS, mixed content, or LNA. [MDN PWA installation](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Installing), [Chrome LNA announcement](https://developer.chrome.com/blog/local-network-access)

## Candidate architectures

### A. Browser to Roku directly

The website/PWA fetches `http://<private-ip>:8060`. It is zero-install and could originate on desktop or phone, but the tested Roku omitted CORS permission, so JavaScript could not consume even a successful response. HTTPS-to-private-HTTP and LNA rules add browser-specific gates; LNA consent does not repair CORS. A PWA, service worker, or WebSocket does not remove those gates, and Roku ECP does not offer a RokuLAN-controlled WebSocket endpoint. Distribution is simplest, security exposure is broad (a public origin reaching a LAN device), and current Roku third-party-platform policy is unresolved/prohibitive. This is not a viable primary architecture without a Roku-side change and policy clarification.

### B. Browser to localhost companion to Roku

An installed desktop companion listens on loopback, validates the exact production origin, and sends the narrow ECP operations to the Roku. This is technically proven only from a local development origin on one desktop. Chromium's documented model permits an HTTPS origin to request loopback after LNA permission, while CORS can be supplied by the companion. Safari compatibility remains unproven and potentially blocked by WebKit mixed-content behavior. Packaging can eliminate Node/npm/terminal for users, but signing, notarization, safe updates, per-install authorization, and origin lifecycle are required. It cannot serve a phone: `127.0.0.1` on the phone is the phone, not the desktop.

### C. Phone browser to LAN companion to Roku

The phone addresses a companion on another LAN host. This solves the loopback topology but turns the companion into a network service. A production design needs explicit user-mediated discovery, mutually authenticated pairing, per-client credentials, authorization for every command, revocation, multiple-client/device handling, replay-resistant sessions, strict origin handling, rate limits, and firewall guidance. Plain HTTP is exposed to LAN interception and HTTPS needs a trustworthy name/certificate strategy; a self-signed certificate is not a seamless web solution. Browser mixed-content, LNA, CORS, and mobile OS behavior still apply. Binding the current service to `0.0.0.0` would be unsafe and is expressly not the implementation. Roku policy remains a blocker. Feasibility is unproven.

### D. Native mobile client

A native iOS/Android client can use native networking instead of browser CORS and can request the applicable OS LAN permission. It must handle iOS local-network privacy and Android's current/future permissions, transport security, discovery, and secure storage. Technically this is the cleanest phone-to-Roku topology, but Roku's current documentation explicitly names mobile applications in its prohibition on third-party platforms sending ECP. Do not build this unless Roku provides permission or clarifies that the intended use is supported.

### E. Installed companion with local UI

Packaging both UI and bridge into one desktop app removes production-origin-to-loopback browser variability and can keep the API private to the application. A lightweight native wrapper can yield smaller bundles but adds Rust/native toolchains and platform-specific webview behavior. Electron offers a consistent bundled Chromium/Node runtime and high reuse at a larger bundle and attack/update surface. A packaged Node service plus system browser maximizes current code reuse but retains localhost exposure and browser variance. All options require Windows signing, macOS signing/notarization, Linux packaging decisions, secure auto-update design later, and a maintained runtime. This is the strongest desktop distribution direction after policy and wrapper experiments, but it does not itself solve phone use.

## Decision and next experiments

No architecture is approved for public distribution yet because Roku's documented third-party-platform restriction is material. The next action is to request written Roku clarification for the narrow remote-control use case before investing in packaging or native mobile work.

In parallel, the next safe technical experiment is Model B on desktop with the existing loopback-only bridge:

1. Allow only `https://rokulan.vercel.app` through `ROKULAN_ALLOWED_ORIGINS` and start the existing bridge.
2. In an up-to-date desktop Chromium profile with default security, open the production site, attempt Connect, record the LNA prompt/decision, console, request and preflight headers, response, and command result.
3. Repeat in desktop Safari and Firefox without changing security settings.
4. Record browser/OS versions and sanitized outcomes. Remove the environment override after testing.

This experiment validates only desktop Model B. It must not be presented as mobile validation.

## Manual production and mobile test matrix

Use synthetic notes (`<PRIVATE_ROKU_IP>`, no screenshots containing device data). For every row record exact OS/browser version, whether the production HTTPS site loads, bridge detection/reachability, direct Roku request behavior, any local-network prompt, CORS result, mixed-content result, and whether a single benign Home command succeeds. Do not mark an unrun row supported.

| Client | Topology | Required observation | Status |
| --- | --- | --- | --- |
| Desktop Chrome/Chromium | production HTTPS -> HTTP loopback bridge -> Roku | LNA prompt, CORS/preflight, device-info, Home | Untested |
| Desktop Safari | production HTTPS -> HTTP loopback bridge -> Roku | mixed-content/loopback behavior, CORS, device-info, Home | Untested |
| Desktop Firefox | production HTTPS -> HTTP loopback bridge -> Roku | loopback policy, CORS, device-info, Home | Untested |
| iPhone Safari | production HTTPS -> Roku directly | private-HTTP block, CORS, OS/browser prompt | Untested; localhost companion is unreachable by topology |
| iPhone installed web app | same as above | confirm installation changes no network outcome | Untested |
| Android Chrome | production HTTPS -> Roku directly | LNA/OS prompt, mixed content, CORS | Untested; localhost companion is unreachable by topology |
| Android installed PWA | same as above | confirm installation changes no network outcome | Untested |
| iPhone Safari | production HTTPS -> paired LAN companion -> Roku | discovery, trusted transport, pairing/auth, CORS, command | Blocked pending secure prototype and Roku policy clarification |
| Android Chrome | production HTTPS -> paired LAN companion -> Roku | discovery, trusted transport, LNA, pairing/auth, CORS, command | Blocked pending secure prototype and Roku policy clarification |

For the production desktop test, start the existing build with:

```powershell
$env:ROKULAN_ALLOWED_ORIGINS = "https://rokulan.vercel.app"
npm run bridge:build
npm run bridge:start
```

Then restore the shell by removing that environment variable. Never disable browser security, install a CORS extension, use `no-cors`, or expose the bridge on a LAN interface.

## Remaining unknowns

- Roku's interpretation of “third-party platforms” for a hosted UI plus local companion, and whether permission is available.
- Current production-origin behavior in exact target releases of Chromium, Safari/WebKit, and Firefox.
- Whether the production UI needs an explicit `targetAddressSpace: "loopback"` annotation for any supported Chromium hostname strategy.
- A cross-platform local TLS/name/certificate strategy, if Model C is pursued.
- Pairing UX, credential lifecycle, discovery, firewall traversal, and multi-user behavior for Model C.
- Which Model E wrapper best meets bundle, signing, update, runtime, and maintenance needs after a small comparative proof.
