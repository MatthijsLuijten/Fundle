const SESSION_KEY = "fundle_session_id";
const HELP_SEEN_KEY = "fundle_help_seen";
const CITY_SEEN_KEY = "fundle_city_seen";

export function isDebugFresh(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_FRESH === "1";
}

/** False during `npm run dev` and DEBUG_FRESH sessions — never pollute prod stats. */
export function shouldReportCommunityStats(): boolean {
  return process.env.NODE_ENV !== "development" && !isDebugFresh();
}

// Stable per-browser id. No longer a server session — just a local identifier
// kept for the PuzzleState shape and potential future use.
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function hasSeenHelp(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(HELP_SEEN_KEY) === "1";
}

export function markHelpSeen(): void {
  localStorage.setItem(HELP_SEEN_KEY, "1");
}

// Drives the "nieuw" badge on the Steden tab — shown until the player first
// opens city mode, then hidden for good.
export function hasSeenCityMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CITY_SEEN_KEY) === "1";
}

export function markCityModeSeen(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(CITY_SEEN_KEY, "1");
}
