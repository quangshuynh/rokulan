// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChannelLauncher } from "@/features/channels/channel-launcher";
import { RokuError, type RokuApp } from "@/types/roku";

afterEach(cleanup);

const APPS: RokuApp[] = [
  { id: "12", name: "Synthetic Movies", type: "appl" },
  { id: "tvinput.hdmi1", name: "HDMI 1", type: "tvin" },
];

describe("channel launcher", () => {
  it("shows a loading state, then installed channels", async () => {
    let resolve: (apps: RokuApp[]) => void = () => undefined;
    const loadApps = vi.fn(() => new Promise<RokuApp[]>((done) => { resolve = done; }));
    render(<ChannelLauncher loadApps={loadApps} onLaunch={vi.fn()} />);
    expect(screen.getByText(/Loading installed channels/)).toBeTruthy();
    resolve(APPS);
    expect(await screen.findByRole("button", { name: "Launch Synthetic Movies" })).toBeTruthy();
    expect(screen.getByText("TV input")).toBeTruthy();
    expect(loadApps).toHaveBeenCalledTimes(1);
  });

  it("launches a channel by keyboard and announces the request", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn(async () => undefined);
    render(<ChannelLauncher loadApps={async () => APPS} onLaunch={onLaunch} />);
    const button = await screen.findByRole("button", { name: "Launch Synthetic Movies" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onLaunch).toHaveBeenCalledWith(APPS[0]);
    await waitFor(() => expect(screen.getByText(/Launch request sent for Synthetic Movies/)).toBeTruthy());
  });

  it("shows launch failures", async () => {
    const user = userEvent.setup();
    const onLaunch = vi.fn(async () => {
      throw new RokuError("unknown_error", "Roku could not launch the channel (HTTP 404).");
    });
    render(<ChannelLauncher loadApps={async () => APPS} onLaunch={onLaunch} />);
    await user.click(await screen.findByRole("button", { name: "Launch HDMI 1" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/HTTP 404/);
  });

  it("shows an empty state", async () => {
    render(<ChannelLauncher loadApps={async () => []} onLaunch={vi.fn()} />);
    expect(await screen.findByText(/did not report any launchable channels/)).toBeTruthy();
  });

  it("shows load errors, keeps navigation messaging, and retries", async () => {
    const user = userEvent.setup();
    const loadApps = vi.fn()
      .mockRejectedValueOnce(new RokuError("bridge_unavailable", "RokuLAN could not reach the local bridge."))
      .mockResolvedValueOnce(APPS);
    render(<ChannelLauncher loadApps={loadApps} onLaunch={vi.fn()} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/could not reach the local bridge.*Remote navigation remains available/);
    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(await screen.findByRole("button", { name: "Launch Synthetic Movies" })).toBeTruthy();
  });

  it("filters long channel lists", async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 10 }, (_, index) => ({ id: String(index + 1), name: `Channel ${index + 1}`, type: "appl" as const }));
    render(<ChannelLauncher loadApps={async () => many} onLaunch={vi.fn()} />);
    await user.type(await screen.findByLabelText("Filter channels"), "10");
    expect(screen.getAllByRole("button", { name: /^Launch / })).toHaveLength(1);
    await user.clear(screen.getByLabelText("Filter channels"));
    await user.type(screen.getByLabelText("Filter channels"), "zzz");
    expect(screen.getByText(/No channels match/)).toBeTruthy();
  });
});
