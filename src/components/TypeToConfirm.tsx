import React, { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui";
import { cx } from "@/lib/utils";

// ── Type-to-confirm destructive action (GitHub / Cloudflare style) ───────────
// The user must TYPE the confirmation word — pasting, dropping, and autofill
// are all blocked so the gate cannot be trivially passed by muscle memory.

type Props = {
  open: boolean;
  title?: string;
  /** Plain-language explanation of the irreversible consequence. */
  message: React.ReactNode;
  /** What the user must type, e.g. "DELETE". Defaults to "DELETE". */
  confirmWord?: string;
  /** Label for the confirm button once the word matches. */
  confirmLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function TypeToConfirm({
  open,
  title = "Are you absolutely sure?",
  message,
  confirmWord = "DELETE",
  confirmLabel = `Delete`,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const matches = typed === confirmWord;

  useEffect(() => {
    if (open) setTyped("");
  }, [open]);

  const blockNonTyping = (e: React.SyntheticEvent) => {
    e.preventDefault(); // paste, drop, autofill and any non-typing insertion
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onCancel} title={title}>
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-lg border border-severity-critical/30 bg-severity-critical/10 p-3.5">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-severity-critical" />
          <div className="text-xs leading-5 text-slate-300">{message}</div>
        </div>

        <div>
          <label className="label">
            Type <span className="font-mono text-severity-critical">{confirmWord}</span> to confirm
          </label>
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onPaste={blockNonTyping}
            onDrop={blockNonTyping}
            onInput={blockNonTypingIfNotTyping}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={confirmWord}
            className={cx(
              "input font-mono tracking-widest",
              typed && !matches && "border-severity-critical/60 focus:border-severity-critical",
            )}
            aria-label={`Type ${confirmWord} to confirm`}
          />
          {typed && !matches && (
            <p className="mt-1 text-[11px] text-severity-critical">Does not match — deletion stays disabled.</p>
          )}
          {!typed && (
            <p className="mt-1 text-[11px] text-slate-500">Paste is disabled. Please type the word by hand.</p>
          )}
        </div>

        <div className="flex gap-2.5">
          <button type="button" onClick={onCancel} disabled={busy} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={!matches || busy} className="btn-danger flex-1 disabled:opacity-40">
            {busy && <Loader2 size={14} className="mr-1.5 inline animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Prevents any way of inserting the word other than real keystrokes: blocks
 * paste/drop/autofill (inputType insertFromPaste|insertDrop|insertReplacementText).
 * onChange-driven typing (inputType insertText) is untouched.
 */
function blockNonTypingIfNotTyping(e: React.FormEvent<HTMLInputElement>): void {
  const inputType = (e.nativeEvent as InputEvent).inputType;
  if (
    inputType &&
    ["insertFromPaste", "insertFromDrop", "insertReplacementText", "insertCompositionText"].includes(inputType)
  ) {
    e.preventDefault();
  }
}
