export type PlayerStats = {
  gamesPlayed: number;
  currentStreak: number;
  currentWinStreak: number;
  lastRecordedDate: string | null;
};

const STATS_KEY = "fundle_stats";

const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  currentStreak: 0,
  currentWinStreak: 0,
  lastRecordedDate: null,
};

const STATS_UPDATED_EVENT = "fundle-stats-updated";

export function getStats(): PlayerStats {
  if (typeof window === "undefined") return DEFAULT_STATS;
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) return DEFAULT_STATS;
    return { ...DEFAULT_STATS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_STATS;
  }
}

function saveStats(stats: PlayerStats): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function isYesterday(dateStr: string, puzzleDate: string): boolean {
  const d = new Date(puzzleDate + "T12:00:00");
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10) === dateStr;
}

export function recordGameResult(
  puzzleDate: string,
  won: boolean
): PlayerStats {
  const stats = getStats();
  if (stats.lastRecordedDate === puzzleDate) return stats;

  const continuedPlay =
    stats.lastRecordedDate != null &&
    isYesterday(stats.lastRecordedDate, puzzleDate);

  const next: PlayerStats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    lastRecordedDate: puzzleDate,
    currentStreak: continuedPlay ? stats.currentStreak + 1 : 1,
  };

  if (won) {
    const continuedWin = continuedPlay && stats.currentWinStreak > 0;
    next.currentWinStreak = continuedWin ? stats.currentWinStreak + 1 : 1;
  } else {
    next.currentWinStreak = 0;
  }

  saveStats(next);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STATS_UPDATED_EVENT));
  }
  return next;
}
