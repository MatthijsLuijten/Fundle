import type { Hints } from "@/lib/types";
import {
  BedDouble,
  Calendar,
  Home,
  LayoutGrid,
  Leaf,
  MapPin,
  Maximize2,
  ShieldCheck,
  Sparkles,
  Trees,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const LABELS: Record<string, string> = {
  property: "Type",
  city: "Plaats",
  province: "Provincie",
  neighbourhood: "Buurt",
  living_area: "Oppervlakte",
  plot_area: "Perceel",
  energy_label: "Energielabel",
  bedrooms: "Slaapkamers",
  rooms: "Kamers",
  year: "Bouwjaar",
  house_type: "Woningtype",
  insulation: "Isolatie",
  sustainability: "Duurzaamheid",
};

const ICONS: Record<string, LucideIcon> = {
  property: Home,
  city: MapPin,
  province: MapPin,
  neighbourhood: MapPin,
  living_area: Maximize2,
  plot_area: Trees,
  energy_label: Leaf,
  bedrooms: BedDouble,
  rooms: LayoutGrid,
  year: Calendar,
  house_type: Home,
  insulation: ShieldCheck,
  sustainability: Sparkles,
};

function formatValue(key: string, value: string | number): string {
  if (key === "living_area" || key === "plot_area") return `${value} m²`;
  return String(value);
}

export function HintPanel({
  hints,
  newHints = {},
}: {
  hints: Hints;
  newHints?: Hints;
}) {
  const newKeys = new Set(Object.keys(newHints));
  const entries = Object.entries(hints).filter(([k]) => k !== "photo_url");

  if (entries.length === 0) {
    return (
      <p className="text-sm text-fundle-muted">
        Hints verschijnen na je eerste gok.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-2">
      {entries.map(([key, value]) => {
        const isNew = newKeys.has(key);
        const Icon = ICONS[key] ?? Home;
        return (
          <li
            key={key}
            className={`relative rounded-xl px-3 pb-3 pt-2.5 transition-colors ${
              isNew
                ? "animate-fade-in-up border border-fundle-accent/30 bg-fundle-accent-muted"
                : "surface-inset"
            }`}
          >
            {isNew && (
              <span className="absolute right-2 top-2 rounded-md bg-fundle-accent px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wide text-fundle-accent-fg">
                Nieuw
              </span>
            )}

            <div
              className={`flex items-center gap-1.5 ${isNew ? "pr-11" : ""}`}
            >
              <Icon
                className="h-3.5 w-3.5 shrink-0 text-fundle-muted"
                aria-hidden
              />
              <span className="truncate text-[11px] font-medium uppercase tracking-wide text-fundle-muted">
                {LABELS[key] ?? key}
              </span>
            </div>

            <p className="mt-1.5 text-[15px] font-semibold leading-tight text-fundle-text">
              {formatValue(key, value)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
