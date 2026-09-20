"use client";

import { useMemo, useState } from "react";
import { ConnectionPanel } from "@/features/connection/connection-panel";
import { RemoteControl } from "@/features/remote/remote-control";
import { normalizePrivateIPv4 } from "@/lib/network/ipv4";
import { createDirectBrowserClient } from "@/lib/roku/client";
import { createLocalBridgeClient } from "@/lib/roku/local-bridge-client";
import { classifyDeviceInfoError, classifyKeypressError } from "@/lib/roku/errors";
import {
  loadSavedDevices,
  rememberDevice,
  removeSavedDevice,
} from "@/lib/storage/saved-devices";
import type { RokuCommand, RokuDeviceInfo, RokuTransportMode, SavedRokuDevice } from "@/types/roku";

function secureContextEnabled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return window.isSecureContext;
}

export default function Home() {
  const [transportMode, setTransportMode] = useState<RokuTransportMode>("bridge");
  const client = useMemo(
    () => (transportMode === "bridge" ? createLocalBridgeClient() : createDirectBrowserClient()),
    [transportMode],
  );
  const [savedDevices, setSavedDevices] = useState<SavedRokuDevice[]>(() =>
    loadSavedDevices(typeof window === "undefined" ? null : window.localStorage),
  );
  const [connectedDevice, setConnectedDevice] = useState<RokuDeviceInfo | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [blockedControls, setBlockedControls] = useState(false);

  const connect = async (rawIp: string) => {
    setConnectionError(null);
    setBlockedControls(false);

    try {
      const ip = normalizePrivateIPv4(rawIp);
      const deviceInfo = await client.queryDeviceInfo(ip);

      setConnectedDevice(deviceInfo);

      const updatedSavedDevices = rememberDevice(window.localStorage, deviceInfo);
      setSavedDevices(updatedSavedDevices);
    } catch (error) {
      const classified = classifyDeviceInfoError(error, {
        secureContext: secureContextEnabled(),
      });

      setConnectedDevice(null);
      setConnectionError(classified.message);
    }
  };

  const removeSaved = (ip: string) => {
    const updated = removeSavedDevice(window.localStorage, ip);
    setSavedDevices(updated);
  };

  const sendCommand = async (command: RokuCommand) => {
    if (!connectedDevice) {
      return;
    }

    try {
      await client.sendKeypress(connectedDevice.ip, command);
      setConnectionError(null);
    } catch (error) {
      const classified = classifyKeypressError(error);
      if (classified.code === "http_403") {
        setBlockedControls(true);
        return;
      }

      setConnectionError(classified.message);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-start lg:py-10">
      <div className="w-full lg:max-w-md">
        <ConnectionPanel
          transportMode={transportMode}
          onTransportModeChange={(mode) => {
            setTransportMode(mode);
            setConnectedDevice(null);
            setConnectionError(null);
            setBlockedControls(false);
          }}
          savedDevices={savedDevices}
          onConnect={connect}
          onRemoveSavedDevice={removeSaved}
          connectionError={connectionError}
          connectedDevice={connectedDevice}
        />
      </div>

      <div className="w-full">
        {connectedDevice ? (
          <RemoteControl
            device={connectedDevice}
            blockedControls={blockedControls}
            onCommand={sendCommand}
            onClearBlockedNotice={() => setBlockedControls(false)}
          />
        ) : (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8 text-center text-zinc-300">
            Connect to a Roku device to show the remote.
          </section>
        )}
      </div>
    </main>
  );
}
