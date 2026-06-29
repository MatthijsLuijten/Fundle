import type { GameResult, PuzzleState } from "@/lib/types";
import { CommunityStats } from "./CommunityStats";
import { DifficultyBadge } from "./DifficultyBadge";
import { CopyResultButton } from "./CopyResultButton";
import { ShareButton } from "./ShareButton";
import { ExternalLink } from "lucide-react";

type Props = {
  result: GameResult;
  state: PuzzleState;
};

export function ResultCard({ result, state }: Props) {
  return (
    <div
      className={`animate-fade-in-up surface p-6 text-center ${
        result.won ? "border-emerald-300 bg-emerald-50/80" : ""
      }`}
    >
      <p className="section-label mb-2">
        {result.won ? "Goed geraden!" : "Helaas! De vraagprijs was"}
      </p>
      <p className="text-4xl font-bold tabular-nums tracking-tight">
        {result.formatted_price}
      </p>
      {result.city && (
        <p className="mt-2 text-sm text-fundle-muted">{result.city}</p>
      )}
      {result.listed_ago && (
        <p className="mt-1 text-sm text-fundle-muted">{result.listed_ago}</p>
      )}

      <DifficultyBadge puzzleDate={state.puzzle_date} />

      <div className="mt-5 flex flex-col items-stretch gap-2.5 sm:flex-row sm:flex-wrap sm:justify-center">
        <ShareButton state={state} className="w-full sm:w-auto" />
        <CopyResultButton state={state} className="w-full sm:w-auto" />
        {result.url && (
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Bekijk op Funda
          </a>
        )}
      </div>

      <CommunityStats puzzleDate={state.puzzle_date} />
    </div>
  );
}
