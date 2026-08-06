"use client";

import { Check, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { CITIES } from "@/lib/cityData";
import { type CityBidState, loadCityBids } from "@/lib/cityStore";
import { amsterdamToday } from "@/lib/engine";

const CITY_KEYS = CITIES.map((c) => c.key);

function eur(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CityPicker({ onSelect }: { onSelect: (city: string) => void }) {
  // Read localStorage only after mount: the server render has no bids, so
  // reading during render would cause a hydration mismatch.
  const [bids, setBids] = useState<Record<string, CityBidState>>({});
  useEffect(() => {
    setBids(loadCityBids(CITY_KEYS, amsterdamToday()));
  }, []);

  const placed = Object.keys(bids).length;

  return (
    <section className="surface p-4">
      <h2 className="section-label mb-1">Kies een stad</h2>
      <p className="mb-4 text-sm text-fundle-muted">
        Eén woning per stad per dag. Plaats één verzegeld bod. Na 18:00 zie je of
        jij het dichtst bij de vraagprijs zat.
        {placed > 0 && (
          <>
            {" "}
            <span className="font-medium text-fundle-text">
              Je hebt vandaag op {placed} van de {CITIES.length} steden geboden.
            </span>
          </>
        )}
      </p>
      <ul className="grid grid-cols-2 gap-2.5">
        {CITIES.map((c) => {
          const placedBid = bids[c.key];
          return (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => onSelect(c.key)}
                aria-label={
                  placedBid
                    ? `${c.display}, bod van ${eur(placedBid.bid)} geplaatst`
                    : c.display
                }
                // Note: opacity modifiers (accent/40) generate no CSS for these
                // var()-based colours in Tailwind v3, so stick to solid tokens.
                className={`flex min-h-[60px] w-full items-center gap-2.5 rounded-xl border px-3 py-3 text-left transition ${
                  placedBid
                    ? "border-fundle-accent bg-fundle-accent-muted"
                    : "border-transparent bg-fundle-bg hover:border-fundle-border-strong hover:bg-fundle-accent-muted"
                }`}
              >
                {placedBid ? (
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-fundle-accent"
                    aria-hidden
                  >
                    <Check className="h-3.5 w-3.5 text-fundle-accent-fg" />
                  </span>
                ) : (
                  <MapPin
                    className="h-4 w-4 shrink-0 text-fundle-muted"
                    aria-hidden
                  />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold text-fundle-text">
                    {c.display}
                  </span>
                  {placedBid && (
                    <span className="block truncate text-xs font-medium text-fundle-accent">
                      Bod {eur(placedBid.bid)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
