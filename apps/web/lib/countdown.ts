export function getTimeUntilNextPuzzle(): {
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);

  const diffMs = midnight.getTime() - now.getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}u`);
  parts.push(`${minutes.toString().padStart(2, "0")}m`);
  parts.push(`${seconds.toString().padStart(2, "0")}s`);

  return { hours, minutes, seconds, label: parts.join(" ") };
}
