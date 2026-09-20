import type { RokuCommand } from "@/types/roku";

export const SUPPORTED_COMMANDS: readonly RokuCommand[] = [
  "Home",
  "Back",
  "Up",
  "Down",
  "Left",
  "Right",
  "Select",
  "InstantReplay",
  "Play",
  "Rev",
  "Fwd",
  "VolumeUp",
  "VolumeDown",
  "VolumeMute",
  "Power",
  "PowerOn",
  "PowerOff",
] as const;

export function toKeypressPath(command: RokuCommand): `/keypress/${RokuCommand}` {
  return `/keypress/${command}`;
}
