import type { RokuApp, RokuAppType } from "../../types/roku";
import { RokuError } from "../../types/roku";

export const MAX_APPS = 500;
export const MAX_APP_NAME_LENGTH = 100;

/**
 * Roku channel IDs are numeric for installed channels, `dev` for a sideloaded
 * channel, and `tvinput.<name>` for Roku TV inputs. Anything else is rejected,
 * which keeps launch paths to a single safe path segment.
 */
const APP_ID_PATTERN = /^(?:\d{1,10}|dev|tvinput\.[a-z0-9]{1,24})$/;
const APP_TYPES: readonly RokuAppType[] = ["appl", "tvin", "menu"];

export function isRokuAppId(value: unknown): value is string {
  return typeof value === "string" && APP_ID_PATTERN.test(value);
}

function malformed(): RokuError {
  return new RokuError(
    "malformed_apps_response",
    "The Roku returned a channel list RokuLAN could not read.",
  );
}

function decodeXmlText(value: string): string {
  return value.replace(/&(?:#(\d{1,7})|#x([0-9a-f]{1,6})|(amp|lt|gt|quot|apos));/gi, (entity, dec, hex, named) => {
    if (named) {
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" } as Record<string, string>)[named.toLowerCase()];
    }
    const codePoint = dec ? Number(dec) : parseInt(hex, 16);
    const valid =
      codePoint >= 0x20 && codePoint <= 0x10ffff && (codePoint < 0xd800 || codePoint > 0xdfff);
    return valid ? String.fromCodePoint(codePoint) : "";
  });
}

function readAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of source.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    attributes.set(match[1].toLowerCase(), decodeXmlText(match[2] ?? match[3] ?? ""));
  }
  return attributes;
}

function toAppType(value: string | undefined): RokuAppType {
  return APP_TYPES.find((type) => type === value) ?? "unknown";
}

function toAppName(raw: string, id: string): string {
  const name = raw.replace(/[\p{Cc}\s]+/gu, " ").trim();
  const bounded = Array.from(name).slice(0, MAX_APP_NAME_LENGTH).join("");
  return bounded || `Channel ${id}`;
}

/** Keeps valid, de-duplicated entries (first occurrence wins), bounded in count. */
function collect(entries: Iterable<{ id: unknown; name: unknown; type: unknown }>): RokuApp[] {
  const apps: RokuApp[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    if (!isRokuAppId(entry.id) || seen.has(entry.id)) continue;
    seen.add(entry.id);
    apps.push({
      id: entry.id,
      name: toAppName(typeof entry.name === "string" ? entry.name : "", entry.id),
      type: toAppType(typeof entry.type === "string" ? entry.type : undefined),
    });
    if (apps.length >= MAX_APPS) break;
  }
  return apps;
}

/** Parses the `GET /query/apps` ECP response into a typed, validated list. */
export function parseRokuApps(xml: string): RokuApp[] {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw malformed();
  const document = /^\s*(?:<\?xml[^>]*\?>\s*)?<apps(?:\s[^>]*)?(?:\/>|>([\s\S]*)<\/apps>)\s*$/i.exec(xml);
  if (!document) throw malformed();

  const body = document[1] ?? "";
  const entries = Array.from(body.matchAll(/<app\b([^>]*)>([^<]*)<\/app>/gi));
  const openTags = body.match(/<app\b/gi)?.length ?? 0;
  if (openTags !== entries.length) throw malformed();

  return collect(
    entries.map((entry) => {
      const attributes = readAttributes(entry[1]);
      return { id: attributes.get("id"), type: attributes.get("type"), name: decodeXmlText(entry[2]) };
    }),
  );
}

/** Re-validates app data that crossed the bridge boundary as JSON. */
export function sanitizeRokuApps(value: unknown): RokuApp[] {
  if (!Array.isArray(value)) throw malformed();
  return collect(
    value.map((entry) =>
      typeof entry === "object" && entry !== null
        ? (entry as { id: unknown; name: unknown; type: unknown })
        : { id: undefined, name: undefined, type: undefined },
    ),
  );
}
