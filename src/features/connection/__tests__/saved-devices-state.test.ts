import { describe, expect, it } from "vitest";
import {
  createInitialSavedDevicesState,
  hydrateSavedDevices,
} from "../saved-devices-state";

function createStorage(value: string | null): Storage {
  return {
    length: value === null ? 0 : 1,
    clear() {},
    getItem: () => value,
    key: () => (value === null ? null : "rokulan.savedDevices"),
    removeItem() {},
    setItem() {},
  };
}

describe("saved-device hydration lifecycle", () => {
  it("always starts in a deterministic loading state", () => {
    expect(createInitialSavedDevicesState()).toEqual({ status: "loading", devices: [] });
  });

  it("shows an empty ready state after hydrating empty storage", () => {
    expect(hydrateSavedDevices(createStorage(null))).toEqual({ status: "ready", devices: [] });
  });

  it("loads stored devices only during the hydration transition", () => {
    const storage = createStorage(JSON.stringify({
      version: 1,
      devices: [{
        ip: "192.168.50.20",
        friendlyName: "Synthetic Roku",
        model: "Synthetic Model",
        lastConnectedAt: 1,
      }],
    }));

    expect(createInitialSavedDevicesState().devices).toEqual([]);
    expect(hydrateSavedDevices(storage)).toMatchObject({
      status: "ready",
      devices: [{ ip: "192.168.50.20", friendlyName: "Synthetic Roku" }],
    });
  });

  it("treats malformed storage as an empty ready state", () => {
    expect(hydrateSavedDevices(createStorage("{"))).toEqual({ status: "ready", devices: [] });
  });
});
