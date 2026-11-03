// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RemoteControl } from "@/features/remote/remote-control";

afterEach(cleanup);

describe("remote keyboard shortcuts", () => {
  it("does not trigger commands while an address input is being edited", () => {
    const onCommand = vi.fn(async () => undefined);
    const { container } = render(
      <>
        <input aria-label="Roku IP address" />
        <RemoteControl
          device={{ ip: "192.168.1.12", friendlyName: "Living room", modelName: "TV", isTv: true }}
          blockedControls={false}
          onCommand={onCommand}
          onClearBlockedNotice={vi.fn()}
        />
      </>,
    );
    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    input?.focus();
    fireEvent.keyDown(input as HTMLInputElement, { key: "ArrowUp" });

    expect(onCommand).not.toHaveBeenCalled();
  });
});

const BASE_DEVICE = { ip: "192.168.1.12", friendlyName: "Living room", modelName: "TV", isTv: true };

function renderRemote(device: Parameters<typeof RemoteControl>[0]["device"], onCommand = vi.fn(async () => undefined)) {
  const view = render(
    <RemoteControl device={device} blockedControls={false} onCommand={onCommand} onClearBlockedNotice={vi.fn()} />,
  );
  return { ...view, onCommand };
}

describe("remote keyboard activation", () => {
  // Regression: the global Enter shortcut called preventDefault on focused
  // buttons, so keyboard users activating "Home" sent Select instead.
  it("lets Enter activate the focused button instead of sending Select", () => {
    const { getByRole, onCommand } = renderRemote(BASE_DEVICE);
    const home = getByRole("button", { name: "Home" });
    home.focus();
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    home.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(onCommand).not.toHaveBeenCalledWith("Select");
  });

  it("keeps arrow and Enter shortcuts when focus is not on a control", () => {
    const { onCommand } = renderRemote(BASE_DEVICE);
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(onCommand).toHaveBeenCalledWith("Left");
  });
});

describe("capability-aware remote controls", () => {
  it("keeps the existing controls when capabilities are unknown or missing", () => {
    const { queryByRole, getByRole, queryByText } = renderRemote(BASE_DEVICE);
    for (const name of ["Home", "Back", "Vol +", "Vol -", "Mute", "Power", "Select", "Play/Pause"]) {
      expect((getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(false);
    }
    expect(queryByRole("button", { name: "Find remote" })).toBeNull();
    expect(queryByText(/reports that it is not a TV/i)).toBeNull();
  });

  it("shows Find remote only when the device reports support", () => {
    const { getByRole, onCommand } = renderRemote({
      ...BASE_DEVICE,
      capabilities: { tv: "supported", findRemote: "supported" },
    });
    fireEvent.click(getByRole("button", { name: "Find remote" }));
    expect(onCommand).toHaveBeenCalledWith("FindRemote");
  });

  it("hides Find remote when unsupported", () => {
    const { queryByRole } = renderRemote({ ...BASE_DEVICE, capabilities: { tv: "supported", findRemote: "unsupported" } });
    expect(queryByRole("button", { name: "Find remote" })).toBeNull();
  });

  it("annotates but does not disable TV keys on a device that reports it is not a TV", () => {
    const { getByRole, getByText } = renderRemote({
      ...BASE_DEVICE,
      isTv: false,
      capabilities: { tv: "unsupported", findRemote: "unknown" },
    });
    const note = getByText(/reports that it is not a TV/i);
    for (const name of ["Vol +", "Vol -", "Mute", "Power"]) {
      const button = getByRole("button", { name });
      expect((button as HTMLButtonElement).disabled).toBe(false);
      expect(button.getAttribute("aria-describedby")).toBe(note.id);
    }
    expect(getByRole("button", { name: "Home" }).getAttribute("aria-describedby")).toBeNull();
  });
});
