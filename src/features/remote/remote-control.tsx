"use client";

import { useCallback, useState } from "react";
import type { RokuCommand, RokuDeviceInfo } from "@/types/roku";
import { useRemoteKeyboardShortcuts } from "@/features/remote/use-remote-keyboard-shortcuts";

interface RemoteControlProps {
  device: RokuDeviceInfo;
  blockedControls: boolean;
  onCommand: (command: RokuCommand) => Promise<void>;
  onClearBlockedNotice: () => void;
}

interface CommandButton {
  label: string;
  command: RokuCommand;
}

const D_PAD_BUTTONS: CommandButton[] = [
  { label: "Up", command: "Up" },
  { label: "Left", command: "Left" },
  { label: "OK", command: "Select" },
  { label: "Right", command: "Right" },
  { label: "Down", command: "Down" },
];

const MEDIA_BUTTONS: CommandButton[] = [
  { label: "Replay", command: "InstantReplay" },
  { label: "Play/Pause", command: "Play" },
  { label: "Rewind", command: "Rev" },
  { label: "Fast Forward", command: "Fwd" },
];

const SYSTEM_BUTTONS: CommandButton[] = [
  { label: "Home", command: "Home" },
  { label: "Back", command: "Back" },
  { label: "Vol +", command: "VolumeUp" },
  { label: "Vol -", command: "VolumeDown" },
  { label: "Mute", command: "VolumeMute" },
  { label: "Power", command: "Power" },
];

function buttonClassName(isPrimary = false): string {
  return [
    "min-h-12 rounded-xl border border-violet-400/20 bg-zinc-900/75 px-3 py-3 text-sm font-medium text-zinc-100",
    "shadow-sm shadow-black/20 transition motion-reduce:transform-none motion-reduce:transition-none hover:border-violet-400/60 hover:bg-violet-500/15 active:scale-[0.98] disabled:opacity-55",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
    isPrimary ? "border-violet-300/60 bg-violet-600/30 text-base shadow-[0_0_22px_rgba(139,92,246,0.2)]" : "",
  ].join(" ");
}

export function RemoteControl({
  device,
  blockedControls,
  onCommand,
  onClearBlockedNotice,
}: RemoteControlProps) {
  const [pending, setPending] = useState<RokuCommand | null>(null);

  const sendCommand = useCallback(
    async (command: RokuCommand) => {
      onClearBlockedNotice();
      setPending(command);
      try {
        await onCommand(command);
      } finally {
        setPending(null);
      }
    },
    [onClearBlockedNotice, onCommand],
  );

  useRemoteKeyboardShortcuts(Boolean(device), (command) => {
    void sendCommand(command);
  });

  return (
    <section className="rounded-3xl border border-violet-400/25 bg-zinc-950/78 p-4 shadow-[0_0_45px_rgba(126,34,206,0.15)] backdrop-blur-md sm:p-6">
      <header className="mb-4 flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-300">Remote online</p>
        <h2 className="text-xl font-semibold text-zinc-50">{device.friendlyName}</h2>
        <p className="text-sm text-zinc-300">
          Connected to {device.ip} • {device.modelName}
        </p>
      </header>

      {blockedControls ? (
        <div
          className="mb-4 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="status"
        >
          Roku found, but remote control is blocked. Check the Roku network-control setting for mobile/network apps.
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 rounded-3xl border border-violet-400/15 bg-black/30 p-3 shadow-inner shadow-black/50 sm:gap-3 sm:p-4">
            <span />
            <button
              type="button"
              className={buttonClassName()}
              onClick={() => void sendCommand(D_PAD_BUTTONS[0].command)}
              aria-label="Navigate up"
              disabled={pending !== null}
            >
              {D_PAD_BUTTONS[0].label}
            </button>
            <span />

            {D_PAD_BUTTONS.slice(1, 4).map((item) => (
              <button
                key={item.command}
                type="button"
                className={buttonClassName(item.command === "Select")}
                onClick={() => void sendCommand(item.command)}
                aria-label={item.label === "OK" ? "Select" : `Navigate ${item.label.toLowerCase()}`}
                disabled={pending !== null}
              >
                {item.label}
              </button>
            ))}

            <span />
            <button
              type="button"
              className={buttonClassName()}
              onClick={() => void sendCommand(D_PAD_BUTTONS[4].command)}
              aria-label="Navigate down"
              disabled={pending !== null}
            >
              {D_PAD_BUTTONS[4].label}
            </button>
            <span />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {MEDIA_BUTTONS.map((item) => (
              <button
                key={item.command}
                type="button"
                className={buttonClassName()}
                onClick={() => void sendCommand(item.command)}
                aria-label={item.label}
                disabled={pending !== null}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {SYSTEM_BUTTONS.map((item) => (
            <button
              key={item.command}
              type="button"
              className={buttonClassName()}
              onClick={() => void sendCommand(item.command)}
              aria-label={item.label}
              disabled={pending !== null}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Keyboard: Arrow keys, Enter, Escape/Backspace. Shortcuts are disabled while typing in inputs.
      </p>
    </section>
  );
}
