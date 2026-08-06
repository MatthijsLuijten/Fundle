"use client";

import { ExternalLink, Trophy } from "lucide-react";
import type { CityPuzzleView, CityReveal } from "@/lib/cityData";
import type { CityShareData } from "@/lib/share";
import { CityShareActions } from "./CityShareActions";

function eur(n: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function CityResultCard({
  reveal,
  view,
  fundaUrl,
}: {
  reveal: CityReveal;
  view: CityPuzzleView;
  fundaUrl: string | null;
}) {
  const won = reveal.won ?? false;
  const didBid = reveal.your_bid != null;

  const shareData: CityShareData = {
    cityDisplay: view.cityDisplay,
    won,
    your_rank: reveal.your_rank ?? null,
    total_bids: reveal.total_bids ?? 0,
    your_distance: reveal.your_distance ?? null,
  };

  return (
    <section
      className={`surface overflow-hidden p-5 text-center ${
        won ? "ring-2 ring-fundle-accent/50" : ""
      }`}
    >
      {didBid ? (
        <div className="mb-2 flex items-center justify-center gap-2">
          <Trophy
            className={`h-5 w-5 ${won ? "text-fundle-accent" : "text-fundle-muted"}`}
            aria-hidden
          />
          <h2 className="text-lg font-bold">
            {won ? "Je hebt het huis!" : "Net niet"}
          </h2>
        </div>
      ) : (
        <h2 className="mb-2 text-lg font-bold">Uitslag {view.cityDisplay}</h2>
      )}

      <p className="text-sm text-fundle-muted">Vraagprijs</p>
      <p className="text-3xl font-extrabold tabular-nums text-fundle-text">
        {eur(reveal.answer_eur ?? 0)}
      </p>

      {didBid && (
        <dl className="mt-4 grid grid-cols-2 gap-2 text-left">
          <div className="surface-inset rounded-xl px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-fundle-muted">Jouw bod</dt>
            <dd className="text-[15px] font-semibold tabular-nums">{eur(reveal.your_bid ?? 0)}</dd>
          </div>
          <div className="surface-inset rounded-xl px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-fundle-muted">Verschil</dt>
            <dd className="text-[15px] font-semibold tabular-nums">
              {eur(reveal.your_distance ?? 0)}
            </dd>
          </div>
          <div className="surface-inset rounded-xl px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-fundle-muted">Jouw plek</dt>
            <dd className="text-[15px] font-semibold tabular-nums">
              {reveal.your_rank} van {reveal.total_bids}
            </dd>
          </div>
          <div className="surface-inset rounded-xl px-3 py-2.5">
            <dt className="text-[11px] uppercase tracking-wide text-fundle-muted">Beste bod</dt>
            <dd className="text-[15px] font-semibold tabular-nums">
              {eur(reveal.winning_distance ?? 0)} eraf
            </dd>
          </div>
        </dl>
      )}

      {!didBid && (
        <p className="mt-3 text-sm text-fundle-muted">
          Je hebt vandaag niet geboden in {view.cityDisplay}. Er waren{" "}
          {reveal.total_bids} bieders.
        </p>
      )}

      {didBid && <CityShareActions city={shareData} className="mt-5" />}

      {fundaUrl && (
        <a
          href={fundaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-ghost mt-4 inline-flex items-center gap-1.5 text-sm text-fundle-accent"
        >
          Bekijk op Funda <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </section>
  );
}
