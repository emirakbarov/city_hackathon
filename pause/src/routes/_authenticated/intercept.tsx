import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import {
  ACTIVE_WINDOW_MIN, ACTIVITIES, FREE, MOODS, PROFILE_COLS, REASONS, SHORTCUT_URL,
  friendIds, inviteUrl, latestPerUser, timeAgo, type Profile,
} from "@/lib/pause";
import { Button } from "@/components/ui/button";
import { PAvatar } from "@/components/pause/Avatar";
import { ScrollRecommendation } from "@/components/pause/ScrollRecommendation";

export const Route = createFileRoute("/_authenticated/intercept")({
  // ?demo=bus|gym|walk|library|over swaps the live GPS trace for a preset (hackathon demo).
  validateSearch: (s: Record<string, unknown>): { app?: string; demo?: string } => ({
    ...(typeof s["app"] === "string" ? { app: s["app"] as string } : {}),
    ...(typeof s["demo"] === "string" ? { demo: s["demo"] as string } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Pause before you scroll" },
      { name: "description", content: "A quick check-in and the friends who are free right now." },
      { property: "og:title", content: "Pause before you scroll" },
      { property: "og:description", content: "A quick check-in and the friends who are free right now." },
    ],
  }),
  component: Intercept,
});

function Intercept() {
  const me = useMe();
  const { app, demo } = Route.useSearch();
  const appName = (app || "instagram").toLowerCase();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState(3); // "Okay" if they skip the mood question
  // TODO: save on the session row once `sessions` has a minutes column (ask Lovable; don't hand-edit migrations).
  const [scrollMinutes, setScrollMinutes] = useState<number | null>(null);
  const showDemo = demo !== undefined || import.meta.env.DEV;
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    supabase.from("sessions").insert({ user_id: me.id, app: appName }).select("id").single()
      .then(({ data, error }) => { if (error) toast.error("Couldn't log this open"); else setSessionId(data.id); });
  }, [me.id, appName]);

  async function answer(patch: { reason?: string; mood?: number; free_status?: string }) {
    if (patch.mood !== undefined) setMood(patch.mood);
    setStep((s) => s + 1);
    if (sessionId) await supabase.from("sessions").update(patch).eq("id", sessionId);
  }

  async function exit(outcome: "redirected" | "continued") {
    if (sessionId) await supabase.from("sessions").update({ outcome }).eq("id", sessionId);
    if (outcome === "continued") window.location.href = SHORTCUT_URL;
    else navigate({ to: "/" });
  }

  const label = appName === "instagram" ? "Instagram" : appName;

  return (
    <main className="flex min-h-[100dvh] flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6">
      <div className="mb-6 flex gap-1.5">
        {[0, 1, 2, 3].map((i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : i === step ? "bg-primary/50" : "bg-border"}`} />)}
      </div>

      {step === 0 && (
        <Question title={`Why are you opening ${label}?`} onSkip={() => setStep(1)}>
          <div className="grid gap-3">
            {REASONS.map((r) => <BigButton key={r.value} onClick={() => answer({ reason: r.value })}>{r.label}</BigButton>)}
          </div>
        </Question>
      )}
      {step === 1 && (
        <Question title="How are you feeling?" onSkip={() => setStep(2)}>
          <div className="grid grid-cols-5 gap-2">
            {MOODS.map((m) => (
              <button key={m.value} onClick={() => answer({ mood: m.value })}
                className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-3xl bg-card text-4xl shadow-sm transition active:scale-95">
                {m.emoji}<span className="text-xs text-muted-foreground">{m.label}</span>
              </button>
            ))}
          </div>
        </Question>
      )}
      {step === 2 && (
        <Question title="Free to do something in the next hour?" onSkip={() => setStep(3)}>
          <div className="grid gap-3">
            {FREE.map((f) => <BigButton key={f.value} onClick={() => answer({ free_status: f.value })}>{f.label}</BigButton>)}
          </div>
        </Question>
      )}
      {step === 3 && (
        <ScrollRecommendation
          mood={mood} demo={demo} showDemo={showDemo}
          onDemoChange={(d) => navigate({ to: "/intercept", search: { ...(app ? { app } : {}), ...(d ? { demo: d } : {}) }, replace: true })}
          minutes={scrollMinutes} onMinutes={setScrollMinutes} onNext={() => setStep(4)}
        />
      )}
      {step >= 4 && <FriendsNow sessionId={sessionId} />}

      <div className="mt-auto space-y-2 pt-6">
        <Button className="h-14 w-full rounded-2xl text-lg" onClick={() => exit("redirected")}>Do something else</Button>
        <Button variant="ghost" className="h-12 w-full rounded-2xl text-muted-foreground" onClick={() => exit("continued")}>
          Continue to {label}{scrollMinutes && step >= 3 ? ` · ${scrollMinutes} min` : ""}
        </Button>
      </div>
    </main>
  );
}

function Question({ title, onSkip, children }: { title: string; onSkip: () => void; children: React.ReactNode }) {
  return (
    <section className="animate-in fade-in slide-in-from-right-4">
      <h1 className="mb-6 text-3xl font-bold leading-tight">{title}</h1>
      {children}
      <button onClick={onSkip} className="mt-4 w-full py-2 text-sm text-muted-foreground underline-offset-4 hover:underline">Skip</button>
    </section>
  );
}

function BigButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-16 rounded-2xl bg-card px-5 text-left text-lg font-semibold shadow-sm transition active:scale-[0.98] active:bg-accent">
      {children}
    </button>
  );
}

type Active = { session_id: string; user_id: string; created_at: string; free_status: string | null };

function FriendsNow({ sessionId }: { sessionId: string | null }) {
  const me = useMe();
  const qc = useQueryClient();
  const [now, setNow] = useState(Date.now());
  const [picking, setPicking] = useState<string | null>(null);
  const [sent, setSent] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["friends-now", me.id],
    queryFn: async () => {
      const ids = await friendIds(me.id);
      if (!ids.length) return [];
      const since = new Date(Date.now() - ACTIVE_WINDOW_MIN * 60_000).toISOString();
      const { data: rows } = await supabase.from("session_status")
        .select("session_id, user_id, created_at, free_status")
        .in("user_id", ids).neq("outcome", "cancelled").gte("created_at", since);
      const latest = latestPerUser((rows ?? []) as Active[]);
      if (!latest.length) return [];
      const { data: ps } = await supabase.from("profiles").select(PROFILE_COLS).in("id", latest.map((l) => l.user_id));
      const map = new Map((ps ?? []).map((p) => [p.id, p as Profile]));
      return latest.map((l) => ({ ...l, profile: map.get(l.user_id) })).filter((l) => l.profile);
    },
  });

  useEffect(() => {
    const ch = supabase.channel(`status-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "session_status" }, () =>
        qc.invalidateQueries({ queryKey: ["friends-now", me.id] }))
      .subscribe();
    const t = setInterval(() => { setNow(Date.now()); qc.invalidateQueries({ queryKey: ["friends-now", me.id] }); }, 30_000);
    return () => { supabase.removeChannel(ch); clearInterval(t); };
  }, [me.id, qc]);

  async function nudge(to: string, activity: string) {
    setPicking(null);
    const { error } = await supabase.from("nudges").insert({ sender_id: me.id, recipient_id: to, activity, session_id: sessionId });
    if (error) { toast.error("Couldn't send nudge"); return; }
    setSent((s) => ({ ...s, [to]: activity }));
    toast.success("Nudge sent 👋");
  }

  const freeLabel: Record<string, string> = { yes: "Free ✅", maybe: "Maybe 🤔", no: "Busy" };

  return (
    <section className="animate-in fade-in">
      <h1 className="mb-1 text-3xl font-bold">Friends in the same boat</h1>
      <p className="mb-5 text-muted-foreground">Also about to scroll, right now.</p>
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-3xl bg-muted" />
      ) : !data?.length ? (
        <div className="rounded-3xl bg-card p-6 text-center shadow-sm">
          <p className="text-4xl">🌙</p>
          <p className="mt-2 font-semibold">None of your friends are scrolling right now</p>
          <Button variant="secondary" className="mt-4 h-12 rounded-2xl" onClick={async () => {
            await navigator.clipboard.writeText(inviteUrl(me.username));
            toast.success("Invite link copied");
          }}>Invite a friend</Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {data.map((f) => (
            <li key={f.user_id} className="rounded-3xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <PAvatar name={f.profile!.display_name} src={f.profile!.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.profile!.display_name}</p>
                  <p className="text-sm text-muted-foreground">opened Instagram {timeAgo(f.created_at, now)}</p>
                </div>
                {f.free_status && <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold">{freeLabel[f.free_status]}</span>}
              </div>
              {sent[f.user_id] ? (
                <p className="mt-3 text-center text-sm text-muted-foreground">Sent “{sent[f.user_id]}” — waiting…</p>
              ) : picking === f.user_id ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {ACTIVITIES.map((a) => (
                    <button key={a} onClick={() => nudge(f.user_id, a)} className="rounded-full bg-accent px-4 py-2.5 font-semibold text-accent-foreground active:scale-95">{a}</button>
                  ))}
                </div>
              ) : (
                <Button className="mt-3 h-12 w-full rounded-2xl" variant="secondary" onClick={() => setPicking(f.user_id)}>Nudge 👋</Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
