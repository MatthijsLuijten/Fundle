"use client";

import { useEffect, useState } from "react";
import { getTimeUntilNextPuzzle } from "@/lib/countdown";
import { getStats, winRate, type PlayerStats } from "@/lib/stats";

export function StatsFooter() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);

  useEffect(() => {
    setStats(getStats());
  }, []);

  useEffect(() => {
    const tick = () => setCountdownLabel(getTimeUntilNextPuzzle().label);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const rate = stats ? winRate(stats) : null;
  const hasStats = stats != null && stats.gamesPlayed > 0;

  return (
    <p className="text-xs text-fundle-muted">
      {hasStats && (
        <>
          Reeks {stats.currentStreak}
          {stats.maxStreak > 0 && ` · Best ${stats.maxStreak}`}
          {rate != null && ` · ${rate}% gewonnen`}
          {" · "}
        </>
      )}
      <span className="tabular-nums">
        Volgende puzzel over {countdownLabel ?? "—"}
      </span>
    </p>
  );
}
