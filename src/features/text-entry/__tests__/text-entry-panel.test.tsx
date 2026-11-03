// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TextEntryPanel } from "@/features/text-entry/text-entry-panel";
import { RokuError } from "@/types/roku";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

function renderPanel(onSend = vi.fn(async (text: string) => void text), onBackspace = vi.fn(async () => undefined)) {
  render(<TextEntryPanel onSend={onSend} onBackspace={onBackspace} />);
  return {
    input: screen.getByLabelText("Text to send to Roku") as HTMLInputElement,
    send: screen.getByRole("button", { name: "Send" }) as HTMLButtonElement,
    onSend,
    onBackspace,
  };
}

describe("text entry panel", () => {
  it("has an accessible, non-autofilling text field", () => {
    const { input, send } = renderPanel();
    expect(input.type).toBe("text");
    expect(input.autocomplete).toBe("off");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.getAttribute("autocapitalize")).toBe("none");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(send.disabled).toBe(true);
  });

  it("sends Unicode text with Enter, clears it, and announces success", async () => {
    const user = userEvent.setup();
    const { input, onSend } = renderPanel();
    await user.type(input, "Café 🎬{Enter}");
    expect(onSend).toHaveBeenCalledWith("Café 🎬");
    await waitFor(() => expect(input.value).toBe(""));
    expect(screen.getByRole("status").textContent).toMatch(/Sent 6 characters/);
  });

  it("shows validation errors for oversized text without calling the client", async () => {
    const user = userEvent.setup();
    const { input, onSend } = renderPanel();
    await user.click(input);
    await user.paste("x".repeat(129));
    expect(input.getAttribute("aria-invalid")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("alert").textContent).toMatch(/limited to 128/);
    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows failures without echoing the text and keeps it for retry", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn(async () => {
      throw new RokuError("disconnected_device", "The Roku appears disconnected or unreachable.");
    });
    const { input } = renderPanel(onSend);
    await user.type(input, "secret-pin");
    await user.click(screen.getByRole("button", { name: "Send" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/disconnected/);
    expect(alert.textContent).not.toContain("secret-pin");
    expect(input.value).toBe("secret-pin");
  });

  it("does not persist, log, or read the clipboard for entered text", async () => {
    const user = userEvent.setup();
    const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const readText = vi.fn();
    Object.defineProperty(navigator, "clipboard", { value: { readText }, configurable: true });
    const { input } = renderPanel();
    await user.type(input, "private{Enter}");
    expect(setItem).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
    for (const spy of consoleSpies) expect(spy).not.toHaveBeenCalled();
  });

  it("sends Backspace from the Delete button", async () => {
    const user = userEvent.setup();
    const { onBackspace } = renderPanel();
    await user.click(screen.getByRole("button", { name: "Send Backspace to Roku" }));
    expect(onBackspace).toHaveBeenCalledTimes(1);
  });
});
