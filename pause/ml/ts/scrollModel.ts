/**
 * Pause scroll model: dependency-free inference for the local random forest.
 * Must match features.py and the contract in MODEL_FORMAT.md exactly.
 */

export type TraceSample = { t: number; speed: number | null; atBusStop?: boolean; nearGym?: boolean };

export type ScrollContext = {
  minutesScrolledToday: number;
  dailyTargetMinutes: number;
  examPeriod: boolean;
  daysUntilExam: number; // -1 = none
  minutesToNextCommitment: number; // -1 = none
  inSetRest: boolean;
  mood: number; // 1-5
  hour: number; // 0-23
  expectedTripMinutes: number; // -1 = none
};

export type ContextClass = "stationary" | "gym" | "walking" | "cycling" | "bus" | "car";

export type Tree<V> = { f: number[]; t: number[]; l: number[]; r: number[]; v: V[] };

export type ScrollModel = {
  version: string;
  stopSpeed: number;
  minStopS: number;
  classes: ContextClass[];
  traceFeatureNames: string[];
  classifier: { trees: Tree<number[]>[] };
  regressorFeatureNames: string[];
  regressor: { trees: Tree<number>[] };
};

export type Detection = { context: ContextClass; confidence: number; probabilities: Record<string, number> };

export type Recommendation = Detection & { minutes: number; reason: string };

export type Position = { lat: number; lon: number; timestamp: number; speed?: number | null };

// ---------------------------------------------------------------- features

export function extractTraceFeatures(trace: TraceSample[], model: ScrollModel): number[] {
  const n = trace.length;
  const nf = model.traceFeatureNames.length;
  if (n === 0) return new Array(nf).fill(0);
  const STOP = model.stopSpeed;
  const speeds = trace.map((s) => Math.max(0, s.speed || 0));
  const times = trace.map((s) => s.t);
  const duration = Math.max(times[n - 1] - times[0], 1);
  const mean = sum(speeds) / n;
  const std = Math.sqrt(sum(speeds.map((v) => (v - mean) ** 2)) / n);
  const srt = [...speeds].sort((a, b) => a - b);
  const p75 = srt[Math.min(n - 1, Math.floor(0.75 * (n - 1) + 0.5))];
  const stopped = speeds.map((v) => v < STOP);
  const fracStopped = stopped.filter(Boolean).length / n;

  const step = n > 1 ? times[1] - times[0] : 5;
  const stops: { len: number; bus: boolean }[] = [];
  for (let i = 0; i < n; ) {
    if (!stopped[i]) { i++; continue; }
    let j = i;
    while (j + 1 < n && stopped[j + 1]) j++;
    const len = times[j] - times[i] + step;
    if (len >= model.minStopS) {
      let bus = false;
      for (let k = i; k <= j; k++) if (trace[k].atBusStop) bus = true;
      stops.push({ len, bus });
    }
    i = j + 1;
  }
  const stopsPerMin = stops.length / (duration / 60);
  const meanStop = stops.length ? sum(stops.map((s) => s.len)) / stops.length : 0;
  const fracBus = stops.length ? stops.filter((s) => s.bus).length / stops.length : 0;

  const accels: number[] = [];
  for (let k = 1; k < n; k++) accels.push(Math.abs(speeds[k] - speeds[k - 1]) / Math.max(times[k] - times[k - 1], 1));
  const meanAcc = accels.length ? sum(accels) / accels.length : 0;
  const moving = speeds.filter((v) => v >= STOP);
  const movingMean = moving.length ? sum(moving) / moving.length : 0;
  const gym = trace.filter((s) => s.nearGym).length / n;

  return [mean, Math.max(...speeds), std, p75, fracStopped, stopsPerMin, meanStop, fracBus, meanAcc, movingMean, gym];
}

/** Neumaier-compensated sum, matching CPython >= 3.12 built-in sum() on floats. */
function sum(xs: number[]): number {
  let s = 0, c = 0;
  for (const x of xs) {
    const t = s + x;
    c += Math.abs(s) >= Math.abs(x) ? s - t + x : x - t + s;
    s = t;
  }
  return s + c;
}

// ---------------------------------------------------------------- forest

/** sklearn compares float32(x) <= float64 threshold, so mirror that. */
function leaf<V>(tree: Tree<V>, x: number[]): V {
  let i = 0;
  while (tree.f[i] !== -1) i = Math.fround(x[tree.f[i]]) <= tree.t[i] ? tree.l[i] : tree.r[i];
  return tree.v[i];
}

function classify(features: number[], model: ScrollModel): number[] {
  const k = model.classes.length;
  const acc = new Array(k).fill(0);
  for (const tree of model.classifier.trees) {
    const p = leaf(tree, features);
    for (let c = 0; c < k; c++) acc[c] += p[c];
  }
  return acc.map((v) => v / model.classifier.trees.length);
}

export function detectContext(trace: TraceSample[], model: ScrollModel): Detection {
  return detectFromProbs(classify(extractTraceFeatures(trace, model), model), model);
}

function detectFromProbs(probs: number[], model: ScrollModel): Detection {
  let top = 0;
  for (let c = 1; c < probs.length; c++) if (probs[c] > probs[top]) top = c;
  const probabilities: Record<string, number> = {};
  model.classes.forEach((name, c) => (probabilities[name] = probs[c]));
  return { context: model.classes[top], confidence: probs[top], probabilities };
}

// ---------------------------------------------------------------- recommendation

/** Python's round(): half to even. */
function roundHalfEven(x: number): number {
  const r = Math.round(x);
  return Math.abs(x % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r;
}

export function regressorInput(ctx: ScrollContext, probs: number[]): number[] {
  return [
    ctx.minutesScrolledToday,
    ctx.dailyTargetMinutes,
    ctx.dailyTargetMinutes - ctx.minutesScrolledToday,
    ctx.examPeriod ? 1 : 0,
    ctx.daysUntilExam ?? -1,
    ctx.minutesToNextCommitment ?? -1,
    ctx.inSetRest ? 1 : 0,
    ctx.mood,
    ctx.hour,
    ctx.expectedTripMinutes ?? -1,
    ...probs,
  ];
}

export function recommendScrollMinutes(trace: TraceSample[], ctx: ScrollContext, model: ScrollModel): Recommendation {
  const probs = classify(extractTraceFeatures(trace, model), model);
  const det = detectFromProbs(probs, model);
  const x = regressorInput(ctx, probs);
  let raw = 0;
  for (const tree of model.regressor.trees) raw += leaf(tree, x);
  let minutes = raw / model.regressor.trees.length;

  const { context: top, confidence } = det;
  // 1. safety: moving under your own power or driving
  const unsafe = (top === "walking" || top === "cycling" || top === "car") && confidence >= 0.6;
  if (unsafe) minutes = 0;
  // 2. leave 2 min before the next commitment
  const commit = ctx.minutesToNextCommitment;
  if (commit >= 0) minutes = Math.min(minutes, Math.max(0, commit - 2));
  // 3. gym rest is short
  if (top === "gym") minutes = Math.min(minutes, 3);
  // 4. round, clamp
  minutes = Math.max(0, Math.min(120, roundHalfEven(minutes)));

  return { ...det, minutes, reason: buildReason(top, unsafe, minutes, ctx) };
}

function buildReason(top: ContextClass, unsafe: boolean, m: number, ctx: ScrollContext): string {
  const min = `${m} min`;
  if (unsafe || (m === 0 && (top === "walking" || top === "cycling" || top === "car"))) {
    if (top === "walking") return "Walking: eyes up, scroll later.";
    if (top === "cycling") return "On the bike: hands on the bars, scroll later.";
    return "In the car: no scrolling while you're on the move.";
  }
  const commit = ctx.minutesToNextCommitment;
  if (commit >= 0 && commit - 2 <= m) {
    return m === 0 ? "Something's coming up, so best get going." : `Something's on in ${commit} min, so just ${min}.`;
  }
  if (top === "gym") return ctx.inSetRest && m > 0 ? `Between sets: ${min}, then back to it.` : "Gym time: phone down, smash the set.";
  if (m === 0) return ctx.examPeriod ? "Exam focus: give scrolling a miss for now." : "Not a great time for a scroll, so maybe later.";
  if (ctx.examPeriod && ctx.daysUntilExam >= 0 && ctx.daysUntilExam <= 7) {
    const d = ctx.daysUntilExam;
    const when = d === 0 ? "Exam today" : d === 1 ? "Exam tomorrow" : `Exam in ${d} days`;
    return `${when}, so just ${min}.`;
  }
  if (ctx.dailyTargetMinutes - ctx.minutesScrolledToday <= 0) return `You've hit today's target, so just ${min}.`;
  if (ctx.hour >= 23 || ctx.hour < 6) return `It's late, so ${min} then wind down.`;
  if (ctx.mood <= 2 && m <= 6) return `Rough day? Take ${min}, go easy on yourself.`;
  if (top === "bus") return `You're on the bus, so enjoy ~${min} till your stop.`;
  if (ctx.examPeriod) return `Exam season, so keep it to ${min}.`;
  return `You're settled, so enjoy ${min}.`;
}

// ---------------------------------------------------------------- positions -> trace

const R_EARTH = 6371008.8;

function haversine(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Geolocation positions (timestamp in ms) -> ~5 s trace. Uses coords.speed when
 * present, otherwise haversine distance / dt; then linearly resampled every stepS.
 */
export function speedsFromPositions(positions: Position[], stepS = 5): TraceSample[] {
  const pts = [...positions].sort((a, b) => a.timestamp - b.timestamp);
  if (pts.length === 0) return [];
  const t0 = pts[0].timestamp;
  const raw: { t: number; v: number | null }[] = pts.map((p, i) => {
    if (p.speed != null && Number.isFinite(p.speed) && p.speed >= 0) return { t: (p.timestamp - t0) / 1000, v: p.speed };
    const q = pts[i - 1] ?? pts[i + 1];
    const dt = q ? Math.abs(p.timestamp - q.timestamp) / 1000 : 0;
    return { t: (p.timestamp - t0) / 1000, v: dt > 0 ? haversine(q, p) / dt : null };
  });
  if (raw.length === 1) return [{ t: 0, speed: raw[0].v }];

  const known = raw.filter((r): r is { t: number; v: number } => r.v !== null);
  const out: TraceSample[] = [];
  const end = raw[raw.length - 1].t;
  let j = 0;
  for (let t = 0; t <= end + 1e-9; t += stepS) {
    if (known.length === 0) { out.push({ t, speed: null }); continue; }
    while (j + 1 < known.length && known[j + 1].t <= t) j++;
    const a = known[j], b = known[j + 1];
    let v = a.v;
    if (t < a.t) v = a.v; // before first known sample
    else if (b && b.t > a.t) v = a.v + ((b.v - a.v) * (t - a.t)) / (b.t - a.t);
    out.push({ t, speed: v });
  }
  return out;
}
