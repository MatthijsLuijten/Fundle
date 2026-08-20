"use client";

import { ArrowLeft, Clock } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchTodayCityPuzzle, revealCity, submitCityBid } from "@/lib/cityApi";
import type { CityPuzzleView, CityReveal } from "@/lib/cityData";
import { fireWinConfetti } from "@/lib/confetti";
import { MIN_GUESS_AMOUNT, parseAmount } from "@/lib/format";
import { markCityModeSeen } from "@/lib/storage";
import { AppFooter, AppHeader } from "./AppShell";
import { CityCard } from "./CityCard";
import { CityResultCard } from "./CityResultCard";
import { GameSkeleton } from "./GameSkeleton";
import { GuessInput } from "./GuessInput";
import { HintPanel } from "./HintPanel";
import { HowToPlayModal } from "./HowToPlayModal";
import { PhotoGallery } from "./PhotoGallery";

function closeLabel(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function CityGame() {
  // City mode is one city per day, so there is nothing to pick: load today's
  // puzzle up front and let the start screen decide when to show it.
  const [opened, setOpened] = useState(false);
  const [view, setView] = useState<CityPuzzleView | null>(null);
  const [reveal, setReveal] = useState<CityReveal | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [input, setInput] = useState("");
  const [inputShake, setInputShake] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const confettiRef = useRef(false);

  // Opening city mode (even via a direct link) clears the "nieuw" tab badge.
  useEffect(() => {
    markCityModeSeen();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNotFound(false);
    confettiRef.current = false;
    try {
      const v = await fetchTodayCityPuzzle();
      if (!v) {
        setView(null);
        setReveal(null);
        setNotFound(true);
        return;
      }
      setView(v);
      setReveal(await revealCity(v.city));
    } catch {
      setError("Kon de stad van vandaag niet laden. Probeer het later opnieuw.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (reveal && !reveal.open && reveal.won && !confettiRef.current) {
      fireWinConfetti();
      confettiRef.current = true;
    }
  }, [reveal]);

  function shakeInput() {
    setInputShake(true);
    setTimeout(() => setInputShake(false), 400);
  }

  async function handleBid() {
    if (!view) return;
    const amount = parseAmount(input);
    if (amount == null || amount < MIN_GUESS_AMOUNT) {
      setError("Voer een geldig bod in (min. €1.000).");
      shakeInput();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitCityBid(view.city, amount);
      setReveal(await revealCity(view.city));
      setInput("");
    } catch {
      setError("Bod plaatsen mislukt. Misschien is het bieden gesloten.");
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setOpened(false);
    setError(null);
    setInput("");
  }

  const revealed = reveal != null && !reveal.open;
  const hasBid = reveal != null && reveal.your_bid != null;
  const bidding = reveal != null && reveal.open && !hasBid;
  const waiting = reveal != null && reveal.open && hasBid;

  const subtitle =
    opened && view
      ? `${view.cityDisplay}${revealed ? " · Uitslag" : bidding ? " · Bieden" : " · Bod geplaatst"}`
      : "Steden";

  return (
    <>
      <HowToPlayModal mode="city" open={helpOpen} onClose={() => setHelpOpen(false)} />
      <div className="flex min-h-screen flex-col">
        <AppHeader
          puzzleNumber={view?.puzzle_number}
          subtitle={subtitle}
          onHelpClick={() => setHelpOpen(true)}
        />

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
          {!opened && loading && <GameSkeleton />}

          {!opened && !loading && view && (
            <CityCard
              city={view.city}
              display={view.cityDisplay}
              onOpen={() => setOpened(true)}
            />
          )}

          {opened && (
            <button
              type="button"
              onClick={close}
              className="btn-ghost inline-flex w-fit items-center gap-1.5 px-3 py-2 text-sm text-fundle-muted hover:text-fundle-text"
            >
              <ArrowLeft className="h-4 w-4" /> Terug
            </button>
          )}

          {!loading && notFound && (
            <div className="surface p-6 text-center text-sm text-fundle-muted">
              Er is vandaag nog geen woning. Kom later terug.
            </div>
          )}

          {!loading && error && !view && (
            <div className="surface p-6 text-center">
              <p className="text-sm text-red-600">{error}</p>
              <button
                type="button"
                onClick={() => load()}
                className="btn-primary mt-4 px-5 py-2.5 text-sm"
              >
                Opnieuw proberen
              </button>
            </div>
          )}

          {opened && !loading && view && (
            <>
              <PhotoGallery urls={view.photos} />

              <section className="surface p-4">
                <h2 className="section-label mb-3">Woninggegevens</h2>
                <HintPanel hints={view.hints} />
              </section>

              {bidding && (
                <div className="surface p-4">
                  <p className="mb-3 text-sm text-fundle-muted">
                    Eén verzegeld bod. Je ziet pas na{" "}
                    <span className="font-semibold text-fundle-text">
                      {closeLabel(view.closes_at)}
                    </span>{" "}
                    of jij het dichtst bij de vraagprijs zat.
                  </p>
                  <GuessInput
                    value={input}
                    onChange={setInput}
                    onSubmit={handleBid}
                    submitting={submitting}
                    shake={inputShake}
                  />
                  {error && (
                    <p className="mt-2 text-center text-sm text-red-600" role="alert">
                      {error}
                    </p>
                  )}
                </div>
              )}

              {waiting && (
                <div className="surface p-5 text-center">
                  <Clock className="mx-auto mb-2 h-6 w-6 text-fundle-accent" aria-hidden />
                  <p className="text-sm text-fundle-muted">Jouw bod</p>
                  <p className="text-2xl font-extrabold tabular-nums">
                    {new Intl.NumberFormat("nl-NL", {
                      style: "currency",
                      currency: "EUR",
                      maximumFractionDigits: 0,
                    }).format(reveal.your_bid ?? 0)}
                  </p>
                  <p className="mt-2 text-sm text-fundle-muted">
                    Kom na {closeLabel(view.closes_at)} terug voor de uitslag.
                  </p>
                </div>
              )}

              {revealed && (
                <CityResultCard reveal={reveal} view={view} fundaUrl={view.url} />
              )}
            </>
          )}
        </main>

        <AppFooter />
      </div>
    </>
  );
}
