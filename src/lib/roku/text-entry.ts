import { RokuError } from "../../types/roku";

/** Maximum number of Unicode code points accepted per text-entry request. */
export const MAX_TEXT_ENTRY_LENGTH = 128;

const CONTROL_OR_LONE_SURROGATE = /[\p{Cc}\p{Cs}]/u;
const LITERAL_PATH = /^\/keypress\/Lit_([A-Za-z0-9]|(?:%[0-9A-F]{2}){1,4})$/;

/**
 * Returns a user-facing validation message, or null when the text can be sent.
 * Messages never echo the entered text.
 */
export function getTextEntryValidationError(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return "Enter text to send.";
  }
  if (CONTROL_OR_LONE_SURROGATE.test(value)) {
    return "Text contains control or invalid characters that Roku text entry cannot send.";
  }
  if (Array.from(value).length > MAX_TEXT_ENTRY_LENGTH) {
    return `Text is limited to ${MAX_TEXT_ENTRY_LENGTH} characters per send.`;
  }
  return null;
}

/** Validates text and splits it into Unicode code points (one ECP literal each). */
export function toTextEntryCharacters(value: unknown): string[] {
  const error = getTextEntryValidationError(value);
  if (error) throw new RokuError("invalid_text", error);
  return Array.from(value as string);
}

/** Percent-encodes one code point as UTF-8, leaving only ASCII letters and digits bare. */
export function encodeLiteralCharacter(character: string): string {
  if (Array.from(character).length !== 1 || CONTROL_OR_LONE_SURROGATE.test(character)) {
    throw new RokuError("invalid_text", "Roku text entry accepts one valid character per keypress.");
  }
  if (/^[A-Za-z0-9]$/.test(character)) return character;
  return Array.from(new TextEncoder().encode(character), (byte) =>
    `%${byte.toString(16).toUpperCase().padStart(2, "0")}`,
  ).join("");
}

export function toLiteralKeypressPath(character: string): `/keypress/Lit_${string}` {
  return `/keypress/Lit_${encodeLiteralCharacter(character)}`;
}

/** Accepts only canonical single-character literal keypress paths. */
export function isLiteralKeypressPath(path: string): boolean {
  const match = LITERAL_PATH.exec(path);
  if (!match) return false;
  try {
    const decoded = decodeURIComponent(match[1]);
    return Array.from(decoded).length === 1 && encodeLiteralCharacter(decoded) === match[1];
  } catch {
    return false;
  }
}

/** Placeholder used in errors so entered text never appears in messages. */
export const REDACTED_LITERAL_PATH = "/keypress/Lit_<redacted>";
