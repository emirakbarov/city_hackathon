/** Shortcuts is the timer authority; expiry links remain expired on every reopen. */
export const CANCEL_LIMIT_URL = "shortcuts://run-shortcut?name=Pause%20Cancel";

export function timerMinutes(value: unknown): number | undefined {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const minutes = Number(value);
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 45 ? minutes : undefined;
}

export function timerExpired(expires: unknown, now = Date.now()): boolean {
  if (typeof expires !== "string" || !expires) return false;
  const end = Date.parse(expires);
  return Number.isFinite(end) && now >= end;
}