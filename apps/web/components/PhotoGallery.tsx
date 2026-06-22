"use client";

import { useEffect, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, X, ZoomIn } from "lucide-react";

export function PhotoGallery({
  urls,
  newPhotoUrls,
  locked = false,
}: {
  urls: string[];
  newPhotoUrls?: string[];
  locked?: boolean;
}) {
  const [index, setIndex] = useState(0);
  const [fadeKey, setFadeKey] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const newSet = new Set(newPhotoUrls ?? []);

  useEffect(() => {
    if (urls.length === 0) {
      setIndex(0);
      return;
    }
    if (newPhotoUrls?.length) {
      const newIndex = urls.findIndex((url) => newPhotoUrls.includes(url));
      if (newIndex >= 0) {
        setIndex(newIndex);
        setFadeKey((k) => k + 1);
        return;
      }
    }
    setIndex((current) => Math.min(current, urls.length - 1));
  }, [urls, newPhotoUrls]);

  useEffect(() => {
    if (!lightboxOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxOpen(false);
      if (e.key === "ArrowLeft") {
        setIndex((i) => Math.max(0, i - 1));
        setFadeKey((k) => k + 1);
      }
      if (e.key === "ArrowRight") {
        setIndex((i) => Math.min(urls.length - 1, i + 1));
        setFadeKey((k) => k + 1);
      }
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxOpen, urls.length]);

  if (locked || urls.length === 0) {
    return (
      <div className="surface overflow-hidden border-dashed">
        <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-fundle-bg-elevated">
            <Camera className="h-5 w-5 text-fundle-muted" aria-hidden />
          </div>
          <p className="text-sm text-fundle-muted">
            {locked
              ? "Doe je eerste gok om de woningfoto te ontgrendelen"
              : "Nog geen foto beschikbaar"}
          </p>
        </div>
      </div>
    );
  }

  const currentUrl = urls[index];
  const isNewSlide = newSet.has(currentUrl);
  const hasMultiple = urls.length > 1;

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
    setFadeKey((k) => k + 1);
  }

  function goNext() {
    setIndex((i) => Math.min(urls.length - 1, i + 1));
    setFadeKey((k) => k + 1);
  }

  function selectThumb(thumbIndex: number) {
    setIndex(thumbIndex);
    setFadeKey((k) => k + 1);
  }

  const navBtnClass =
    "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70 disabled:pointer-events-none disabled:opacity-30";

  return (
    <>
    <div className="space-y-2.5">
      <div
        className={`relative overflow-hidden rounded-2xl shadow-card ${
          isNewSlide
            ? "ring-2 ring-fundle-accent/40 ring-offset-2 ring-offset-fundle-bg"
            : ""
        }`}
      >
        {isNewSlide && (
          <span className="absolute left-3 top-3 z-10 animate-fade-in rounded-lg bg-fundle-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-fundle-accent-fg">
            {newSet.size > 1 ? "Nieuwe foto's" : "Nieuwe foto"}
          </span>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="relative block w-full cursor-zoom-in"
          aria-label={`Vergroot foto ${index + 1} van ${urls.length}`}
        >
          <img
            key={fadeKey}
            src={currentUrl}
            alt={`Woning foto ${index + 1} van ${urls.length}`}
            className="aspect-[4/3] w-full object-cover animate-fade-in"
          />
          <span
            className="pointer-events-none absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/50 text-white backdrop-blur-md"
            aria-hidden
          >
            <ZoomIn className="h-4 w-4" />
          </span>
        </button>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              aria-label="Vorige foto"
              className={`left-3 ${navBtnClass}`}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index === urls.length - 1}
              aria-label="Volgende foto"
              className={`right-3 ${navBtnClass}`}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-black/50 px-2.5 py-1 text-xs font-medium tabular-nums text-white backdrop-blur-md">
              {index + 1} / {urls.length}
            </span>
          </>
        )}
      </div>

      {hasMultiple && (
        <div
          className="flex gap-2 overflow-x-auto px-0.5 py-1"
          role="tablist"
          aria-label="Foto thumbnails"
        >
          {urls.map((url, thumbIndex) => {
            const isActive = thumbIndex === index;
            const isNewThumb = newSet.has(url);
            return (
              <button
                key={`${url}-${thumbIndex}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-label={`Foto ${thumbIndex + 1}${isNewThumb ? ", nieuw" : ""}`}
                onClick={() => selectThumb(thumbIndex)}
                className={`relative shrink-0 rounded-xl transition ${
                  isActive
                    ? "ring-2 ring-fundle-accent ring-offset-1 ring-offset-fundle-bg"
                    : "opacity-60 hover:opacity-100"
                }`}
              >
                <span className="relative block overflow-hidden rounded-[10px]">
                  {isNewThumb && (
                    <span className="absolute left-1 top-1 z-10 rounded bg-fundle-accent px-1 py-px text-[7px] font-bold uppercase text-fundle-accent-fg">
                      Nieuw
                    </span>
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-14 w-[4.5rem] object-cover" />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>

    {lightboxOpen && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-label={`Foto ${index + 1} van ${urls.length}`}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/90 backdrop-blur-sm"
          aria-label="Sluiten"
          onClick={() => setLightboxOpen(false)}
        />

        <button
          type="button"
          onClick={() => setLightboxOpen(false)}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-black/50 text-white backdrop-blur-md transition hover:bg-black/70"
          aria-label="Sluiten"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="pointer-events-none relative z-10 flex h-full w-full items-center justify-center p-4 pt-14 pb-16">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={`lightbox-${fadeKey}`}
            src={currentUrl}
            alt={`Woning foto ${index + 1} van ${urls.length}`}
            className="pointer-events-auto max-h-full max-w-full object-contain animate-fade-in"
          />
        </div>

        {hasMultiple && (
          <>
            <button
              type="button"
              onClick={goPrev}
              disabled={index === 0}
              aria-label="Vorige foto"
              className={`left-4 z-20 ${navBtnClass}`}
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={goNext}
              disabled={index === urls.length - 1}
              aria-label="Volgende foto"
              className={`right-4 z-20 ${navBtnClass}`}
            >
              <ChevronRight className="h-6 w-6" />
            </button>
            <span className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 rounded-lg bg-black/50 px-3 py-1.5 text-sm font-medium tabular-nums text-white backdrop-blur-md">
              {index + 1} / {urls.length}
            </span>
          </>
        )}
      </div>
    )}
    </>
  );
}
