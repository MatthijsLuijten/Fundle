"use client";

import { useEffect, useState } from "react";
import { Flame, Sprout } from "lucide-react";
import { fetchStatsThrough } from "@/lib/supabase";
import { computeDifficultyVerdict, type DifficultyVerdict } from "@/lib/difficulty";

export function DifficultyBadge({ puzzleDate }: { puzzleDate: string }) {
  const [verdict, setVerdict] = useState<DifficultyVerdict | null>(null);

  useEffect(() => {
    let active = true;
    fetchStatsThrough(puzzleDate)
      .then((all) => {
        if (active) setVerdict(computeDifficultyVerdict(all, puzzleDate));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [puzzleDate]);

  if (!verdict) return null;

  const { harder, percentile } = verdict;
  const Icon = harder ? Flame : Sprout;

  return (
    <div
      className={`mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
        harder
          ? "bg-orange-100 text-orange-700"
          : "bg-emerald-100 text-emerald-700"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      <span>
        {harder ? "Lastiger" : "Makkelijker"} dan{" "}
        <span className="tabular-nums font-semibold">{percentile}%</span> van alle Fundles
      </span>
    </div>
  );
}
