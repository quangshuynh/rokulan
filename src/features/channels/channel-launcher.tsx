"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { RokuApp } from "@/types/roku";

interface ChannelLauncherProps {
  /** Loads installed channels. Rejects with an Error whose message is safe to display. */
  loadApps: () => Promise<RokuApp[]>;
  onLaunch: (app: RokuApp) => Promise<void>;
}

type LoadState =
  | { status: "loading" }
  | { status: "ready"; apps: RokuApp[] }
  | { status: "error"; message: string };

type Feedback = { kind: "success" | "error"; message: string } | null;

const FILTER_THRESHOLD = 8;

const actionClassName =
  "min-h-11 rounded-xl border border-violet-400/25 bg-zinc-900/75 px-3 py-2 text-sm font-medium text-zinc-100 transition motion-reduce:transition-none hover:border-violet-400/60 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-55";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function ChannelLauncher({ loadApps, onLaunch }: ChannelLauncherProps) {
  const headingId = useId();
  const filterId = useId();
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [filter, setFilter] = useState("");
  const [launching, setLaunching] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const requestId = useRef(0);

  const load = useCallback(() => {
    const current = ++requestId.current;
    // State updates happen only in async callbacks and are dropped when stale.
    loadApps().then(
      (apps) => {
        if (current === requestId.current) setState({ status: "ready", apps });
      },
      (error: unknown) => {
        if (current === requestId.current) {
          setState({ status: "error", message: errorMessage(error, "Unable to load channels.") });
        }
      },
    );
  }, [loadApps]);

  useEffect(() => {
    load();
    return () => {
      // Ignore results that arrive after unmount or a newer request.
      requestId.current += 1;
    };
  }, [load]);

  const refresh = () => {
    setState({ status: "loading" });
    setFeedback(null);
    load();
  };

  const launch = async (app: RokuApp) => {
    if (launching) return;
    setLaunching(app.id);
    setFeedback(null);
    try {
      await onLaunch(app);
      setFeedback({ kind: "success", message: `Launch request sent for ${app.name}.` });
    } catch (error) {
      setFeedback({ kind: "error", message: errorMessage(error, "Unable to launch the channel.") });
    } finally {
      setLaunching(null);
    }
  };

  const apps = state.status === "ready" ? state.apps : [];
  const query = filter.trim().toLocaleLowerCase();
  const visibleApps = query ? apps.filter((app) => app.name.toLocaleLowerCase().includes(query)) : apps;

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={state.status === "loading"}
      className="rounded-3xl border border-violet-400/20 bg-zinc-950/70 p-4 backdrop-blur-md sm:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={headingId} className="text-base font-semibold text-zinc-50">
          Channels
        </h2>
        <button type="button" className={actionClassName} onClick={refresh} disabled={state.status === "loading"}>
          Refresh
        </button>
      </div>

      {state.status === "loading" ? (
        <p role="status" className="mt-3 text-sm text-zinc-400">
          Loading installed channels…
        </p>
      ) : null}

      {state.status === "error" ? (
        <div role="alert" className="mt-3 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {state.message} Remote navigation remains available.
        </div>
      ) : null}

      {state.status === "ready" && apps.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">This Roku did not report any launchable channels.</p>
      ) : null}

      {apps.length > FILTER_THRESHOLD ? (
        <div className="mt-3">
          <label htmlFor={filterId} className="sr-only">
            Filter channels
          </label>
          <input
            id={filterId}
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter channels"
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 w-full rounded-xl border border-violet-400/25 bg-black/40 px-3 py-2 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          />
        </div>
      ) : null}

      {apps.length > 0 ? (
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4" aria-label="Installed channels">
          {visibleApps.map((app) => (
            <li key={app.id} className="min-w-0">
              <button
                type="button"
                className={`${actionClassName} flex h-full w-full flex-col items-start gap-0.5 text-left`}
                onClick={() => void launch(app)}
                aria-label={`Launch ${app.name}`}
                disabled={launching !== null}
              >
                <span className="line-clamp-2 break-words">{app.name}</span>
                {app.type === "tvin" ? <span className="text-xs text-zinc-400">TV input</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {apps.length > 0 && visibleApps.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-400">No channels match that filter.</p>
      ) : null}

      <div role="status" aria-live="polite" className="mt-2 text-sm">
        {feedback?.kind === "success" ? <p className="text-emerald-200">{feedback.message}</p> : null}
      </div>
      {feedback?.kind === "error" ? (
        <p role="alert" className="mt-1 rounded-xl border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {feedback.message}
        </p>
      ) : null}
    </section>
  );
}
