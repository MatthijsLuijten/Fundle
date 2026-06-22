"use client";

import { useState } from "react";
import { copyResult } from "@/lib/share";
import type { PuzzleState } from "@/lib/types";
import { Check, Copy } from "lucide-react";

type Props = {
  state: PuzzleState;
  className?: string;
};

export function CopyResultButton({ state, className = "" }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyResult(state);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
          Gekopieerd!
        </>
      ) : (
        <>
          <Copy className="h-4 w-4" aria-hidden />
          Kopieer resultaat
        </>
      )}
    </button>
  );
}
