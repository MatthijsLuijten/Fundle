"use client";

import { formatInputDigits, parseAmount } from "@/lib/format";
import { Loader2 } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  shake?: boolean;
};

export function GuessInput({
  value,
  onChange,
  onSubmit,
  submitting,
  shake = false,
}: Props) {
  function handleChange(raw: string) {
    onChange(formatInputDigits(raw));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit();
  }

  const hasValue = parseAmount(value) != null;

  return (
    <form
      onSubmit={handleSubmit}
      className={`w-full ${shake ? "animate-shake" : ""}`}
    >
      <label className="section-label mb-2.5 block" htmlFor="price">
        Jouw schatting
      </label>
      <div className="flex w-full gap-2.5">
        <div className="relative min-w-0 flex-1">
          <span
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-fundle-muted"
            aria-hidden
          >
            €
          </span>
          <input
            id="price"
            type="text"
            inputMode="numeric"
            placeholder="450.000"
            value={value}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full rounded-xl border border-fundle-border bg-fundle-bg-elevated py-3.5 pl-9 pr-4 text-base font-medium tabular-nums outline-none transition placeholder:text-fundle-muted/50 focus:border-fundle-accent/40 focus:ring-2 focus:ring-fundle-accent-muted disabled:opacity-50"
            disabled={submitting}
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !hasValue}
          className="btn-primary shrink-0 px-6 py-3.5 text-sm"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-label="Bezig…" />
          ) : (
            "Gok"
          )}
        </button>
      </div>
    </form>
  );
}
