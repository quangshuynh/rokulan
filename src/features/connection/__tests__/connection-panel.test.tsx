// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConnectionPanel } from "@/features/connection/connection-panel";

afterEach(cleanup);

function renderPanel(onConnect = vi.fn(async () => undefined)) {
  render(
    <ConnectionPanel
      transportMode="bridge"
      onTransportModeChange={vi.fn()}
      savedDevicesState={{ status: "ready", devices: [] }}
      onConnect={onConnect}
      onRemoveSavedDevice={vi.fn()}
      connectionError={null}
      connectedDevice={null}
    />,
  );
  return { input: screen.getByLabelText("Roku IP address") as HTMLInputElement, onConnect };
}

describe("mobile Roku address entry", () => {
  it("uses a dot-capable text configuration without browser-owned numeric parsing", () => {
    const { input } = renderPanel();

    expect(input.type).toBe("text");
    expect(input.inputMode).toBe("decimal");
    expect(input.autocomplete).toBe("off");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("spellcheck")).toBe("false");
  });

  it("accepts a dotted IPv4 address and submits it intact", async () => {
    const user = userEvent.setup();
    const { input, onConnect } = renderPanel();

    await user.type(input, "192.168.1.12");
    await user.click(screen.getByRole("button", { name: "Connect" }));

    expect(input.value).toBe("192.168.1.12");
    expect(onConnect).toHaveBeenCalledWith("192.168.1.12");
  });

  it("preserves a pasted dotted IPv4 address", () => {
    const { input } = renderPanel();

    fireEvent.change(input, { target: { value: "10.20.30.40" } });

    expect(input.value).toBe("10.20.30.40");
  });
});
