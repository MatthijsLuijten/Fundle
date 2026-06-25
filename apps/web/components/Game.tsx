"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchToday, submitGuess } from "@/lib/api";
import { fireWinConfetti } from "@/lib/confetti";
import { MIN_GUESS_AMOUNT, parseAmount } from "@/lib/format";
import { recordGameResult } from "@/lib/stats";
import {
  clearStoredSession,
  getStoredSessionId,
  hasSeenHelp,
  isDebugFresh,
  storeSessionId,
} from "@/lib/storage";
import type { PuzzleState } from "@/lib/types";
import { AppFooter, AppHeader } from "./AppShell";
import { GameSkeleton } from "./GameSkeleton";
import { GuessInput } from "./GuessInput";
import { GuessTracker } from "./GuessTracker";
import { HintPanel } from "./HintPanel";
import { HowToPlayModal } from "./HowToPlayModal";
import { PhotoGallery } from "./PhotoGallery";
import { ResultCard } from "./ResultCard";

export function Game() {
  const [state, setState] = useState<PuzzleState | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [inputShake, setInputShake] = useState(false);
  const prevStatusRef = useRef<PuzzleState["status"] | null>(null);
  const statsRecordedRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    statsRecordedRef.current = false;
    if (isDebugFresh()) clearStoredSession();
    try {
      const data = await fetchToday(getStoredSessionId());
      storeSessionId(data.session_id);
      setState(data);
      setInput("");
    } catch {
      setError("Kan de puzzel niet laden. Draait de API op poort 8000?");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && !hasSeenHelp()) {
      setHelpOpen(true);
    }
  }, [loading]);

  useEffect(() => {
    if (!state) return;

    if (state.status === "won" && prevStatusRef.current === "playing") {
      fireWinConfetti();
    }

    if (state.status !== "playing" && !statsRecordedRef.current) {
      recordGameResult(state.puzzle_date, state.status === "won");
      statsRecordedRef.current = true;
    }

    prevStatusRef.current = state.status;
  }, [state]);

  async function handleGuess() {
    if (!state || state.status !== "playing") return;

    const amount = parseAmount(input);
    if (amount == null || amount < MIN_GUESS_AMOUNT) {
      setError("Voer een geldige prijs in (min. €1.000).");
      setInputShake(true);
      setTimeout(() => setInputShake(false), 400);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const data = await submitGuess(amount, state.session_id);
      storeSessionId(data.session_id);
      setState(data);
      setInput("");

      if (data.status === "playing" && !data.correct) {
        setInputShake(true);
        setTimeout(() => setInputShake(false), 400);
      }
    } catch {
      setError("Gok mislukt. Probeer opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <>
        <HowToPlayModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        <div className="flex min-h-screen flex-col">
          <AppHeader onHelpClick={() => setHelpOpen(true)} />
          <div className="mx-auto w-full max-w-md flex-1 px-4 py-6">
            <GameSkeleton />
          </div>
          <AppFooter />
        </div>
      </>
    );
  }

  if (error && !state) {
    return (
      <>
        <HowToPlayModal open={helpOpen} onClose={() => setHelpOpen(false)} />
        <div className="flex min-h-screen flex-col">
          <AppHeader onHelpClick={() => setHelpOpen(true)} />
        <div className="flex flex-1 items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p>{error}</p>
            <button
              type="button"
              onClick={load}
              className="btn-primary mt-4 px-5 py-2.5 text-sm"
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
        <AppFooter />
        </div>
      </>
    );
  }

  if (!state) return null;

  const finished = state.status !== "playing";
  const photosLocked =
    state.guesses_used === 0 && state.revealed_photos.length === 0;

  const subtitle =
    finished && state.status === "won"
      ? "Gewonnen!"
      : finished
        ? "Verloren"
        : undefined;

  const playing = state.status === "playing";

  return (
    <>
      <HowToPlayModal open={helpOpen} onClose={() => setHelpOpen(false)} />

      <div className="flex min-h-screen flex-col">
        <AppHeader
          puzzleNumber={state.puzzle_number}
          subtitle={subtitle}
          onHelpClick={() => setHelpOpen(true)}
        />

        <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5">
          {isDebugFresh() && (
            <p className="text-center text-xs text-amber-400/90">
              Debug: nieuwe sessie bij elke refresh
            </p>
          )}

          {/* 1. Woning — het puzzel */}
          <PhotoGallery
            urls={state.revealed_photos ?? []}
            newPhotoUrls={state.new_photo_urls ?? []}
            locked={photosLocked}
          />

          {/* 2. Clues — wat je weet */}
          <section className="surface p-4">
            <h2 className="section-label mb-3">Hints</h2>
            <HintPanel hints={state.hints} newHints={state.new_hints ?? {}} />
          </section>

          {/* 3. Feedback — eerdere gokken */}
          <GuessTracker
            guesses={state.guesses}
            maxGuesses={state.max_guesses}
          />

          {/* 4. Actie — volgende gok */}
          {playing && (
            <div className="sticky bottom-0 -mx-4 border-t border-fundle-border bg-fundle-bg-elevated/95 px-4 py-4 backdrop-blur-xl shadow-[0_-4px_20px_rgba(15,23,42,0.06)]">
              <GuessInput
                value={input}
                onChange={setInput}
                onSubmit={handleGuess}
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

          {state.result && <ResultCard result={state.result} state={state} />}

          {!playing && error && (
            <p className="text-center text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </main>

        <AppFooter />
      </div>
    </>
  );
}
