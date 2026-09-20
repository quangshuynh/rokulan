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
  <network-name>HomeWifi</network-name>
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
      networkName: "HomeWifi",
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
});
