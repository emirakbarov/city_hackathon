import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { PROFILE_COLS, whatsappLink, type Profile } from "@/lib/pause";
import { Button } from "@/components/ui/button";
import { PAvatar } from "./Avatar";

type Nudge = { id: string; sender_id: string; recipient_id: string; activity: string; status: string; created_at: string; responded_at: string | null };
const DISMISS_KEY = "pause_dismissed_matches";

export function useLiveNudges() {
  const me = useMe();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["nudges-live", me.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 2 * 3600_000).toISOString();
      const { data } = await supabase
        .from("nudges")
        .select("id, sender_id, recipient_id, activity, status, created_at, responded_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      const rows = (data ?? []) as Nudge[];
      const ids = [...new Set(rows.flatMap((n) => [n.sender_id, n.recipient_id]))].filter((i) => i !== me.id);
      const { data: ps } = ids.length
        ? await supabase.from("profiles").select(PROFILE_COLS).in("id", ids)
        : { data: [] };
      const people = new Map((ps ?? []).map((p) => [p.id, p as Profile]));
      return { rows, people };
    },
  });
  useEffect(() => {
    const ch = supabase
      .channel(`nudges-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "nudges" }, () => {
        qc.invalidateQueries({ queryKey: ["nudges-live", me.id] });
        qc.invalidateQueries({ queryKey: ["dashboard"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [me.id, qc]);
  return q;
}

export function NudgeCenter() {
  const me = useMe();
  const qc = useQueryClient();
  const { data } = useLiveNudges();
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => { setDismissed(JSON.parse(localStorage.getItem(DISMISS_KEY) ?? "[]")); }, []);
  if (!data) return null;

  const incoming = data.rows.filter((n) => n.recipient_id === me.id && n.status === "pending");
  const matches = data.rows.filter((n) => n.status === "accepted" && !dismissed.includes(n.id));
  if (!incoming.length && !matches.length) return null;

  async function respond(id: string, status: "accepted" | "declined") {
    await supabase.from("nudges").update({ status, responded_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["nudges-live", me.id] });
  }
  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    localStorage.setItem(DISMISS_KEY, JSON.stringify(next.slice(-50)));
  }

  return (
    <div className="sticky top-0 z-20 space-y-2 px-4 pt-3">
      {incoming.map((n) => {
        const p = data.people.get(n.sender_id);
        return (
          <div key={n.id} className="rounded-3xl border border-primary/30 bg-card p-4 shadow-lg animate-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <PAvatar name={p?.display_name ?? "?"} src={p?.avatar_url} />
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">{p?.display_name ?? "A friend"} nudged you</p>
                <p className="text-xl font-semibold">{n.activity}</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="secondary" className="h-12 rounded-2xl" onClick={() => respond(n.id, "declined")}>Not now</Button>
              <Button className="h-12 rounded-2xl" onClick={() => respond(n.id, "accepted")}>I'm in</Button>
            </div>
          </div>
        );
      })}
      {matches.map((n) => (
        <MatchCard key={n.id} nudge={n} other={data.people.get(n.sender_id === me.id ? n.recipient_id : n.sender_id)} onClose={() => dismiss(n.id)} />
      ))}
    </div>
  );
}

function MatchCard({ nudge, other, onClose }: { nudge: Nudge; other?: Profile | undefined; onClose: () => void }) {
  const [phone, setPhone] = useState<string | null>(null);
  useEffect(() => {
    if (!other) return;
    supabase.rpc("get_phone", { _uid: other.id }).then(({ data }) => setPhone((data as string | null) ?? null));
  }, [other]);
  const wa = whatsappLink(phone);
  return (
    <div className="rounded-3xl bg-success p-4 text-primary-foreground shadow-lg animate-in zoom-in-95">
      <p className="text-2xl font-bold">It's on 🎉</p>
      <p className="mt-1 opacity-90">{nudge.activity.replace("?", "")} with {other?.display_name ?? "your friend"}</p>
      <div className="mt-3 flex gap-2">
        {wa ? (
          <Button asChild variant="secondary" className="h-12 flex-1 rounded-2xl">
            <a href={wa} target="_blank" rel="noreferrer">Message on WhatsApp</a>
          </Button>
        ) : phone ? (
          <Button asChild variant="secondary" className="h-12 flex-1 rounded-2xl"><a href={`sms:${phone}`}>Text them</a></Button>
        ) : (
          <p className="flex-1 self-center text-sm opacity-90">You're both in — go sort it out!</p>
        )}
        <Button variant="ghost" className="h-12 rounded-2xl text-primary-foreground hover:bg-primary-foreground/15" onClick={onClose}>Done</Button>
      </div>
    </div>
  );
}
