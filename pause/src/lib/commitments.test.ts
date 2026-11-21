import { describe, expect, it } from "vitest";
import { modelInputs } from "./commitments";
const now = new Date(2026, 10, 21, 12);
describe("modelInputs", () => {
  it("picks the next upcoming exam, ignoring past ones", () => {
    expect(modelInputs([{ kind: "exam", due_date: "2026-11-01" }, { kind: "exam", due_date: "2026-12-03" }, { kind: "deadline", due_date: "2026-11-25" }], now).examDate).toBe("2026-12-03");
  });
  it("next commitment is the soonest of any type", () => {
    expect(modelInputs([{ kind: "exam", due_date: "2026-12-03" }, { kind: "deadline", due_date: "2026-11-25" }], now).nextCommitmentAt).toBe("2026-11-25T09:00:00");
  });
  it("nothing upcoming gives nulls", () => {
    expect(modelInputs([], now)).toEqual({ examDate: null, nextCommitmentAt: null });
  });
});
