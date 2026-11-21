import { supabase } from "@/integrations/supabase/client";
import type { PlaceType, ScrollContext, TraceSample } from "@/lib/scrollModel";

/**
 * Context the scroll-time model needs that the app doesn't collect yet.
 * Kept in localStorage until there's a settings screen + DB columns.
 * TODO: replace with the upcoming-commitments feature (docs/upcoming-commitments-spec.md):
 *   exams + Google Calendar events should drive examPeriod / daysUntilExam / minutesToNextCommitment.
 * TODO: let the user set dailyTargetMinutes on the profile/setup screen.
 */
export type ScrollSettings = {
  dailyTargetMinutes: number;
  /** ISO date of the next exam, or null. */
  examDate: string | null;
  /** ISO datetime of the next commitment (lecture, shift…), or null. */
  nextCommitmentAt: string | null;
};

const SETTINGS_KEY = "pause_scroll_settings";
export const DEFAULT_SETTINGS: ScrollSettings = { dailyTargetMinutes: 60, examDate: null, nextCommitmentAt: null };

export function loadScrollSettings(): ScrollSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<ScrollSettings>) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveScrollSettings(s: ScrollSettings) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* private mode: ignore */ }
}

/**
 * Sessions don't store how long you scrolled, so estimate from today's "continued" opens.
 * TODO: store chosen/actual minutes per session (needs a DB column, ask Lovable) and sum them instead.
 */
export const EST_MIN_PER_CONTINUED_OPEN = 10;

export async function minutesScrolledToday(userId: string): Promise<number> {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const { count } = await supabase.from("sessions").select("id", { count: "exact", head: true })
    .eq("user_id", userId).eq("outcome", "continued").gte("created_at", start.toISOString());
  return (count ?? 0) * EST_MIN_PER_CONTINUED_OPEN;
}

export function buildScrollContext(
  s: ScrollSettings, scrolledToday: number, mood: number, now = new Date(), placeType: PlaceType = "unknown",
): ScrollContext {
  const days = s.examDate ? Math.ceil((new Date(s.examDate).getTime() - now.getTime()) / 86_400_000) : -1;
  const examPeriod = days >= 0 && days <= 14;
  const toCommit = s.nextCommitmentAt ? Math.round((new Date(s.nextCommitmentAt).getTime() - now.getTime()) / 60_000) : -1;
  return {
    minutesScrolledToday: scrolledToday,
    dailyTargetMinutes: s.dailyTargetMinutes,
    examPeriod,
    daysUntilExam: examPeriod ? days : -1,
    minutesToNextCommitment: toCommit >= 0 ? toCommit : -1,
    inSetRest: false, // TODO: ask "between sets?" when the trace looks like the gym
    mood,
    hour: now.getHours(),
    expectedTripMinutes: -1, // TODO: from a journey planner (TfL/bus API) once we know the destination
    placeType,
  };
}

/* ---------- Demo scenarios (dev/demo only, ?demo=bus) ---------- */

const DT = 5; // seconds between samples, same as training data
/** Small deterministic GPS wobble so traces don't look synthetic-flat. */
const wobble = (i: number, scale: number) => (((i * 37 + 11) % 13) / 13) * scale;

function toTrace(speeds: number[], extra?: (i: number) => Partial<TraceSample>): TraceSample[] {
  return speeds.map((speed, i) => ({ t: i * DT, speed: Math.round(speed * 100) / 100, ...extra?.(i) }));
}

/** Stop-and-go: 6 moving, 4 stopped at a bus stop, 7 moving, 4 at a bus stop, 6 moving, 3 at lights. */
function busTrace(): TraceSample[] {
  const speeds: number[] = [];
  const busStop: boolean[] = [];
  const move = (n: number) => { for (let k = 0; k < n; k++) { speeds.push(Math.min(8.5, 2 + k * 2) + wobble(speeds.length, 0.6)); busStop.push(false); } };
  const stop = (n: number, atStop: boolean) => { for (let k = 0; k < n; k++) { speeds.push(wobble(speeds.length, 0.3)); busStop.push(atStop); } };
  move(6); stop(4, true); move(7); stop(4, true); move(6); stop(3, false);
  return toTrace(speeds, (i) => ({ atBusStop: busStop[i] ?? false }));
}

function stillTrace(extra?: (i: number) => Partial<TraceSample>): TraceSample[] {
  return toTrace(Array.from({ length: 30 }, (_, i) => wobble(i, 0.35)), extra);
}

function gymTrace(): TraceSample[] {
  // mostly still, two short walks between machines
  const speeds = Array.from({ length: 30 }, (_, i) => (i === 9 || i === 10 || i === 21 ? 0.9 + wobble(i, 0.3) : wobble(i, 0.3)));
  return toTrace(speeds, () => ({ nearGym: true }));
}

function walkTrace(): TraceSample[] {
  // ~1.4 m/s with one 10 s wait at a crossing
  const speeds = Array.from({ length: 30 }, (_, i) => (i === 14 || i === 15 ? wobble(i, 0.2) : 1.2 + wobble(i, 0.5)));
  return toTrace(speeds);
}

export type DemoScenario = {
  id: string;
  label: string;
  emoji: string;
  trace: TraceSample[];
  /** Overrides on top of the real context (mood still comes from the check-in). */
  ctx: Partial<ScrollContext>;
  /** Place name shown on the card for demo scenarios. */
  placeName?: string;
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  { id: "bus", label: "On the bus", emoji: "🚌", trace: busTrace(),
    ctx: { minutesScrolledToday: 20, dailyTargetMinutes: 60, expectedTripMinutes: 18, examPeriod: false, daysUntilExam: -1, minutesToNextCommitment: -1 } },
  { id: "gym", label: "Gym, between sets", emoji: "🏋️", trace: gymTrace(),
    ctx: { minutesScrolledToday: 15, dailyTargetMinutes: 60, inSetRest: true, examPeriod: false, daysUntilExam: -1, minutesToNextCommitment: -1 } },
  { id: "walk", label: "Walking", emoji: "🚶", trace: walkTrace(),
    ctx: { minutesScrolledToday: 10, dailyTargetMinutes: 60, examPeriod: false, daysUntilExam: -1, minutesToNextCommitment: -1 } },
  { id: "library", label: "Library, exam week", emoji: "📚", trace: stillTrace(),
    ctx: { minutesScrolledToday: 25, dailyTargetMinutes: 60, examPeriod: true, daysUntilExam: 2, minutesToNextCommitment: 90 } },
  { id: "bayes", label: "Bayes, 5 pm", emoji: "🏫", trace: stillTrace(), placeName: "Bayes Business School",
    ctx: { minutesScrolledToday: 20, dailyTargetMinutes: 60, hour: 17, placeType: "study", examPeriod: false, daysUntilExam: -1, minutesToNextCommitment: -1 } },
  { id: "lunch", label: "Bayes, lunch", emoji: "🥪", trace: stillTrace(), placeName: "Bayes Business School",
    ctx: { minutesScrolledToday: 20, dailyTargetMinutes: 60, hour: 12, placeType: "study", examPeriod: false, daysUntilExam: -1, minutesToNextCommitment: -1 } },
  { id: "halls", label: "Halls, evening", emoji: "🏠", trace: stillTrace(), placeName: "Student halls",
    ctx: { minutesScrolledToday: 20, dailyTargetMinutes: 60, hour: 21, placeType: "home", examPeriod: false, daysUntilExam: -1, minutesToNextCommitment: -1 } },
  { id: "over", label: "Way over target", emoji: "📵", trace: stillTrace(),
    ctx: { minutesScrolledToday: 150, dailyTargetMinutes: 60, examPeriod: false, daysUntilExam: -1, minutesToNextCommitment: -1 } },
];

export function demoScenario(id: string | undefined) {
  return id ? DEMO_SCENARIOS.find((d) => d.id === id) : undefined;
}
