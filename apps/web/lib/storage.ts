const SESSION_KEY = "fundle_session_id";
const HELP_SEEN_KEY = "fundle_help_seen";

export function isDebugFresh(): boolean {
  return process.env.NEXT_PUBLIC_DEBUG_FRESH === "1";
}

export function getStoredSessionId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  if (isDebugFresh()) return undefined;
  return localStorage.getItem(SESSION_KEY) ?? undefined;
}

export function clearStoredSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function storeSessionId(id: string): void {
  localStorage.setItem(SESSION_KEY, id);
}

export function hasSeenHelp(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(HELP_SEEN_KEY) === "1";
}

export function markHelpSeen(): void {
  localStorage.setItem(HELP_SEEN_KEY, "1");
}
