import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarLink } from "./CalendarLink";
import { KINDS, todayISO, type Commitment, type CommitmentKind } from "@/lib/commitments";

type Draft = { id?: string; title: string; kind: CommitmentKind; due_date: string };
const blank = (): Draft => ({ title: "", kind: "exam", due_date: todayISO() });

export function Commitments({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const key = ["commitments", userId];
  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data } = await supabase.from("commitments").select("id, title, kind, due_date, source, end_date, all_day, starts_at")
        .eq("user_id", userId).gte("due_date", todayISO()).order("due_date");
      return (data ?? []) as Commitment[];
    },
  });
  const [draft, setDraft] = useState<Draft | null>(null);
  const editing = draft ?? (!isLoading && rows.length === 0 ? blank() : null);

  async function save(d: Draft) {
    const title = d.title.trim();
    if (!title) { toast.error("Give it a name"); return; }
    const row = { title, kind: d.kind, due_date: d.due_date };
    const { error } = d.id
      ? await supabase.from("commitments").update({ ...row, updated_at: new Date().toISOString() }).eq("id", d.id)
      : await supabase.from("commitments").insert({ ...row, user_id: userId });
    if (error) { toast.error("Couldn't save"); return; }
    setDraft(null);
    qc.invalidateQueries({ queryKey: key });
  }
  async function remove(id: string) {
    const { error } = await supabase.from("commitments").delete().eq("id", id);
    if (error) { toast.error("Couldn't delete"); return; }
    if (draft?.id === id) setDraft(null);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <h2 className="text-xl font-bold">Coming up</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        {rows.length ? "Your exams, deadlines and other important things." : "What do you have coming up? Exams, deadlines, anything important."}
      </p>

      {rows.length > 0 && (
        <ul className="mb-4 divide-y divide-border">
          {rows.map((r) => {
            const k = KINDS.find((x) => x.value === r.kind) ?? KINDS[2]!;
            return (
              <li key={r.id} className="flex items-center gap-3 py-3">
                <span className="text-2xl">{k.emoji}</span>
                <button className="min-w-0 flex-1 text-left" disabled={r.source === "google_calendar"}
                  onClick={() => setDraft({ id: r.id, title: r.title, kind: r.kind, due_date: r.due_date })}>
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="text-sm text-muted-foreground">{r.source === "google_calendar" ? "📅 Calendar" : k.label} · {whenLabel(r)}</p>
                </button>
                <button aria-label={`Delete ${r.title}`} onClick={() => remove(r.id)}
                  className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground hover:bg-accent">×</button>
              </li>
            );
          })}
        </ul>
      )}

      {editing ? (
        <EntryForm key={editing.id ?? "new"} initial={editing} onSave={save} onCancel={rows.length ? () => setDraft(null) : undefined} />
      ) : (
        <Button variant="secondary" className="h-12 w-full rounded-2xl" onClick={() => setDraft(blank())}>Add something</Button>
      )}
      <CalendarLink userId={userId} />
    </section>
  );
}

function EntryForm({ initial, onSave, onCancel }: { initial: Draft; onSave: (d: Draft) => void; onCancel?: (() => void) | undefined }) {
  const [d, setD] = useState(initial);
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); onSave(d); }}>
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map((k) => (
          <button type="button" key={k.value} onClick={() => setD({ ...d, kind: k.value })}
            className={`h-12 rounded-2xl text-sm font-semibold transition active:scale-95 ${d.kind === k.value ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
            {k.emoji} {k.label}
          </button>
        ))}
      </div>
      <Input aria-label="Title" placeholder="e.g. Maths exam" maxLength={120} value={d.title}
        onChange={(e) => setD({ ...d, title: e.target.value })} className="h-12 rounded-2xl" />
      <Input aria-label="Date" type="date" min={todayISO()} value={d.due_date} required
        onChange={(e) => setD({ ...d, due_date: e.target.value })} className="h-12 rounded-2xl" />
      <div className="flex gap-2">
        {onCancel && <Button type="button" variant="ghost" className="h-12 flex-1 rounded-2xl" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" className="h-12 flex-1 rounded-2xl">{initial.id ? "Save changes" : "Add"}</Button>
      </div>
    </form>
  );
}

const day = (iso: string) => new Date(`${iso}T00:00`).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
function whenLabel(r: Commitment): string {
  if (r.starts_at && !r.all_day) {
    const t = new Date(r.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    return `${day(r.due_date)}, ${t}`;
  }
  return r.end_date && r.end_date !== r.due_date ? `${day(r.due_date)} – ${day(r.end_date)}` : day(r.due_date);
}
