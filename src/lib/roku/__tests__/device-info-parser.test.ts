import { describe, expect, it } from "vitest";
import { parseRokuDeviceInfo } from "@/lib/roku/device-info-parser";

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
