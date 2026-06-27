export type GuessRecord = {
  amount: number;
  direction: "high" | "low" | null;
};

export type GameResult = {
  won: boolean;
  answer_eur: number;
  formatted_price: string;
  url: string | null;
  city: string | null;
  listed_ago: string | null;
  community_finished: number;
  community_won: number;
};

export type Hints = Record<string, string | number>;

export type PuzzleState = {
  puzzle_date: string;
  puzzle_number: number;
  session_id: string;
  correct?: boolean;
  direction?: "high" | "low" | null;
  guesses_used: number;
  max_guesses: number;
  hint_level: number;
  status: "playing" | "won" | "lost";
  hints: Hints;
  new_hints: Hints;
  new_photo_urls: string[];
  revealed_photos: string[];
  guesses: GuessRecord[];
  result: GameResult | null;
};
