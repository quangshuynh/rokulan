"use client";

import { useId, useState, type FormEvent } from "react";
import { getTextEntryValidationError, MAX_TEXT_ENTRY_LENGTH } from "@/lib/roku/text-entry";

interface TextEntryPanelProps {
  /** Sends text to the Roku. Rejects with an Error whose message is safe to display. */
  onSend: (text: string) => Promise<void>;
  /** Sends one Backspace keypress. */
  onBackspace: () => Promise<void>;
}

type Feedback = { kind: "success" | "error"; message: string } | null;

const controlClassName =
  "rounded-xl border border-violet-400/25 px-4 py-3 text-sm font-medium transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:opacity-55";

/**
 * Text is held only in component state while typing and cleared after a
 * successful send. It is never persisted, logged, or read from the clipboard.
 */
export function TextEntryPanel({ onSend, onBackspace }: TextEntryPanelProps) {
  const inputId = useId();
  const hintId = useId();
  const countId = useId();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const length = Array.from(text).length;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;
    const invalid = getTextEntryValidationError(text);
    if (invalid) {
      setFeedback({ kind: "error", message: invalid });
      return;
    }

    setSending(true);
    setFeedback(null);
    try {
      await onSend(text);
      setText("");
      setFeedback({
        kind: "success",
        message: `Sent ${length} character${length === 1 ? "" : "s"} to the Roku.`,
      });
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to send text.",
      });
    } finally {
      setSending(false);
    }
  };

  const backspace = async () => {
    if (sending) return;
    setSending(true);
    setFeedback(null);
    try {
      await onBackspace();
    } catch (error) {
      setFeedback({
        kind: "error",
        message: error instanceof Error ? error.message : "Unable to send Backspace.",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <section
      aria-labelledby={`${inputId}-heading`}
      className="rounded-3xl border border-violet-400/20 bg-zinc-950/70 p-4 backdrop-blur-md sm:p-6"
    >
      <h2 id={`${inputId}-heading`} className="text-base font-semibold text-zinc-50">
        Text entry
      </h2>
      <p id={hintId} className="mt-1 text-xs text-zinc-400">
        Types into the Roku app&apos;s focused search or keyboard field. Some apps do not accept text entry. Text is
        sent only to your Roku and is not saved.
      </p>

      <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => void submit(event)} noValidate>
        <label htmlFor={inputId} className="sr-only">
          Text to send to Roku
        </label>
        <input
          id={inputId}
          type="text"
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            if (feedback?.kind === "error") setFeedback(null);
          }}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="send"
          aria-describedby={`${hintId} ${countId}`}
          aria-invalid={length > MAX_TEXT_ENTRY_LENGTH || undefined}
          className="min-h-12 min-w-0 flex-1 rounded-xl border border-violet-400/25 bg-black/40 px-3 py-3 text-base text-zinc-100 placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          placeholder="Search text"
          readOnly={sending}
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="submit"
            className={`${controlClassName} min-h-12 bg-violet-600/40 text-zinc-50 hover:bg-violet-600/55`}
            disabled={sending || length === 0}
          >
            {sending ? "Sending…" : "Send"}
          </button>
          <button
            type="button"
            className={`${controlClassName} min-h-12 bg-zinc-900/75 text-zinc-100 hover:bg-violet-500/15`}
            onClick={() => void backspace()}
            aria-label="Send Backspace to Roku"
            disabled={sending}
          >
            Delete
          </button>
        </div>
      </form>

      <p id={countId} className={`mt-2 text-xs ${length > MAX_TEXT_ENTRY_LENGTH ? "text-amber-200" : "text-zinc-500"}`}>
        {length} / {MAX_TEXT_ENTRY_LENGTH} characters
      </p>

      <div aria-live="polite" role="status" className="mt-1 text-sm">
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
