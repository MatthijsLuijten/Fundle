"use client";

import { Check, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { type CityBidState, loadCityBid } from "@/lib/cityStore";
import { amsterdamToday } from "@/lib/engine";

function eur(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

// The city-mode start screen: one city per day, shown by name, opened on click.
export function CityCard({
  city,
  display,
  onOpen,
}: {
  city: string;
  display: string;
  onOpen: () => void;
}) {
  // Read localStorage only after mount: the server render has no bid, so
  // reading during render would cause a hydration mismatch.
  const [bid, setBid] = useState<CityBidState | null>(null);
  useEffect(() => {
    setBid(loadCityBid(city, amsterdamToday()));
  }, [city]);

  return (
    <section className="surface p-4">
      <h2 className="section-label mb-1">Stad van vandaag</h2>
      <p className="mb-4 text-sm text-fundle-muted">
        Eén woning, één verzegeld bod. Na 18:00 zie je of jij het dichtst bij de
        vraagprijs zat.
      </p>
      <button
        type="button"
        onClick={onOpen}
        aria-label={
          bid ? `${display}, bod van ${eur(bid.bid)} geplaatst` : display
        }
        // Note: opacity modifiers (accent/40) generate no CSS for these
        // var()-based colours in Tailwind v3, so stick to solid tokens.
        className={`flex min-h-[76px] w-full items-center gap-3 rounded-xl border px-4 py-4 text-left transition ${
          bid
            ? "border-fundle-accent bg-fundle-accent-muted"
            : "border-transparent bg-fundle-bg hover:border-fundle-border-strong hover:bg-fundle-accent-muted"
        }`}
      >
        {bid ? (
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fundle-accent"
            aria-hidden
          >
            <Check className="h-4 w-4 text-fundle-accent-fg" />
          </span>
        ) : (
          <MapPin className="h-5 w-5 shrink-0 text-fundle-muted" aria-hidden />
        )}
        <span className="min-w-0">
          <span className="block truncate text-lg font-semibold text-fundle-text">
            {display}
          </span>
          <span className="block truncate text-xs font-medium text-fundle-accent">
            {bid ? `Bod ${eur(bid.bid)}` : "Bekijk de woning"}
          </span>
        </span>
      </button>
    </section>
  );
}
