import {
  emptyState, observe, type ActivityEvent, type Aim, type Exam, type PersonalState, type PlaceKind,
} from "@/lib/personalModel";
import { loadScrollSettings, saveScrollSettings } from "@/lib/scrollContext";

/**
 * On-device storage for the personal model: learned state, exams and the open-in-progress.
 * Everything stays in this browser's localStorage. Every read/write is wrapped so private
 * mode or cleared storage just means "nothing learned yet".
 */
const STATE_KEY = "pause_personal_state";
const EXAMS_KEY = "pause_exams";
const PENDING_KEY = "pause_pending_scroll";

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

export function loadPersonalState(): PersonalState {
  const s = read<PersonalState | null>(STATE_KEY, null);
  return s && s.version === 1 ? s : emptyState();
}
export function savePersonalState(s: PersonalState) { write(STATE_KEY, s); }
export function resetPersonalState() { write(STATE_KEY, emptyState()); }

/** The aim the user set at the start. Stored with the other scroll settings. */
export function loadAim(): Aim {
  const s = loadScrollSettings();
  return { dailyTargetMinutes: s.dailyTargetMinutes, goal: s.goal };
}
export function saveAim(aim: Aim) {
  saveScrollSettings({ ...loadScrollSettings(), dailyTargetMinutes: aim.dailyTargetMinutes, goal: aim.goal });
}

export function loadExams(): Exam[] {
  return read<Exam[]>(EXAMS_KEY, []).filter((e) => !Number.isNaN(new Date(e.date).getTime()));
}
export function saveExams(exams: Exam[]) {
  write(EXAMS_KEY, [...exams].sort((a, b) => a.date.localeCompare(b.date)));
  // keep the scroll-time model's "next exam" in step with the calendar
  const next = loadExams().find((e) => new Date(e.date).getTime() > Date.now());
  saveScrollSettings({ ...loadScrollSettings(), examDate: next ? next.date : null });
}

/** Learn from one event and persist. */
export function logEvent(ev: ActivityEvent) {
  savePersonalState(observe(loadPersonalState(), ev, loadExams()));
}

/** An Instagram session the user chose to start: closed by /back (Shortcut "When Instagram is closed"). */
export type PendingScroll = {
  startedAt: number;
  recommendedMinutes: number;
  chosenMinutes: number;
  lat?: number | undefined;
  lon?: number | undefined;
  placeKind?: PlaceKind | undefined;
  mood?: number | undefined;
};
export function startPendingScroll(p: PendingScroll) { write(PENDING_KEY, p); }
export function loadPendingScroll(): PendingScroll | null { return read<PendingScroll | null>(PENDING_KEY, null); }

/** Close the pending session: learns whether they kept to the time. Returns what happened. */
export function finishPendingScroll(now = Date.now()): { chosen: number; actual: number } | null {
  const p = loadPendingScroll();
  if (!p) return null;
  write(PENDING_KEY, null);
  const actual = Math.max(0, Math.round((now - p.startedAt) / 60_000));
  if (actual > 6 * 60) return null; // stale (forgot to close): don't learn from it
  logEvent({
    at: now, kind: "close", lat: p.lat, lon: p.lon, placeKind: p.placeKind,
    recommendedMinutes: p.recommendedMinutes, chosenMinutes: p.chosenMinutes, actualMinutes: actual, mood: p.mood,
  });
  return { chosen: p.chosenMinutes, actual };
}
