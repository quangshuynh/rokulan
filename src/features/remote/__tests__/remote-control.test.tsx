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
