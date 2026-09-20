import type { DiscoveryProvider } from "@/features/discovery/provider";

const UNSUPPORTED_REASON =
  "Automatic Roku discovery is not available in normal browsers because SSDP uses UDP multicast, which browser sandboxes do not expose. Use manual IP entry.";

export class BrowserDiscoveryProvider implements DiscoveryProvider {
  readonly id = "browser";

  canDiscover() {
    return {
      supported: false,
      reason: UNSUPPORTED_REASON,
    };
  }

  async discover() {
    return {
      devices: [],
      message: UNSUPPORTED_REASON,
    };
  }
}
