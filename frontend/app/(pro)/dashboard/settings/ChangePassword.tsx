"use client";

import { useState, useTransition } from "react";
import { Check, KeyRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { changePassword } from "./actions";

/** The booking form's field, as in the portal's other forms. */
const FIELD = "h-11 rounded-xl border-line bg-white px-3.5 text-sm focus-visible:ring-brand-500/30";

/**
 * "Change password", folded into a button until asked for. The new one is typed twice, and the
 * two checked here before anything is sent; the strength rules are WorkOS's, which says why when it
 * refuses one.
 */
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startChanging] = useTransition();

  const close = () => {
    setOpen(false);
    setCurrent("");
    setNext("");
    setAgain("");
    setProblem(null);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (next.length < 8) return setProblem("Choose a new password of at least 8 characters.");
    if (next !== again) return setProblem("The two new passwords are not the same.");
    if (next === current) return setProblem("The new password is the same as the current one.");

    setProblem(null);
    startChanging(async () => {
      const failed = await changePassword(current, next);
      if (failed) {
        setProblem(failed);
        return;
      }
      close();
      setDone(true);
    });
  };

  if (!open) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setOpen(true);
          }}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line px-4 text-sm font-semibold text-muted-ink hover:bg-brand-50 hover:text-brand-500"
        >
          <KeyRound className="size-3.5" />
          Change password
        </button>
        {done && (
          <span className="inline-flex items-center gap-1 text-sm text-[#07734F]">
            <Check className="size-3.5" /> Password changed
          </span>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <Field id="password-current" label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2">
        <Field id="password-new" label="New password" value={next} onChange={setNext} autoComplete="new-password" />
        <Field id="password-again" label="New password again" value={again} onChange={setAgain} autoComplete="new-password" />
      </div>
      {problem && <p className="m-0 text-xs text-destructive">{problem}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={close}
          disabled={pending}
          className="h-9 rounded-full border border-line px-4 text-sm font-semibold text-muted-ink"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={pending || !current || !next || !again}
          className="h-9 rounded-full bg-brand px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Changing…" : "Change password"}
        </button>
      </div>
    </form>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-ink">
        {label}
      </Label>
      <Input
        id={id}
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className={FIELD}
      />
    </div>
  );
}
