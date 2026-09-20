import { useEffect } from "react";
import type { RokuCommand } from "@/types/roku";

const KEY_TO_COMMAND: Record<string, RokuCommand> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Enter: "Select",
  Escape: "Back",
  Backspace: "Back",
};

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === "INPUT" ||
    tagName === "TEXTAREA" ||
    tagName === "SELECT"
  );
}

export function useRemoteKeyboardShortcuts(
  enabled: boolean,
  onCommand: (command: RokuCommand) => void,
): void {
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const command = KEY_TO_COMMAND[event.key];
      if (!command) {
        return;
      }

      event.preventDefault();
      onCommand(command);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onCommand]);
}
