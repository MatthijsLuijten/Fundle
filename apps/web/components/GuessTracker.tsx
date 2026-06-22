import { formatEur } from "@/lib/api";
import type { GuessRecord } from "@/lib/types";
import { ArrowDown, ArrowUp } from "lucide-react";

type Props = {
  guesses: GuessRecord[];
  maxGuesses: number;
};

export function GuessTracker({ guesses, maxGuesses }: Props) {
  const slots = Array.from({ length: maxGuesses }, (_, i) => guesses[i] ?? null);

  return (
    <section className="surface p-3.5">
      <h2 className="section-label mb-2.5 px-1">Je gokken</h2>
      <ul className="space-y-1" aria-label="Je gokken">
        {slots.map((guess, i) => (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
              guess ? "surface-inset" : ""
            }`}
          >
            {guess ? (
              <>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold tabular-nums">
                  {formatEur(guess.amount)}
                </span>
                <div className="flex shrink-0 items-center gap-1.5 text-xs text-fundle-muted">
                  {guess.direction ? (
                    <span className="inline-flex items-center gap-0.5 font-medium">
                      {guess.direction === "high" ? (
                        <ArrowDown className="h-3 w-3" aria-hidden />
                      ) : (
                        <ArrowUp className="h-3 w-3" aria-hidden />
                      )}
                      {guess.direction === "high" ? "Lager" : "Hoger"}
                    </span>
                  ) : (
                    <span
                      className="font-semibold text-emerald-600"
                      role="img"
                      aria-label="Raak"
                    >
                      🎉
                    </span>
                  )}
                </div>
              </>
            ) : (
              <span className="text-sm text-fundle-muted/40">—</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
