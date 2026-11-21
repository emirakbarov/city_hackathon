import type { Exam } from "@/lib/personalModel";

/**
 * Tiny iCalendar (.ics) reader: just enough to pull exams out of a calendar export
 * (e.g. Google Calendar → Settings → Import & export → Export).
 */
export type IcsEvent = { summary: string; start: string };

const EXAM_RE = /exam|test|quiz|midterm|final|assessment/i;

/** RFC 5545 line unfolding: a CRLF followed by a space or tab continues the previous line. */
function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescapeText(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Turn a DTSTART value into an ISO-ish string that `new Date()` parses.
 *  - DATE (20261205)          -> "2026-12-05T09:00:00" local (all-day exam: assume morning)
 *  - DATE-TIME UTC (…T090000Z) -> full ISO in UTC
 *  - DATE-TIME floating / TZID -> local wall-clock time (TZID treated as the phone's own zone)
 */
export function parseIcsDate(value: string): string | null {
  const v = value.trim();
  const d = /^(\d{4})(\d{2})(\d{2})$/.exec(v);
  if (d) return `${d[1]}-${d[2]}-${d[3]}T09:00:00`;
  const t = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?(Z)?$/.exec(v);
  if (!t) return null;
  const [, y, mo, da, h, mi, s = "00", z] = t;
  if (z) return new Date(Date.UTC(+y!, +mo! - 1, +da!, +h!, +mi!, +s)).toISOString();
  return `${y}-${mo}-${da}T${h}:${mi}:${s}`;
}

export function parseIcs(text: string): IcsEvent[] {
  const out: IcsEvent[] = [];
  let cur: { summary?: string; start?: string } | null = null;
  for (const line of unfold(text)) {
    if (/^BEGIN:VEVENT$/i.test(line.trim())) { cur = {}; continue; }
    if (/^END:VEVENT$/i.test(line.trim())) {
      if (cur?.summary && cur.start) out.push({ summary: cur.summary, start: cur.start });
      cur = null;
      continue;
    }
    if (!cur) continue;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const name = line.slice(0, colon).split(";")[0]!.toUpperCase();
    const value = line.slice(colon + 1);
    if (name === "SUMMARY") cur.summary = unescapeText(value);
    else if (name === "DTSTART") { const d = parseIcsDate(value); if (d) cur.start = d; }
  }
  return out;
}

export const isExamTitle = (s: string) => EXAM_RE.test(s);

function localDay(date: string): string {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
export const examKey = (e: { title: string; date: string }) => `${e.title.trim().toLowerCase()}|${localDay(e.date)}`;

/**
 * Exams found in an .ics file that aren't already in `existing` (same title on the same day).
 * Imported exams get importance 2 ("Normal") and the default revision hours for that.
 */
export function examsFromIcs(text: string, existing: Exam[], makeId: () => string = () => crypto.randomUUID()): Exam[] {
  const seen = new Set(existing.map(examKey));
  const added: Exam[] = [];
  for (const ev of parseIcs(text)) {
    if (!isExamTitle(ev.summary)) continue;
    const exam: Exam = { id: makeId(), title: ev.summary, date: ev.start, importance: 2 };
    const k = examKey(exam);
    if (seen.has(k)) continue;
    seen.add(k);
    added.push(exam);
  }
  return added;
}
