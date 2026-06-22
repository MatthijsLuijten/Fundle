"use client";

import { useEffect } from "react";
import { markHelpSeen } from "@/lib/storage";
import { X } from "lucide-react";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function HowToPlayModal({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  function handleClose() {
    markHelpSeen();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="how-to-play-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        aria-label="Sluiten"
        onClick={handleClose}
      />

      <div className="surface relative z-10 w-full max-w-md animate-fade-in-up p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="how-to-play-title" className="text-lg font-bold">
            Hoe werkt het?
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="btn-ghost flex h-9 w-9 shrink-0 items-center justify-center !p-0 text-fundle-muted"
            aria-label="Sluiten"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ol className="space-y-4 text-sm leading-relaxed text-fundle-muted">
          {[
            <>Schat de <strong className="text-fundle-text">vraagprijs</strong> van een echte Funda-woning.</>,
            <>Je hebt <strong className="text-fundle-text">5 gokken</strong>. Elke foute gok ontgrendelt een nieuwe hint.</>,
            <>Zit je binnen <strong className="text-fundle-text">2%</strong> van de vraagprijs? Dan heb je gewonnen!</>,
            <>Elke dag een nieuwe puzzel. Deel je resultaat met vrienden.</>,
          ].map((text, i) => (
            <li key={i} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-fundle-accent-muted text-xs font-bold text-fundle-accent">
                {i + 1}
              </span>
              <span>{text}</span>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={handleClose}
          className="btn-primary mt-6 w-full py-3.5"
        >
          Begrepen
        </button>
      </div>
    </div>
  );
}
