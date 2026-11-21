/**
 * Pause personal model: learns one user's habits on their own phone and turns them into
 * a personal adjustment on top of the scroll-time model.
 *
 * What it learns (online, a little more after every open):
 *  - sleep & wake times: from when the phone is first/last used each day (robust median, last 21 days)
 *  - when they usually scroll: an exponentially-weighted 24-hour profile of opens
 *  - frequent places: on-device clustering of where they open Instagram (e.g. "your gym", "home")
 *  - overrun habits: a small online logistic regression predicting "will they go over the time
 *    they picked?" from hour, place, bedtime closeness, exam pressure and mood
 *
 * What it takes as given:
 *  - the aim the user set at the start (daily target minutes)
 *  - upcoming exams (from the calendar / entered by hand) with how much revision each needs
 *
 * Nothing here leaves the device. State is plain JSON so it can sit in localStorage.
 */

export type PlaceKind = "study" | "home" | "food" | "park" | "gym" | "unknown";

export type Aim = {
  /** Daily scroll budget the user chose when they started. */
  dailyTargetMinutes: number;
  /** Optional free-text goal, e.g. "get a first in my exams". */
  goal?: string | undefined;
};

export type Exam = {
  id: string;
  title: string;
  /** ISO date or datetime of the exam. */
  date: string;
  /** 1 = minor, 2 = normal, 3 = big one. */
  importance: 1 | 2 | 3;
  /** Total revision the user thinks they still need, in hours. Defaults by importance. */
  revisionHoursLeft?: number | undefined;
};

/** One thing that happened in the app. Logged on-device. */
export type ActivityEvent = {
  at: number; // ms epoch
  kind: "open" | "close";
  lat?: number | undefined;
  lon?: number | undefined;
  placeKind?: PlaceKind | undefined;
  /** For "close": what the model recommended, what the user picked, what they actually used. */
  recommendedMinutes?: number | undefined;
  chosenMinutes?: number | undefined;
  actualMinutes?: number | undefined;
  mood?: number | undefined;
};

type Cluster = { lat: number; lon: number; visits: number; nightVisits: number; lastAt: number; kind: PlaceKind; name: string | null };

export type PersonalState = {
  version: 1;
  /** day key (YYYY-MM-DD of the "day" that starts at 04:00) -> [first activity, last activity] in minutes since that day's 04:00 */
  days: Record<string, [number, number]>;
  /** EWMA of opens per hour of day. */
  hourly: number[];
  places: Cluster[];
  /** Logistic regression weights for P(overrun). */
  overrun: { w: number[]; n: number };
  events: number;
};

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

const DAY_START_H = 4; // a "day" runs 04:00 -> 04:00 so a 1 am bedtime belongs to the evening before
const DAYS_KEPT = 21;

function dayKey(at: number): string {
  const d = new Date(at - DAY_START_H * 3_600_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Minutes since this day's 04:00 (0..1439). */
function minutesIntoDay(at: number): number {
  const d = new Date(at);
  return (((d.getHours() - DAY_START_H + 24) % 24) * 60) + d.getMinutes();
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  const upper = s[m];
  if (upper === undefined) return null;
  const lower = s[m - 1];
  return s.length % 2 || lower === undefined ? upper : (lower + upper) / 2;
}

export function clockLabel(minutesIntoDayValue: number): string {
  const total = (Math.round(minutesIntoDayValue) + DAY_START_H * 60) % 1440;
  const h = Math.floor(total / 60), m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* State + online learning                                             */
/* ------------------------------------------------------------------ */

// overrun model features: [bias, sinH, cosH, nearBed, study, home, food, park, gym, pressure, lowMood, chosen/30]
const N_FEAT = 12;
const PRIOR_W = [-1.2, 0, 0, 0.8, -0.3, 0.3, 0, -0.3, -0.5, -0.2, 0.3, 0.2];
const LR = 0.15, L2 = 0.002;
const CLUSTER_M = 80;

export function emptyState(): PersonalState {
  return { version: 1, days: {}, hourly: Array.from({ length: 24 }, () => 0), places: [], overrun: { w: [...PRIOR_W], n: 0 }, events: 0 };
}

function distM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = ((lon2 - lon1) * Math.PI / 180) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const y = (lat2 - lat1) * Math.PI / 180;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function overrunFeatures(hour: number, kind: PlaceKind, nearBed: boolean, pressure: number, mood: number | undefined, chosen: number): number[] {
  const a = (hour / 24) * 2 * Math.PI;
  return [
    1, Math.sin(a), Math.cos(a), nearBed ? 1 : 0,
    kind === "study" ? 1 : 0, kind === "home" ? 1 : 0, kind === "food" ? 1 : 0, kind === "park" ? 1 : 0, kind === "gym" ? 1 : 0,
    Math.min(pressure, 3), mood !== undefined && mood <= 2 ? 1 : 0, Math.min(chosen, 45) / 30,
  ];
}

function predictOverrun(w: number[], x: number[]) {
  let z = 0;
  for (let i = 0; i < N_FEAT; i++) z += (w[i] ?? 0) * (x[i] ?? 0);
  return sigmoid(z);
}

/**
 * Learn from one event. Pure: returns a new state.
 * `exams` and `aim` are only needed so the overrun model sees the pressure the user was under.
 */
export function observe(state: PersonalState, ev: ActivityEvent, exams: Exam[] = []): PersonalState {
  const s: PersonalState = structuredClone(state);
  s.events += 1;

  // 1. day span -> sleep / wake
  const key = dayKey(ev.at);
  const m = minutesIntoDay(ev.at);
  const span = s.days[key];
  s.days[key] = span ? [Math.min(span[0], m), Math.max(span[1], m)] : [m, m];
  const keys = Object.keys(s.days).sort();
  for (const k of keys.slice(0, Math.max(0, keys.length - DAYS_KEPT))) delete s.days[k];

  // 2. hourly profile (EWMA, ~2 week memory)
  if (ev.kind === "open") {
    const h = new Date(ev.at).getHours();
    s.hourly = s.hourly.map((v, i) => v * 0.995 + (i === h ? 1 : 0));
  }

  // 3. frequent places (leader clustering)
  if (ev.kind === "open" && ev.lat !== undefined && ev.lon !== undefined) {
    const hr = new Date(ev.at).getHours();
    const night = hr >= 21 || hr < 6; // evenings and nights: where you sleep
    let best: Cluster | null = null, bestD = Infinity;
    for (const c of s.places) {
      const d = distM(ev.lat, ev.lon, c.lat, c.lon);
      if (d < bestD) { best = c; bestD = d; }
    }
    if (best && bestD <= CLUSTER_M) {
      best.visits += 1;
      best.lat += (ev.lat - best.lat) / best.visits; // running mean
      best.lon += (ev.lon - best.lon) / best.visits;
      best.lastAt = ev.at;
      if (night) best.nightVisits += 1;
      if (ev.placeKind && ev.placeKind !== "unknown") best.kind = ev.placeKind;
    } else {
      s.places.push({ lat: ev.lat, lon: ev.lon, visits: 1, nightVisits: night ? 1 : 0, lastAt: ev.at, kind: ev.placeKind ?? "unknown", name: null });
    }
    s.places.sort((a, b) => b.visits - a.visits);
    s.places = s.places.slice(0, 30);
  }

  // 4. overrun model: did they use more than they picked?
  if (ev.kind === "close" && ev.chosenMinutes !== undefined && ev.actualMinutes !== undefined && ev.chosenMinutes > 0) {
    const hour = new Date(ev.at).getHours();
    const kind = ev.placeKind ?? placeKindAt(state, ev.lat, ev.lon);
    const x = overrunFeatures(hour, kind, isNearBedtime(state, ev.at), revisionPressure(exams, ev.at).dailyHours, ev.mood, ev.chosenMinutes);
    const y = ev.actualMinutes > ev.chosenMinutes * 1.2 ? 1 : 0;
    const p = predictOverrun(s.overrun.w, x);
    s.overrun.w = s.overrun.w.map((w, i) => w - LR * ((p - y) * (x[i] ?? 0) + L2 * (w - (PRIOR_W[i] ?? 0))));
    s.overrun.n += 1;
  }
  return s;
}

/* ------------------------------------------------------------------ */
/* What the model has learned                                          */
/* ------------------------------------------------------------------ */

export type Habits = {
  daysObserved: number;
  /** Clock times "HH:MM", null until enough days. */
  usualWake: string | null;
  usualBedtime: string | null;
  bedtimeMinutes: number | null; // minutes into day (from 04:00)
  /** Top hours they usually open Instagram. */
  peakHours: number[];
  frequentPlaces: { kind: PlaceKind; label: string; visits: number; lat: number; lon: number }[];
  overrunSamples: number;
};

const MIN_DAYS = 3;

const isWeekendKey = (k: string) => { const d = new Date(`${k}T12:00:00`).getDay(); return d === 0 || d === 6; };
/** Friday and Saturday nights count as weekend nights (the day that starts Fri/Sat 04:00). */
const isWeekendNightKey = (k: string) => { const d = new Date(`${k}T12:00:00`).getDay(); return d === 5 || d === 6; };

/**
 * What the model has learned. Sleep and wake times are learned separately for weekdays and
 * weekends (if there are at least 2 of that kind of day), for the kind of day `at` falls on.
 */
export function habits(state: PersonalState, at: number = Date.now()): Habits {
  const entries = Object.entries(state.days);
  const key = dayKey(at);
  const pick = (f: (k: string) => boolean) => {
    const same = entries.filter(([k]) => f(k) === f(key));
    return same.length >= 2 ? same.map(([, v]) => v) : entries.map(([, v]) => v);
  };
  const enough = entries.length >= MIN_DAYS;
  const wake = enough ? median(pick(isWeekendKey).map((s) => s[0])) : null;
  // last use of the day is when they actually put the phone down
  const bed = enough ? median(pick(isWeekendNightKey).map((s) => s[1])) : null;
  const bedM = bed === null ? null : Math.min(1439, bed);
  const spans = entries;
  const peak = state.hourly.map((v, h) => [v, h] as const).filter(([v]) => v > 0)
    .sort((a, b) => b[0] - a[0]).slice(0, 3).map(([, h]) => h);
  const frequent = state.places.filter((c) => c.visits >= 3).slice(0, 5).map((c) => {
    const kind: PlaceKind = c.kind !== "unknown" ? c.kind : c.nightVisits >= Math.max(2, c.visits * 0.4) ? "home" : "unknown";
    const label = kind === "gym" ? "your gym" : kind === "home" ? "home" : kind === "study" ? (c.name ?? "uni") : kind === "food" ? "your usual spot" : kind === "park" ? "the park" : "a place you go a lot";
    return { kind, label, visits: c.visits, lat: c.lat, lon: c.lon };
  });
  return {
    daysObserved: spans.length,
    usualWake: wake === null ? null : clockLabel(wake),
    usualBedtime: bedM === null ? null : clockLabel(bedM),
    bedtimeMinutes: bedM,
    peakHours: peak,
    frequentPlaces: frequent,
    overrunSamples: state.overrun.n,
  };
}

/** Kind of a learned frequent place at (lat, lon), e.g. "home" which public map data can't know. */
export function placeKindAt(state: PersonalState, lat?: number, lon?: number): PlaceKind {
  if (lat === undefined || lon === undefined) return "unknown";
  for (const f of habits(state, 0).frequentPlaces) if (distM(lat, lon, f.lat, f.lon) <= CLUSTER_M) return f.kind;
  return "unknown";
}

export function isNearBedtime(state: PersonalState, at: number, windowMin = 90): boolean {
  const bed = habits(state, at).bedtimeMinutes;
  if (bed === null) return false;
  const m = minutesIntoDay(at);
  return m >= bed - windowMin;
}

/* ------------------------------------------------------------------ */
/* Exams -> revision pressure                                          */
/* ------------------------------------------------------------------ */

const DEFAULT_REVISION_H = { 1: 6, 2: 15, 3: 30 } as const;

/**
 * Revision needed per day, summed over upcoming exams:
 *   sum_i  revisionHoursLeft_i / max(1, daysUntil_i)
 * Each day closer, the same revision is squeezed into fewer days, so pressure rises.
 */
export function revisionPressure(exams: Exam[], at: number): { dailyHours: number; next: { title: string; days: number } | null } {
  let daily = 0;
  let next: { title: string; days: number } | null = null;
  for (const e of exams) {
    const t = new Date(e.date).getTime();
    if (Number.isNaN(t) || t < at - 12 * 3_600_000) continue; // finished
    const days = Math.max(0, Math.ceil((t - at) / 86_400_000));
    if (days > 42) continue; // more than 6 weeks out: not pressing yet
    const hours = e.revisionHoursLeft ?? DEFAULT_REVISION_H[e.importance];
    daily += hours / Math.max(1, days);
    if (!next || days < next.days) next = { title: e.title, days };
  }
  return { dailyHours: daily, next };
}

/**
 * Today's personal scroll budget. Inversely proportional to revision needed:
 *   budget = aim / (1 + ALPHA * revisionHoursPerDay)
 * e.g. aim 60 min, 2 h/day of revision needed -> 60 / (1 + 1) = 30 min.
 */
const ALPHA = 0.5;
export function dailyBudget(aim: Aim, exams: Exam[], at: number): number {
  return aim.dailyTargetMinutes / (1 + ALPHA * revisionPressure(exams, at).dailyHours);
}

/* ------------------------------------------------------------------ */
/* Personalise a recommendation                                        */
/* ------------------------------------------------------------------ */

export type PersonalInput = {
  now: number;
  /** Minutes from the scroll-time model, before personalisation. */
  baseMinutes: number;
  baseReason: string;
  /** Context the scroll-time model detected. Safety zeros (walking/cycling/car) are never raised. */
  context: string;
  minutesScrolledToday: number;
  mood?: number | undefined;
  lat?: number | undefined;
  lon?: number | undefined;
  placeKind?: PlaceKind | undefined;
  aim: Aim;
  exams: Exam[];
  state: PersonalState;
};

export type Personalised = {
  minutes: number;
  reason: string;
  windDown: boolean;
  budgetToday: number;
  budgetLeft: number;
  overrunRisk: number | null;
  /** Short notes on what changed the number, for the "why" line on the card. */
  factors: string[];
};

export function personalise(i: PersonalInput): Personalised {
  const h = habits(i.state, i.now);
  const pressure = revisionPressure(i.exams, i.now);
  const budget = dailyBudget(i.aim, i.exams, i.now);
  const left = Math.max(0, budget - i.minutesScrolledToday);
  const factors: string[] = [];
  let m = i.baseMinutes;
  let reason = i.baseReason;
  let windDown = false;

  // never raise a safety zero
  if (m === 0 && ["walking", "cycling", "car"].includes(i.context)) {
    return { minutes: 0, reason, windDown, budgetToday: Math.round(budget), budgetLeft: Math.round(left), overrunRisk: null, factors };
  }

  // 1. exam pressure: personal budget for today
  if (pressure.dailyHours > 0 && pressure.next) {
    const d = pressure.next.days;
    factors.push(`${pressure.dailyHours.toFixed(1)} h/day revision needed`);
    if (m > left) {
      m = left;
      reason = d <= 1 ? `${pressure.next.title} ${d === 0 ? "today" : "tomorrow"}: ${Math.round(m)} min, then back to it.`
        : `${pressure.next.title} in ${d} days, so your budget today is ${Math.round(budget)} min.`;
    }
  } else if (m > left) {
    m = left;
    reason = left <= 0 ? "You've used your daily aim, so maybe call it there." : `That's what's left of your ${i.aim.dailyTargetMinutes} min aim today.`;
    factors.push("daily aim");
  }

  // 2. bedtime: learned from their own nights
  if (h.bedtimeMinutes !== null) {
    const nowM = minutesIntoDay(i.now);
    const toBed = h.bedtimeMinutes - nowM;
    if (toBed <= 0) {
      m = Math.min(m, 0);
      windDown = true;
      reason = `It's past your usual bedtime (${h.usualBedtime}). Sleep beats scrolling.`;
      factors.push("past bedtime");
    } else if (toBed <= 60) {
      m = Math.min(m, 5);
      windDown = true;
      reason = `You usually sleep around ${h.usualBedtime}, so time to wind down: ${Math.round(m)} min max.`;
      factors.push("near bedtime");
    }
  }

  // 3. learned overrun habit: trim if they usually go over in this situation
  let risk: number | null = null;
  if (i.state.overrun.n >= 5 && m > 0) {
    const kind = i.placeKind && i.placeKind !== "unknown" ? i.placeKind : placeKindAt(i.state, i.lat, i.lon);
    const x = overrunFeatures(new Date(i.now).getHours(), kind, isNearBedtime(i.state, i.now), pressure.dailyHours, i.mood, m);
    risk = predictOverrun(i.state.overrun.w, x);
    if (risk >= 0.5) {
      const trimmed = Math.max(1, Math.round(m * (1 - 0.5 * risk)));
      if (trimmed < m) {
        factors.push(`you often go over around now (${Math.round(risk * 100)}%)`);
        if (!windDown) reason = `${reason} You often run over at this time, so ${trimmed} min.`;
        m = trimmed;
      }
    }
  }

  return {
    minutes: Math.max(0, Math.round(m)),
    reason,
    windDown,
    budgetToday: Math.round(budget),
    budgetLeft: Math.round(left),
    overrunRisk: risk,
    factors,
  };
}
