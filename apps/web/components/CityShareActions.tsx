"use client";

import { Check, Copy, Share2 } from "lucide-react";
import { useState } from "react";
import { copyCityResult, shareCityResult, type CityShareData } from "@/lib/share";

// Share + copy for the city reveal. The shared text stacks today's daily result
// (if played) on top of the city placement — see buildCityShareText.
export function CityShareActions({
  city,
  className = "",
}: {
  city: CityShareData;
  className?: string;
}) {
  const [shared, setShared] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    if (await shareCityResult(city)) {
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  }

  async function handleCopy() {
    if (await copyCityResult(city)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div
      className={`flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center ${className}`}
    >
      <button
        type="button"
        onClick={handleShare}
        className="btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
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
      <button
        type="button"
        onClick={handleCopy}
        className="btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
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
    </div>
  );
}
