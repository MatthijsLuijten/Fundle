import type { StatsRow } from "./supabase";

// A puzzle is only meaningful for difficulty ranking once a handful of people
// have actually finished it — below this, one or two results swing the score
// wildly. Both today's puzzle and the puzzles we rank it against must clear it.
export const MIN_PLAYS = 10;

// We need at least a few comparable puzzles before a percentile says anything.
// TEMPORARY: lowered to 1 while the puzzle archive is tiny so the badge shows in
// dev. With one comparison the percentile can only be 0/100% — restore to 4 once
// there's real history.
export const MIN_COMPARISON_SET = 4;

// A loss counts as one "guess" beyond the max (5 guesses → 6), so puzzles people
// fail to solve register as harder than puzzles everyone limps over the line on.
const LOSS_WEIGHT = 6;

/**
 * Difficulty score for a single puzzle: the average number of guesses it took to
 * finish, treating a loss as 6. Higher = harder. Returns null when there aren't
 * enough plays to trust the number.
 */
export function difficultyScore(stats: StatsRow): number | null {
  if (stats.plays < MIN_PLAYS) return null;
  const buckets = stats.guess_buckets ?? {};
  let totalGuesses = 0;
  let finished = 0;
  for (let g = 1; g <= 5; g++) {
    const n = buckets[String(g)] ?? 0;
    totalGuesses += n * g;
    finished += n;
  }
  const lost = buckets[String(LOSS_WEIGHT)] ?? 0;
  totalGuesses += lost * LOSS_WEIGHT;
  finished += lost;
  if (finished === 0) return null;
  return totalGuesses / finished;
}

export type DifficultyVerdict = {
  /** Whole-number percentage of compared puzzles this one beat on difficulty. */
  percentile: number;
  /** true → harder than `percentile`% of puzzles; false → easier than the rest. */
  harder: boolean;
};

/**
 * Rank today's puzzle against every *earlier* puzzle by difficulty score.
 * Returns null when there isn't enough data to say anything honest.
 */
export function computeDifficultyVerdict(
  all: StatsRow[],
  todayDate: string
): DifficultyVerdict | null {
  const today = all.find((s) => s.puzzle_date === todayDate);
  if (!today) return null;
  const todayScore = difficultyScore(today);
  if (todayScore === null) return null;

  const previous = all
    .filter((s) => s.puzzle_date < todayDate)
    .map(difficultyScore)
    .filter((s): s is number => s !== null);

  if (previous.length < MIN_COMPARISON_SET) return null;

  const easier = previous.filter((s) => s < todayScore).length;
  const fraction = easier / previous.length;
  const harder = fraction >= 0.5;
  // Report the share on the side of the median we landed on, so we never say
  // "harder than 12%" — that reads as easy. Easier puzzles flip to "easier than".
  const percentile = Math.round((harder ? fraction : 1 - fraction) * 100);
  return { percentile, harder };
}
