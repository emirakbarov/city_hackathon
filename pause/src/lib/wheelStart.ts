/** The wheel's own 45-minute cap replaces the model's 120-minute ceiling. */
export const WHEEL_MAX = 45;

export function wheelStart(modelMinutes: number): number {
  return Math.max(1, Math.min(WHEEL_MAX, Math.round(modelMinutes)));
}
