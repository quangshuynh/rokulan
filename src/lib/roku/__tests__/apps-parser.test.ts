import { describe, expect, it } from "vitest";
import { MAX_APPS, isRokuAppId, parseRokuApps, sanitizeRokuApps } from "@/lib/roku/apps-parser";

const SAMPLE_APPS = `<?xml version="1.0" encoding="UTF-8" ?>
<apps>
  <app id="31012" type="menu" version="1.0.0">Synthetic Menu</app>
  <app id="12" type="appl" version="4.1.218">Synthetic Movies</app>
  <app id="837" subtype="ndka" type="appl" version="2.21.4">Tom &amp; Jerry&#39;s &#x1F3AC;</app>
  <app id='tvinput.hdmi1' type='tvin' version='1.0.0'>HDMI 1</app>
  <app id="dev" type="appl" version="1.0.0">Sideloaded</app>
</apps>`;

describe("installed apps parser", () => {
  it("parses representative ECP query/apps XML into typed apps", () => {
    expect(parseRokuApps(SAMPLE_APPS)).toEqual([
      { id: "31012", name: "Synthetic Menu", type: "menu" },
      { id: "12", name: "Synthetic Movies", type: "appl" },
      { id: "837", name: "Tom & Jerry's 🎬", type: "appl" },
      { id: "tvinput.hdmi1", name: "HDMI 1", type: "tvin" },
      { id: "dev", name: "Sideloaded", type: "appl" },
    ]);
  });

  it("returns an empty list for empty app documents", () => {
    expect(parseRokuApps("<apps></apps>")).toEqual([]);
    expect(parseRokuApps("<apps/>")).toEqual([]);
  });

  it("drops duplicate and invalid identifiers and unknown types safely", () => {
    const xml = `<apps>
      <app id="12" type="appl">First</app>
      <app id="12" type="appl">Duplicate</app>
      <app id="../query/device-info" type="appl">Traversal</app>
      <app id="12/../../x" type="appl">Slash</app>
      <app id="http://example.test" type="appl">Url</app>
      <app type="appl">Missing</app>
      <app id="99" type="weird">  </app>
    </apps>`;
    expect(parseRokuApps(xml)).toEqual([
      { id: "12", name: "First", type: "appl" },
      { id: "99", name: "Channel 99", type: "unknown" },
    ]);
  });

  it("bounds app names and app count", () => {
    const longName = "n".repeat(500);
    const many = Array.from({ length: MAX_APPS + 20 }, (_, index) => `<app id="${index + 1}" type="appl">${longName}</app>`).join("");
    const apps = parseRokuApps(`<apps>${many}</apps>`);
    expect(apps).toHaveLength(MAX_APPS);
    expect(apps[0].name).toHaveLength(100);
  });

  it.each([
    "",
    "not xml",
    "<device-info></device-info>",
    "<apps><app id=\"12\">Unclosed</apps>",
    "<apps><app id=\"12\"><b>Nested</b></app></apps>",
    "<apps>",
    "<!DOCTYPE apps [<!ENTITY x SYSTEM 'file:///etc/passwd'>]><apps><app id=\"1\">&x;</app></apps>",
    "<apps></apps><extra/>",
  ])("rejects malformed or unsafe XML %#", (xml) => {
    expect(() => parseRokuApps(xml)).toThrow(expect.objectContaining({ code: "malformed_apps_response" }));
  });

  it("validates identifiers narrowly", () => {
    for (const id of ["12", "2213", "dev", "tvinput.hdmi1", "tvinput.dtv"]) expect(isRokuAppId(id)).toBe(true);
    for (const id of ["", "..", "12a", "tvinput.", "tvinput.hdmi1/x", "TVINPUT.HDMI1", " 12", "12345678901", 12, null]) {
      expect(isRokuAppId(id)).toBe(false);
    }
  });

  it("re-validates app data crossing the bridge as JSON", () => {
    expect(sanitizeRokuApps([
      { id: "12", name: "Movies", type: "appl" },
      { id: "12", name: "Dup", type: "appl" },
      { id: "../x", name: "Bad", type: "appl" },
      "junk",
      null,
      { id: "13", name: 7, type: "evil" },
    ])).toEqual([
      { id: "12", name: "Movies", type: "appl" },
      { id: "13", name: "Channel 13", type: "unknown" },
    ]);
    expect(() => sanitizeRokuApps({ apps: [] })).toThrow(expect.objectContaining({ code: "malformed_apps_response" }));
  });
});
