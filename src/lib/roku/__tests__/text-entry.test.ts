import { describe, expect, it } from "vitest";
import {
  MAX_TEXT_ENTRY_LENGTH,
  encodeLiteralCharacter,
  getTextEntryValidationError,
  isLiteralKeypressPath,
  toLiteralKeypressPath,
  toTextEntryCharacters,
} from "@/lib/roku/text-entry";

describe("text entry encoding", () => {
  it.each([
    ["a", "a"],
    ["Z", "Z"],
    ["7", "7"],
    [" ", "%20"],
    ["&", "%26"],
    ["/", "%2F"],
    ["?", "%3F"],
    ["#", "%23"],
    ["%", "%25"],
    [".", "%2E"],
    ["+", "%2B"],
    ["é", "%C3%A9"],
    ["€", "%E2%82%AC"],
    ["🎬", "%F0%9F%8E%AC"],
  ])("percent-encodes %j as UTF-8 for Lit_", (character, encoded) => {
    expect(encodeLiteralCharacter(character)).toBe(encoded);
    expect(toLiteralKeypressPath(character)).toBe(`/keypress/Lit_${encoded}`);
  });

  it("splits text by code point so astral characters stay whole", () => {
    expect(toTextEntryCharacters("a🎬b")).toEqual(["a", "🎬", "b"]);
  });

  it("rejects multi-character or control input to the encoder", () => {
    expect(() => encodeLiteralCharacter("ab")).toThrow();
    expect(() => encodeLiteralCharacter("\n")).toThrow();
    expect(() => encodeLiteralCharacter("")).toThrow();
  });
});

describe("text entry validation", () => {
  it("accepts printable Unicode, punctuation, and spaces up to the limit", () => {
    expect(getTextEntryValidationError("Hello, wörld! ☕ <tag> \"q\" 'a'")).toBeNull();
    expect(getTextEntryValidationError("🎬".repeat(MAX_TEXT_ENTRY_LENGTH))).toBeNull();
  });

  it.each([
    ["", /enter text/i],
    [undefined, /enter text/i],
    [12, /enter text/i],
    ["tab\there", /control/i],
    ["nul\u0000", /control/i],
    ["del\u007f", /control/i],
    ["lone\ud800", /invalid/i],
    ["x".repeat(MAX_TEXT_ENTRY_LENGTH + 1), /limited/i],
  ])("rejects unsafe input %#", (value, message) => {
    expect(getTextEntryValidationError(value)).toMatch(message);
    expect(() => toTextEntryCharacters(value)).toThrow(expect.objectContaining({ code: "invalid_text" }));
  });

  it("never echoes the rejected text", () => {
    const secret = "secret-password";
    expect(getTextEntryValidationError(`${secret}\u0001`)).not.toContain(secret);
    expect(getTextEntryValidationError(secret.repeat(20))).not.toContain(secret);
  });
});

describe("literal keypress path allowlist", () => {
  it("accepts only canonical single-character literals", () => {
    expect(isLiteralKeypressPath("/keypress/Lit_a")).toBe(true);
    expect(isLiteralKeypressPath("/keypress/Lit_%E2%82%AC")).toBe(true);
    expect(isLiteralKeypressPath("/keypress/Lit_ab")).toBe(false);
    expect(isLiteralKeypressPath("/keypress/Lit_%61")).toBe(false);
    expect(isLiteralKeypressPath("/keypress/Lit_%2e%2e")).toBe(false);
    expect(isLiteralKeypressPath("/keypress/Lit_%2F..%2Fquery")).toBe(false);
    expect(isLiteralKeypressPath("/keypress/Lit_%0A")).toBe(false);
    expect(isLiteralKeypressPath("/keypress/Lit_%FF")).toBe(false);
    expect(isLiteralKeypressPath("/keypress/Lit_")).toBe(false);
  });
});
