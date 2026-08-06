"use client";

import { MapPin } from "lucide-react";
import { CITIES } from "@/lib/cityData";

export function CityPicker({ onSelect }: { onSelect: (city: string) => void }) {
  return (
    <section className="surface p-4">
      <h2 className="section-label mb-1">Kies een stad</h2>
      <p className="mb-4 text-sm text-fundle-muted">
        Eén woning per stad per dag. Plaats één verzegeld bod. Na 18:00 zie je of
        jij het dichtst bij de vraagprijs zat.
      </p>
      <ul className="grid grid-cols-2 gap-2.5">
        {CITIES.map((c) => (
          <li key={c.key}>
            <button
              type="button"
              onClick={() => onSelect(c.key)}
              className="surface-inset flex w-full items-center gap-2 rounded-xl px-3 py-3.5 text-left transition hover:border-fundle-accent/40 hover:bg-fundle-accent-muted"
            >
              <MapPin className="h-4 w-4 shrink-0 text-fundle-muted" aria-hidden />
              <span className="truncate text-[15px] font-semibold text-fundle-text">
                {c.display}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
