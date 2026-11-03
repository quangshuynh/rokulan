import { describe, expect, it } from "vitest";
import {
  parseRokuCapabilities,
  parseRokuDeviceInfo,
  sanitizeRokuCapabilities,
} from "@/lib/roku/device-info-parser";

const SAMPLE_XML = `
<device-info>
  <friendly-device-name>Living Room Roku</friendly-device-name>
  <vendor-name>Roku</vendor-name>
  <model-name>Roku Ultra</model-name>
  <model-number>4802X</model-number>
  <is-tv>false</is-tv>
  <screen-size>55</screen-size>
  <power-mode>PowerOn</power-mode>
  <software-version>14.0.0</software-version>
</device-info>`;

describe("device info parser", () => {
  it("parses typed Roku fields", () => {
    expect(parseRokuDeviceInfo(SAMPLE_XML, "192.168.1.40")).toEqual({
      ip: "192.168.1.40",
      friendlyName: "Living Room Roku",
      modelName: "Roku Ultra",
      modelNumber: "4802X",
      isTv: false,
      screenSize: 55,
      powerMode: "PowerOn",
      softwareVersion: "14.0.0",
      capabilities: { tv: "unsupported", findRemote: "unknown" },
    });
  });

  it("rejects non-roku vendors", () => {
    expect(() =>
      parseRokuDeviceInfo(
        SAMPLE_XML.replace("<vendor-name>Roku</vendor-name>", "<vendor-name>Acme</vendor-name>"),
        "192.168.1.40",
      ),
    ).toThrowError(/does not appear to be a Roku/i);
  });

  it("decodes standard XML entities", () => {
    const result = parseRokuDeviceInfo(
      SAMPLE_XML.replace("Living Room Roku", "Living &amp; Family Roku"),
      "192.168.1.40",
    );
    expect(result.friendlyName).toBe("Living & Family Roku");
  });

  it.each([
    "not xml",
    "<device-info><friendly-device-name>Room</friendly-device-name>",
    "<device-info><vendor-name>Roku</vendor-name></device-info>",
    "<!DOCTYPE x [<!ENTITY xxe SYSTEM 'file:///secret'>]><device-info><friendly-device-name>&xxe;</friendly-device-name><model-name>X</model-name></device-info>",
  ])("rejects malformed or unsafe XML", (xml) => {
    expect(() => parseRokuDeviceInfo(xml, "192.168.1.40")).toThrowError(
      /valid Roku|missing required/i,
    );
  });
});

describe("device capability parsing", () => {
  it("reads representative Roku TV capability fields", () => {
    const xml = SAMPLE_XML.replace("<is-tv>false</is-tv>", `<is-tv>true</is-tv>
      <supports-find-remote>true</supports-find-remote>
      <find-remote-is-possible>true</find-remote-is-possible>`);
    expect(parseRokuDeviceInfo(xml, "192.168.1.40").capabilities).toEqual({ tv: "supported", findRemote: "supported" });
  });

  it("treats find remote as unsupported when the device reports it is not currently possible", () => {
    expect(parseRokuCapabilities(
      "<supports-find-remote>true</supports-find-remote><find-remote-is-possible>false</find-remote-is-possible>",
    ).findRemote).toBe("unsupported");
    expect(parseRokuCapabilities("<supports-find-remote>false</supports-find-remote>").findRemote).toBe("unsupported");
    expect(parseRokuCapabilities("<supports-find-remote>true</supports-find-remote>").findRemote).toBe("supported");
  });

  it("keeps missing, empty, and unrecognized values unknown", () => {
    expect(parseRokuCapabilities("")).toEqual({ tv: "unknown", findRemote: "unknown" });
    expect(parseRokuCapabilities("<is-tv>maybe</is-tv><supports-find-remote></supports-find-remote>")).toEqual({
      tv: "unknown",
      findRemote: "unknown",
    });
    expect(parseRokuCapabilities("<is-tv> TRUE </is-tv>").tv).toBe("supported");
  });

  it("ignores unknown device fields and never exposes hardware identifiers", () => {
    const xml = SAMPLE_XML.replace("<is-tv>false</is-tv>", `<is-tv>false</is-tv>
      <serial-number>SYNTHETIC-SERIAL</serial-number>
      <device-id>SYNTHETIC-ID</device-id>
      <wifi-mac>00:00:5e:00:53:01</wifi-mac>
      <future-capability>true</future-capability>`);
    const parsed = parseRokuDeviceInfo(xml, "192.168.1.40");
    expect(JSON.stringify(parsed)).not.toMatch(/SYNTHETIC-SERIAL|SYNTHETIC-ID|00:00:5e/);
  });

  it("does not infer capabilities from model names", () => {
    const xml = SAMPLE_XML.replace("<model-name>Roku Ultra</model-name>", "<model-name>Roku TV with Find Remote</model-name>")
      .replace("<is-tv>false</is-tv>", "");
    expect(parseRokuDeviceInfo(xml, "192.168.1.40").capabilities).toEqual({ tv: "unknown", findRemote: "unknown" });
  });

  it("sanitizes capability JSON from the bridge", () => {
    expect(sanitizeRokuCapabilities(undefined)).toBeUndefined();
    expect(sanitizeRokuCapabilities("supported")).toBeUndefined();
    expect(sanitizeRokuCapabilities({ tv: "supported", findRemote: "yes", extra: true })).toEqual({
      tv: "supported",
      findRemote: "unknown",
    });
  });
});
