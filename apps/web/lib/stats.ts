export type PlayerStats = {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  lastRecordedDate: string | null;
};

const STATS_KEY = "fundle_stats";

const DEFAULT_STATS: PlayerStats = {
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastRecordedDate: null,
};

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

  const next: PlayerStats = {
    ...stats,
    gamesPlayed: stats.gamesPlayed + 1,
    gamesWon: stats.gamesWon + (won ? 1 : 0),
    lastRecordedDate: puzzleDate,
  };

  if (won) {
    const continued =
      stats.lastRecordedDate != null &&
      isYesterday(stats.lastRecordedDate, puzzleDate);
    next.currentStreak = continued ? stats.currentStreak + 1 : 1;
  } else {
    next.currentStreak = 0;
  }

  next.maxStreak = Math.max(next.maxStreak, next.currentStreak);
  saveStats(next);
  return next;
}

export function winRate(stats: PlayerStats): number | null {
  if (stats.gamesPlayed === 0) return null;
  return Math.round((stats.gamesWon / stats.gamesPlayed) * 100);
}
