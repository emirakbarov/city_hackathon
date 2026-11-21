import type { CommitmentKind } from "./commitments";

export type GoogleEvent = {
  id?: string;
  status?: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
};

export type CalendarRow = {
  external_id: string;
  title: string;
  kind: CommitmentKind;
  due_date: string;
  end_date: string;
  all_day: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

/** Subtract one calendar day from YYYY-MM-DD without timezone shifts. */
export function previousDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  const t = new Date(Date.UTC(y, m - 1, d - 1));
  return t.toISOString().slice(0, 10);
}

export function guessKind(title: string): CommitmentKind {
  const t = title.toLowerCase();
  if (/\b(exam|test|midterm|final|quiz|prüfung)\b/.test(t)) return "exam";
  if (/\b(deadline|due|submit|submission|hand[- ]?in)\b/.test(t)) return "deadline";
  return "other";
}

/** Google event → commitment row. All-day end is exclusive; timed keeps raw offsets. */
export function mapEvent(e: GoogleEvent): CalendarRow | null {
  if (!e.id || e.status === "cancelled") return null;
  const title = (e.summary?.trim() || "Calendar event").slice(0, 120);
  const kind = guessKind(title);
  if (e.start?.date) {
    const start = e.start.date;
    const endExcl = e.end?.date ?? start;
    const last = endExcl > start ? previousDay(endExcl) : start;
    return { external_id: e.id, title, kind, due_date: start, end_date: last, all_day: true, starts_at: null, ends_at: null };
  }
  if (e.start?.dateTime) {
    const s = e.start.dateTime;
    const en = e.end?.dateTime ?? s;
    return { external_id: e.id, title, kind, due_date: s.slice(0, 10), end_date: en.slice(0, 10), all_day: false, starts_at: s, ends_at: en };
  }
  return null;
}
