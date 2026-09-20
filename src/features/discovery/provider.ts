import type { SavedRokuDevice } from "@/types/roku";

export interface DiscoverySupport {
  supported: boolean;
  reason: string;
}

export interface DiscoveryResult {
  devices: SavedRokuDevice[];
  message: string;
}

export interface DiscoveryProvider {
  readonly id: string;
  canDiscover(): DiscoverySupport;
  discover(): Promise<DiscoveryResult>;
}
