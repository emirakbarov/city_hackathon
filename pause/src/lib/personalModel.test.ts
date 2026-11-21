import { describe, expect, it } from "vitest";
import { emptyState, personalise, observe } from "./personalModel";
import { wheelStart } from "./wheelStart";
import { recordOpen, loadLearning } from "./personalLearning";

describe("Raf's personal model integration", () => {
  const input = { now: new Date(2026, 10, 21, 12).getTime(), baseMinutes: 100, baseReason: "Suggested", context: "stationary", minutesScrolledToday: 0, aim: { dailyTargetMinutes: 180 }, exams: [], state: emptyState() };
  it("keeps the wheel capped at 45 even with the new model", () => {
    expect(wheelStart(personalise(input).minutes)).toBe(45);
  });
  it("preserves a safety zero in the model", () => {
    expect(personalise({ ...input, context: "walking", baseMinutes: 0 }).minutes).toBe(0);
  });
  it("learns opens without inventing actual scroll durations", () => {
    const state = observe(emptyState(), { at: input.now, kind: "open" });
    expect(state.events).toBe(1);
    expect(state.overrun.n).toBe(0);
  });
  it("isolates device learning between accounts", () => {
    localStorage.clear();
    recordOpen("one", input.now);
    expect(loadLearning("one").events).toBe(1);
    expect(loadLearning("two").events).toBe(0);
  });
});