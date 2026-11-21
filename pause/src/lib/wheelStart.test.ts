import { describe, expect, it } from "vitest";
import { wheelStart } from "./wheelStart";
describe("wheelStart", () => {
  it("caps the model's suggestion at 45", () => expect(wheelStart(120)).toBe(45));
  it("keeps suggestions under the cap", () => expect(wheelStart(20)).toBe(20));
  it("never starts below 1", () => expect(wheelStart(0)).toBe(1));
});
