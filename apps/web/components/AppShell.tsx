"use client";

import { HelpCircle } from "lucide-react";
import Image from "next/image";
import { StatsFooter } from "./StatsFooter";

type Props = {
  puzzleNumber?: number;
  subtitle?: string;
  onHelpClick: () => void;
};

export function AppHeader({ puzzleNumber, subtitle, onHelpClick }: Props) {
  return (
    <header className="border-b border-fundle-border bg-[var(--fundle-orange)]">
      <div className="relative mx-auto w-full max-w-md px-4 pb-4 pt-5">
        <div className="flex items-center gap-3 pr-12">
          <Image
            src="/logo.png"
            alt=""
            width={1254}
            height={1254}
            priority
            className="h-14 w-auto shrink-0"
            aria-hidden
          />
          <div className="min-w-0">
            <h1 className="app-title leading-none">
              <span className="app-title-fund">fund</span>
              <span className="app-title-le">le</span>
            </h1>
            {(puzzleNumber != null || subtitle) && (
              <p className="mt-0.5 text-xs text-white/80">
                {puzzleNumber != null && (
                  <span className="font-semibold text-white">
                    #{puzzleNumber}
                  </span>
                )}
                {subtitle && (
                  <span>
                    {puzzleNumber != null ? " · " : ""}
                    {subtitle}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onHelpClick}
          className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/30 bg-white/15 text-white shadow-sm backdrop-blur-sm transition hover:bg-white/25 active:scale-[0.98]"
          aria-label="Hoe werkt het?"
        >
          <HelpCircle className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}

export function AppFooter() {
  return (
    <footer className="mt-auto border-t border-fundle-border px-4 py-6">
      <div className="mx-auto w-full max-w-md space-y-2.5 text-center">
        <StatsFooter />
        <p className="text-xs leading-relaxed text-fundle-muted">
          Binnen 2% van de vraagprijs telt als goed. Onofficiële Funda-puzzel.
        </p>
      </div>
    </footer>
  );
}
