import { emptyState, observe, type PersonalState } from "./personalModel";

/** Account-scoped learning stays on this device; no estimated close times are trained. */
export function loadLearning(userId: string): PersonalState {
  try {
    const raw = localStorage.getItem(`pause_personal_${userId}`);
    const state = raw ? JSON.parse(raw) as PersonalState : null;
    return state?.version === 1 && Array.isArray(state.hourly) && Array.isArray(state.places) && state.overrun && state.days ? state : emptyState();
  } catch { return emptyState(); }
}

export function recordOpen(userId: string, now = Date.now()): PersonalState {
  const state = observe(loadLearning(userId), { at: now, kind: "open" });
  try { localStorage.setItem(`pause_personal_${userId}`, JSON.stringify(state)); } catch { /* Private browsing can disable persistence. */ }
  return state;
}