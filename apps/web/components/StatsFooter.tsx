"use client";

import { useEffect, useState } from "react";
import { getTimeUntilNextPuzzle } from "@/lib/countdown";
import { getStats, type PlayerStats } from "@/lib/stats";

export function StatsFooter() {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [countdownLabel, setCountdownLabel] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => setStats(getStats());
    refresh();
    window.addEventListener("fundle-stats-updated", refresh);
    return () => window.removeEventListener("fundle-stats-updated", refresh);
  }, []);

  useEffect(() => {
    const tick = () => setCountdownLabel(getTimeUntilNextPuzzle().label);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const hasStats = stats != null && stats.gamesPlayed > 0;

  return (
    <p className="text-xs text-fundle-muted">
      {hasStats && (
        <>
          🔥 streak {stats.currentStreak}
          {stats.currentWinStreak > 0 &&
            ` · 🎯 ${stats.currentWinStreak} op rij`}
          {" · "}
        </>
      )}
      <span className="tabular-nums">
        Volgende puzzel over {countdownLabel ?? "—"}
      </span>
    </p>
  );
}
