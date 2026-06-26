/** Must match API `PUZZLE_TIMEZONE` in apps/api/app/puzzle_date.py */
const PUZZLE_TIMEZONE = "Europe/Amsterdam";

function amsterdamClock(d: Date): { hour: number; minute: number; second: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PUZZLE_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(d);

  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0", 10);

  return { hour: get("hour"), minute: get("minute"), second: get("second") };
}

export function getTimeUntilNextPuzzle(): {
  hours: number;
  minutes: number;
  seconds: number;
  label: string;
} {
  const now = new Date();
  const { hour, minute, second } = amsterdamClock(now);
  const secondsToday = hour * 3600 + minute * 60 + second;
  const totalSeconds = Math.max(0, 86400 - secondsToday);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}u`);
  parts.push(`${minutes.toString().padStart(2, "0")}m`);
  parts.push(`${seconds.toString().padStart(2, "0")}s`);

  return { hours, minutes, seconds, label: parts.join(" ") };
}
