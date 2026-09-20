"use client";

import { FormEvent, useMemo, useState } from "react";
import { BrowserDiscoveryProvider } from "@/features/discovery/browser-discovery-provider";
import type { RokuDeviceInfo, RokuTransportMode, SavedRokuDevice } from "@/types/roku";

interface ConnectionPanelProps {
  transportMode: RokuTransportMode;
  onTransportModeChange: (mode: RokuTransportMode) => void;
  savedDevices: SavedRokuDevice[];
  onConnect: (ip: string) => Promise<void>;
  onRemoveSavedDevice: (ip: string) => void;
  connectionError: string | null;
  connectedDevice: RokuDeviceInfo | null;
}

export function ConnectionPanel({
  transportMode,
  onTransportModeChange,
  savedDevices,
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
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 shadow-xl shadow-black/25 sm:p-6">
      <h2 className="text-xl font-semibold text-zinc-50">RokuLAN</h2>
      <p className="mt-2 text-sm text-zinc-300">A browser UI for controlling Roku devices on your LAN.</p>

      <form className="mt-5 flex flex-col gap-3" onSubmit={handleSubmit}>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-zinc-200">Connection transport</legend>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-zinc-700 p-3">
            <input
              type="radio"
              name="transport"
              value="bridge"
              checked={transportMode === "bridge"}
              onChange={() => onTransportModeChange("bridge")}
              className="mt-1"
            />
            <span><span className="block text-sm font-medium">Local bridge (recommended)</span><span className="block text-xs text-zinc-400">Compatible local access outside the browser CORS sandbox.</span></span>
          </label>
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-zinc-700 p-3">
            <input
              type="radio"
              name="transport"
              value="direct"
              checked={transportMode === "direct"}
              onChange={() => onTransportModeChange("direct")}
              className="mt-1"
            />
            <span><span className="block text-sm font-medium">Direct browser (experimental)</span><span className="block text-xs text-zinc-400">Useful for diagnostics; Roku CORS commonly blocks readable responses.</span></span>
          </label>
        </fieldset>
        <label htmlFor="roku-ip" className="text-sm font-medium text-zinc-200">
          Roku IP address
        </label>
        <input
          id="roku-ip"
          name="roku-ip"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="192.168.1.12"
          value={ip}
          onChange={(event) => setIp(event.target.value)}
          className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          aria-describedby="ip-help"
        />
        <p id="ip-help" className="text-xs text-zinc-400">
          Private IPv4 only. Addresses are never sent to RokuLAN cloud servers.
        </p>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="submit"
            className="min-h-12 rounded-xl bg-sky-500 px-4 font-medium text-sky-950 transition hover:bg-sky-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none"
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </button>
          <button
            type="button"
            className="min-h-12 rounded-xl border border-zinc-700 bg-zinc-900 px-4 font-medium text-zinc-100 transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
            onClick={() => void handleFindDevices()}
          >
            Find devices
          </button>
        </div>
      </form>

      {connectionError ? (
        <p role="alert" className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {connectionError}
        </p>
      ) : null}

      {discoveryMessage ? (
        <p className="mt-3 rounded-xl border border-zinc-700 bg-zinc-950/80 px-3 py-2 text-sm text-zinc-200">
          {discoveryMessage}
        </p>
      ) : null}

      <div className="mt-5">
        <h3 className="text-sm font-semibold text-zinc-200">Saved devices</h3>
        {savedDevices.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No saved devices yet.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {savedDevices.map((saved) => (
              <li key={saved.ip} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">{saved.friendlyName}</p>
                    <p className="text-xs text-zinc-400">
                      {saved.ip} • {saved.model}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                      onClick={() => void onConnect(saved.ip)}
                    >
                      Reconnect
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-100 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
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
