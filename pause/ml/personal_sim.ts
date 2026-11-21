/**
 * Simulate 4 weeks of one student ("Sam") using Pause, and check the personal model learns them.
 * Run from pause/: node --experimental-strip-types ml/personal_sim.ts
 */
import fs from "node:fs";
import {
  emptyState, observe, habits, personalise, dailyBudget, revisionPressure, clockLabel,
  type ActivityEvent, type Exam, type PersonalState, type PlaceKind,
} from "../src/lib/personalModel.ts";

// --- real places (OSM) for matching, same as the app ---------------------------------
type Entry = [number, number, string, number];
const idx = JSON.parse(fs.readFileSync(new URL("../src/lib/places-london.json", import.meta.url), "utf8")) as Record<string, Entry[]>;
function dist(a: number, b: number, c: number, d: number) {
  const x = ((d - b) * Math.PI / 180) * Math.cos(((a + c) / 2) * Math.PI / 180), y = (c - a) * Math.PI / 180;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}
function osmKind(lat: number, lon: number): PlaceKind {
  for (const k of ["gym", "study", "home", "food", "park"] as const)
    for (const p of idx[k] ?? []) if (dist(lat, lon, p[0], p[1]) <= p[3]) return k;
  return "unknown";
}

// --- Sam's world ---------------------------------------------------------------------
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
const jitter = (p: [number, number], m = 15): [number, number] => [p[0] + (gauss() * m) / 111_000, p[1] + (gauss() * m) / 69_000];

const HOME: [number, number] = [51.5330, -0.1050];      // private flat: not in OSM, must be learned
const BAYES: [number, number] = [51.52204, -0.09038];   // Bayes Business School
const GYM: [number, number] = [51.52302, -0.08934];     // Virgin Active (OSM)
const PUB: [number, number] = [51.52341, -0.09009];     // The Artillery Arms (OSM)

const TRUE_WAKE = 8 * 60 + 30;      // 08:30
const TRUE_BED_WEEK = 24 * 60 + 45; // 00:45
const TRUE_BED_WKND = 25 * 60 + 30; // 01:30
const START = new Date("2026-10-26T00:00:00").getTime(); // a Monday
const DAYS = 28;
const aim = { dailyTargetMinutes: 60, goal: "Do well in first-year exams" };
const exams: Exam[] = [
  { id: "e1", title: "Economics exam", date: "2026-11-20T09:30:00", importance: 3, revisionHoursLeft: 30 },
  { id: "e2", title: "Stats quiz", date: "2026-11-13T14:00:00", importance: 1 },
];

type Planned = { at: number; where: [number, number] };
function planDay(d: number): Planned[] {
  const day0 = START + d * 86_400_000;
  const dow = new Date(day0).getDay(); // 0 Sun
  const weekend = dow === 0 || dow === 6;
  const wake = TRUE_WAKE + gauss() * 35 + (weekend ? 90 : 0);
  const bed = (weekend ? TRUE_BED_WKND : TRUE_BED_WEEK) + gauss() * 25;
  const at = (min: number) => day0 + Math.round(min) * 60_000;
  const p: Planned[] = [{ at: at(wake + 3), where: HOME }];
  if (!weekend) {
    for (const t of [11 * 60, 12 * 60 + 40, 15 * 60, 16 * 60 + 30]) p.push({ at: at(t + gauss() * 20), where: BAYES });
    if (dow === 1 || dow === 3 || dow === 5) p.push({ at: at(18 * 60 + 30 + gauss() * 15), where: GYM }, { at: at(18 * 60 + 50 + gauss() * 10), where: GYM });
    if (dow === 4) p.push({ at: at(20 * 60 + gauss() * 20), where: PUB });
  } else {
    p.push({ at: at(13 * 60 + gauss() * 40), where: HOME }, { at: at(16 * 60 + gauss() * 40), where: HOME });
  }
  for (const t of [21 * 60 + 30, 23 * 60, bed - 25, bed - 5]) p.push({ at: at(t + gauss() * 10), where: HOME });
  return p.sort((a, b) => a.at - b.at);
}

/** Ground truth: Sam goes over the picked time late at night at home, rarely at uni. */
function trulyOverruns(at: number, where: [number, number], bedAbs: number): boolean {
  const toBed = (bedAbs - at) / 60_000;
  const pr = toBed <= 75 ? 0.8 : where === BAYES ? 0.1 : where === GYM ? 0.05 : 0.3;
  return rnd() < pr;
}

// --- run --------------------------------------------------------------------------------
let state: PersonalState = emptyState();
const actualLast: { wk: number[]; we: number[] } = { wk: [], we: [] };
let correct = 0, total = 0, baseCorrect = 0;
const scored: [number, number][] = []; // [risk, overran]
const report: string[] = [];
for (let d = 0; d < DAYS; d++) {
  const plan = planDay(d);
  const bedAbs = plan[plan.length - 1]!.at + 5 * 60_000;
  let scrolled = 0;
  for (const ev of plan) {
    const kind = osmKind(ev.where[0], ev.where[1]);
    const [lat, lon] = jitter(ev.where);
    const open: ActivityEvent = { at: ev.at, kind: "open", lat, lon, placeKind: kind, mood: 3 };
    state = observe(state, open, exams);
    const chosen = 10 + Math.round(rnd() * 10);
    const over = trulyOverruns(ev.at, ev.where, bedAbs);
    // evaluate the overrun model's prediction BEFORE it sees the outcome (only once it has data)
    if (state.overrun.n >= 10) {
      const r = personalise({ now: ev.at, baseMinutes: chosen, baseReason: "", context: "stationary", minutesScrolledToday: 0,
        lat, lon, placeKind: kind, aim: { dailyTargetMinutes: 1000 }, exams: [], state });
      if (r.overrunRisk !== null) { scored.push([r.overrunRisk, over ? 1 : 0]); total++; if ((r.overrunRisk >= 0.5) === over) correct++; if (!over) baseCorrect++; }
    }
    const actual = over ? Math.round(chosen * (1.5 + rnd())) : Math.round(chosen * (0.6 + rnd() * 0.5));
    scrolled += actual;
    if (ev === plan[plan.length - 1]) {
      const dow = new Date(START + d * 86_400_000).getDay();
      const m = (ev.at + actual * 60_000 - (START + d * 86_400_000)) / 60_000;
      (dow === 5 || dow === 6 ? actualLast.we : actualLast.wk).push(m);
    }
    state = observe(state, { at: ev.at + actual * 60_000, kind: "close", lat, lon, placeKind: kind, chosenMinutes: chosen, actualMinutes: actual, mood: 3 }, exams);
  }
  if ([2, 6, 13, 27].includes(d)) {
    const h = habits(state);
    const wkNight = START + d * 86_400_000 - ((new Date(START + d * 86_400_000).getDay() + 6) % 7) * 86_400_000 + 12 * 3_600_000; // that week's Monday noon
    const hw = habits(state, wkNight), he = habits(state, wkNight + 5 * 86_400_000);
    report.push(`after day ${d + 1}: weekday wake ${hw.usualWake ?? "?"} / bed ${hw.usualBedtime ?? "?"}, weekend wake ${habits(state, wkNight + 6 * 86_400_000).usualWake ?? "?"} / Fri-Sat bed ${he.usualBedtime ?? "?"}, peak hours ${h.peakHours.join("/")}, places ${h.frequentPlaces.map((f) => `${f.label}(${f.visits})`).join(", ") || "-"}`);
  }
}

console.log("Sam: true wake 08:30 (10:00 weekends), true bedtime ~00:50 weekdays / ~01:35 weekends\n");
const med = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)] ?? 0; };
const hm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
console.log(`Sam actually put the phone down (median): weekdays ${hm(med(actualLast.wk))}, Fri/Sat nights ${hm(med(actualLast.we))}\n`);
console.log(report.join("\n"));
const pos = scored.filter((x) => x[1] === 1), neg = scored.filter((x) => x[1] === 0);
let wins = 0; for (const p of pos) for (const n of neg) wins += p[0] > n[0] ? 1 : p[0] === n[0] ? 0.5 : 0;
console.log(`\noverrun ranking quality (AUC, 0.5 = guessing, 1 = perfect): ${(wins / (pos.length * neg.length)).toFixed(2)}`);
console.log(`overrun prediction accuracy (on events before the model saw them): ${(100 * correct / total).toFixed(1)}% vs ${(100 * baseCorrect / total).toFixed(1)}% always guessing "no" (${total} events)`);

// --- what it recommends now, with the economics exam approaching -----------------------
console.log(`\nDaily budget (aim ${aim.dailyTargetMinutes} min) as the Economics exam (30 h revision) gets closer:`);
for (const daysOut of [21, 14, 7, 3, 1, 0]) {
  const t = new Date("2026-11-20T09:30:00").getTime() - daysOut * 86_400_000 - 3 * 3_600_000;
  const rp = revisionPressure([exams[0]!], t);
  console.log(`  ${String(daysOut).padStart(2)} days out: ${rp.dailyHours.toFixed(1)} h/day revision -> ${Math.round(dailyBudget(aim, [exams[0]!], t))} min/day`);
}

const today = START + (DAYS - 4) * 86_400_000; // a Thursday
const at = (hh: number, mm = 0) => today + (hh * 60 + mm) * 60_000;
console.log("\nPersonalised recommendations on a Thursday after 4 weeks (no exams, 20 min scrolled so far):");
for (const [label, t, where, base] of [
  ["Bayes 17:00 (model says 0)", at(17), BAYES, 0], ["Bayes 12:30", at(12, 30), BAYES, 9], ["Gym 18:40", at(18, 40), GYM, 2],
  ["Home 21:30", at(21, 30), HOME, 28], ["Home 00:30", at(24, 30), HOME, 14], ["Home 01:20", at(25, 20), HOME, 14],
] as const) {
  const [lat, lon] = where;
  const r = personalise({ now: t, baseMinutes: base, baseReason: "(base reason)", context: "stationary", minutesScrolledToday: 20,
    lat, lon, placeKind: osmKind(lat, lon), aim, exams: [], state });
  console.log(`  ${label.padEnd(28)} ${String(base).padStart(2)} -> ${String(r.minutes).padStart(2)} min  ${r.reason}${r.factors.length ? `  [${r.factors.join("; ")}]` : ""}`);
}
console.log(`\nclock check: ${clockLabel(20 * 60 + 45)} should be 00:45`);
