"use client";

import { useState } from "react";
import { shareResult } from "@/lib/share";
import type { PuzzleState } from "@/lib/types";
import { Check, Share2 } from "lucide-react";

type Props = {
  state: PuzzleState;
  className?: string;
};

export function ShareButton({ state, className = "" }: Props) {
  const [shared, setShared] = useState(false);

  async function handleShare() {
    const ok = await shareResult(state);
    if (ok) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm ${className}`}
    >
      {shared ? (
        <>
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
          Gedeeld!
        </>
      ) : (
        <>
          <Share2 className="h-4 w-4" aria-hidden />
          Deel resultaat
        </>
      )}
    </button>
  );
}
