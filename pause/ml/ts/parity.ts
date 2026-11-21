// Parity check: TS inference vs Python. Run from anywhere:
//   node --experimental-strip-types pause-model/ts/parity.ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { extractTraceFeatures, detectContext, recommendScrollMinutes } from "./scrollModel.ts";
import type { ScrollModel, ScrollContext, TraceSample } from "./scrollModel.ts";

type Case = { trace: TraceSample[]; context: ScrollContext; features: number[]; probabilities: number[]; minutes: number };

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const model: ScrollModel = JSON.parse(readFileSync(join(root, "scroll-model.json"), "utf8"));
const cases: Case[] = JSON.parse(readFileSync(join(root, "data", "parity_cases.json"), "utf8"));

// Leaves are exported rounded to 5 dp (thresholds 6 dp), so probabilities match sklearn to ~1e-5, not bit-exactly.
const F_TOL = 1e-12, P_TOL = 1e-4;
let maxF = 0, maxP = 0, minuteMismatch = 0, topMismatch = 0;
const bad: string[] = [];
cases.forEach((c, i) => {
  const f = extractTraceFeatures(c.trace, model);
  const fd = Math.max(...f.map((v, k) => Math.abs(v - c.features[k])));
  const det = detectContext(c.trace, model);
  const p = model.classes.map((name) => det.probabilities[name]);
  const pd = Math.max(...p.map((v, k) => Math.abs(v - c.probabilities[k])));
  const rec = recommendScrollMinutes(c.trace, c.context, model);
  const pyTop = c.probabilities.indexOf(Math.max(...c.probabilities));
  if (model.classes[pyTop] !== det.context) topMismatch++;
  maxF = Math.max(maxF, fd);
  maxP = Math.max(maxP, pd);
  if (rec.minutes !== c.minutes) {
    minuteMismatch++;
    if (bad.length < 10) bad.push(`case ${i}: ts=${rec.minutes} py=${c.minutes} (${rec.context} ${rec.confidence.toFixed(3)})`);
  }
  if ((fd > F_TOL || pd > P_TOL) && bad.length < 10) bad.push(`case ${i}: featureDiff=${fd} probDiff=${pd}`);
});

console.log(`cases: ${cases.length}`);
console.log(`max |feature diff|: ${maxF}`);
console.log(`max |probability diff|: ${maxP}`);
console.log(`top-class mismatches: ${topMismatch}`);
console.log(`minute mismatches: ${minuteMismatch}`);
if (bad.length) console.log(bad.join("\n"));
const sample = cases[0] && recommendScrollMinutes(cases[0].trace, cases[0].context, model);
if (sample) console.log("sample:", JSON.stringify(sample));
process.exit(maxF > F_TOL || maxP > P_TOL || topMismatch > 0 || minuteMismatch > 0 ? 1 : 0);
