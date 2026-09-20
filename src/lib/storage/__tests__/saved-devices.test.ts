import { describe, expect, it } from "vitest";
import {
  loadSavedDevices,
  rememberDevice,
  removeSavedDevice,
} from "@/lib/storage/saved-devices";

function createStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));

  return {
    get length() {
      return data.size;
    },
    clear() {
      data.clear();
    },
    getItem(key) {
      return data.get(key) ?? null;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    removeItem(key) {
      data.delete(key);
    },
    setItem(key, value) {
      data.set(key, value);
    },
  };
}

describe("saved device storage", () => {
  it("loads migrated array format", () => {
    const storage = createStorage({
      "rokulan.savedDevices": JSON.stringify([
        {
          ip: "192.168.1.12",
          friendlyName: "Bedroom",
          model: "Roku Express",
          lastConnectedAt: 1,
        },
      ]),
    });

    expect(loadSavedDevices(storage)).toHaveLength(1);
  });

  it("returns empty list for corrupted json", () => {
    const storage = createStorage({ "rokulan.savedDevices": "{" });
    expect(loadSavedDevices(storage)).toEqual([]);
  });

  it("remembers and removes devices", () => {
    const storage = createStorage();

    const devices = rememberDevice(storage, {
      ip: "192.168.1.99",
      friendlyName: "Office",
      modelName: "Roku Ultra",
      isTv: false,
    });
    expect(devices[0].friendlyName).toBe("Office");

    const afterRemoval = removeSavedDevice(storage, "192.168.1.99");
    expect(afterRemoval).toEqual([]);
  });
});
