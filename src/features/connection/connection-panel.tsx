"use client";

import { FormEvent, useMemo, useState } from "react";
import { BrowserDiscoveryProvider } from "@/features/discovery/browser-discovery-provider";
import type { SavedDevicesState } from "@/features/connection/saved-devices-state";
import type { RokuDeviceInfo, RokuTransportMode } from "@/types/roku";

interface ConnectionPanelProps {
  transportMode: RokuTransportMode;
  onTransportModeChange: (mode: RokuTransportMode) => void;
  savedDevicesState: SavedDevicesState;
  onConnect: (ip: string) => Promise<void>;
  onRemoveSavedDevice: (ip: string) => void;
  connectionError: string | null;
  connectedDevice: RokuDeviceInfo | null;
}

export function ConnectionPanel({
  transportMode,
  onTransportModeChange,
  savedDevicesState,
  onConnect,
  onRemoveSavedDevice,
  connectionError,
  connectedDevice,
}: ConnectionPanelProps) {
  const [ip, setIp] = useState(connectedDevice?.ip ?? "");
  const [isConnecting, setIsConnecting] = useState(false);
  const [discoveryMessage, setDiscoveryMessage] = useState<string | null>(null);
  const discoveryProvider = useMemo(() => new BrowserDiscoveryProvider(), []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsConnecting(true);

    try {
      await onConnect(ip);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleFindDevices = async () => {
    const support = discoveryProvider.canDiscover();

    if (!support.supported) {
      setDiscoveryMessage(support.reason);
      return;
    }

    const result = await discoveryProvider.discover();
    setDiscoveryMessage(result.message);
  };

  return (
    <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border border-violet-400/25 bg-zinc-950/78 p-4 shadow-[0_0_45px_rgba(126,34,206,0.15)] backdrop-blur-md sm:p-6">
      <div className="mb-6 border-b border-violet-400/15 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">Local network remote</p>
        <h1 className="mt-1 bg-gradient-to-r from-white via-violet-100 to-fuchsia-300 bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-4xl">RokuLAN</h1>
        <p className="mt-2 text-sm text-zinc-300">Control your Roku across your local network.</p>
      </div>

      <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-200">Connection transport</legend>
          <label className={`flex min-h-14 max-w-full cursor-pointer items-start gap-3 rounded-xl border p-3 transition motion-reduce:transition-none ${transportMode === "bridge" ? "border-violet-400/70 bg-violet-500/10" : "border-zinc-700/80 bg-black/20 hover:border-violet-400/40"}`}>
            <input
              type="radio"
              name="transport"
              value="bridge"
              checked={transportMode === "bridge"}
              onChange={() => onTransportModeChange("bridge")}
              className="mt-1 size-4 accent-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            />
            <span className="min-w-0"><span className="block text-sm font-medium">Local bridge (recommended)</span><span className="block text-xs text-zinc-400">Compatible local access outside the browser CORS sandbox.</span></span>
          </label>
          <label className={`flex min-h-14 max-w-full cursor-pointer items-start gap-3 rounded-xl border p-3 transition motion-reduce:transition-none ${transportMode === "direct" ? "border-violet-400/70 bg-violet-500/10" : "border-zinc-700/80 bg-black/20 hover:border-violet-400/40"}`}>
            <input
              type="radio"
              name="transport"
              value="direct"
              checked={transportMode === "direct"}
              onChange={() => onTransportModeChange("direct")}
              className="mt-1 size-4 accent-violet-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
            />
            <span className="min-w-0"><span className="block text-sm font-medium">Direct browser (experimental)</span><span className="block text-xs text-zinc-400">Useful for diagnostics; Roku CORS commonly blocks readable responses.</span></span>
          </label>
        </fieldset>
        <label htmlFor="roku-ip" className="text-sm font-medium text-zinc-200">
          Roku IP address
        </label>
        <input
          id="roku-ip"
          name="roku-ip"
          type="text"
          inputMode="decimal"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="192.168.1.12"
          value={ip}
          onChange={(event) => setIp(event.target.value)}
          className="min-h-12 rounded-xl border border-violet-400/30 bg-black/45 px-3 font-mono text-base text-zinc-100 caret-violet-300 placeholder:text-zinc-600 focus-visible:border-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/70"
          aria-describedby="ip-help"
        />
        <p id="ip-help" className="text-xs text-zinc-400">
          Private IPv4 only. Addresses are never sent to RokuLAN cloud servers.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            className="min-h-12 flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-5 font-semibold text-white shadow-[0_0_24px_rgba(147,51,234,0.28)] transition hover:from-violet-500 hover:to-fuchsia-500 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none"
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </button>
          <button
            type="button"
            className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900/70 px-4 font-medium text-zinc-100 transition hover:border-violet-400/50 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 motion-reduce:transition-none"
            onClick={() => void handleFindDevices()}
          >
            Find devices
          </button>
        </div>
      </form>

      {connectionError ? (
        <p role="alert" className="mt-3 rounded-xl border border-red-400/40 bg-red-950/55 px-3 py-2 text-sm text-red-100 shadow-[inset_3px_0_0_rgba(248,113,113,0.7)]">
          {connectionError}
        </p>
      ) : null}

      {discoveryMessage ? (
        <p className="mt-3 rounded-xl border border-violet-400/30 bg-violet-950/35 px-3 py-2 text-sm text-violet-100">
          {discoveryMessage}
        </p>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-zinc-200">Saved devices</h3>
        {savedDevicesState.status === "loading" ? (
          <p className="mt-2 text-sm text-zinc-400" role="status">
            Loading saved devices...
          </p>
        ) : savedDevicesState.devices.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No saved devices yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {savedDevicesState.devices.map((saved) => (
              <li key={saved.ip} className="rounded-xl border border-violet-400/15 bg-black/30 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{saved.friendlyName}</p>
                    <p className="text-xs text-zinc-400">
                      {saved.ip} • {saved.model}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-violet-400/40 px-3 py-2 text-xs text-violet-100 hover:bg-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      onClick={() => void onConnect(saved.ip)}
                    >
                      Reconnect
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-red-400/50 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
                      onClick={() => onRemoveSavedDevice(saved.ip)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="mt-5 text-xs text-zinc-400">
        Privacy: saved Roku IP addresses are stored in this browser&apos;s local storage and are never sent to RokuLAN servers.
      </p>
    </section>
  );
}
