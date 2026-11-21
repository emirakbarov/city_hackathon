export type CommitmentKind = "exam" | "deadline" | "other";
export type Commitment = { id: string; title: string; kind: CommitmentKind; due_date: string; source: string; end_date?: string | null; all_day?: boolean; starts_at?: string | null };

export const KINDS: { value: CommitmentKind; label: string; emoji: string }[] = [
  { value: "exam", label: "Exam", emoji: "📝" },
  { value: "deadline", label: "Deadline", emoji: "⏰" },
  { value: "other", label: "Other", emoji: "📌" },
];

/** Today as YYYY-MM-DD in local time. */
export function todayISO(now = new Date()): string {
  const d = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return d.toISOString().slice(0, 10);
}

/**
 * Shape for the scroll model's ScrollSettings (examDate / nextCommitmentAt).
 * Not wired into the slider yet — a later step will pass this to buildScrollContext.
 */
export function modelInputs(rows: Pick<Commitment, "kind" | "due_date">[], now = new Date()) {
  const today = todayISO(now);
  const upcoming = rows.filter((r) => r.due_date >= today).sort((a, b) => a.due_date.localeCompare(b.due_date));
  return {
    examDate: upcoming.find((r) => r.kind === "exam")?.due_date ?? null,
    nextCommitmentAt: upcoming[0] ? `${upcoming[0].due_date}T09:00:00` : null,
  };
}
