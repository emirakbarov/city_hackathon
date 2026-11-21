import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import {
  ACTIVE_WINDOW_MIN, ACTIVITIES, PROFILE_COLS, REASONS, passUrl,
  friendIds, inviteUrl, latestPerUser, timeAgo, type Profile,
} from "@/lib/pause";
import { Button } from "@/components/ui/button";
import { PAvatar } from "@/components/pause/Avatar";
import { LimitSlider } from "@/components/pause/LimitSlider";
import { useSuggestedMinutes } from "@/lib/useSuggestedMinutes";
import { timerExpired, timerMinutes } from "@/lib/scrollTimer";
import { ProductiveIdeas } from "@/components/pause/ProductiveIdeas";

export const Route = createFileRoute("/_authenticated/intercept")({
  validateSearch: (s: Record<string, unknown>): { app?: string; expires?: string; minutes?: number } => {
    const minutes = timerMinutes(s["minutes"]);
    return {
      ...(typeof s["app"] === "string" ? { app: s["app"] } : {}),
      ...(typeof s["expires"] === "string" ? { expires: s["expires"] } : {}),
      ...(minutes === undefined ? {} : { minutes }),
    };
  },
  beforeLoad: ({ search }) => {
    if (timerExpired(search.expires)) throw redirect({ to: "/times-up", search: search.minutes === undefined ? {} : { minutes: search.minutes } });
  },
  head: () => ({
    meta: [
      { title: "Pause before you scroll" },
      { name: "description", content: "A quick check-in and the friends who are free right now." },
      { property: "og:title", content: "Pause before you scroll" },
      { property: "og:description", content: "A quick check-in and the friends who are free right now." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Intercept,
});

function Intercept() {
  const me = useMe();
  const { app } = Route.useSearch();
  const appName = (app || "instagram").toLowerCase();
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [vibe, setVibe] = useState<string | null>(null);
  const started = useRef(false);
  const [limit, setLimit] = useState(15);
  const suggestion = useSuggestedMinutes(me.id, step >= 1);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    supabase.from("sessions").insert({ user_id: me.id, app: appName }).select("id").single()
      .then(({ data, error }) => { if (error) toast.error("Couldn't log this open"); else setSessionId(data.id); });
  }, [me.id, appName]);

  async function answer(patch: { reason?: string }) {
    setStep((s) => s + 1);
    if (sessionId) await supabase.from("sessions").update(patch).eq("id", sessionId);
  }

  async function exit(outcome: "redirected" | "continued", destination?: string) {
    if (sessionId) await supabase.from("sessions").update(outcome === "continued" ? { outcome, limit_minutes: limit } : { outcome }).eq("id", sessionId);
    if (outcome === "continued") window.location.href = passUrl(limit);
    else if (destination) window.location.href = destination;
    else navigate({ to: "/" });
  }

  const label = appName === "instagram" ? "Instagram" : appName;

  return (
    <main className="flex min-h-[100dvh] flex-col px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-6">
      <div className="mb-6 flex gap-1.5">
        {[0].map((i) => <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-primary" : i === step ? "bg-primary/50" : "bg-border"}`} />)}
      </div>

      {step === 0 && (
        <section className="animate-in fade-in slide-in-from-right-4">
          <h1 className="mb-6 text-3xl font-bold leading-tight">Do you want to...</h1>
          <div className="grid gap-3">
            {REASONS.map((r) => <BigButton key={r.value} onClick={() => { setVibe(r.value); answer({ reason: r.value }); }}>{r.label}</BigButton>)}
          </div>
        </section>
      )}
      {step >= 1 && vibe === "productive" && <ProductiveIdeas onPick={url => exit("redirected", url)} />}
      {step >= 1 && <FriendsNow sessionId={sessionId} vibe={vibe} />}

      {step >= 1 && vibe !== "productive" && <InterestIdeas interests={me.interests ?? []} onPick={(i) => { toast.success(`Enjoy ${i.toLowerCase()} ✨`); exit("redirected"); }} />}

      {step >= 1 && (
        <section className="mt-8 animate-in fade-in">
          <h2 className="mb-1 text-xl font-bold">Still want to scroll?</h2>
          <p className="mb-4 text-sm text-muted-foreground">{suggestion ? `Suggested: ${suggestion.reason}` : "Up to 45 minutes. Past 30 it gets hard on purpose."}</p>
          <LimitSlider onChange={setLimit} suggested={suggestion?.minutes ?? null} />
        </section>
      )}

      <div className="mt-auto space-y-2 pt-6">
        <Button className="h-14 w-full rounded-2xl text-lg" onClick={() => exit("redirected")}>Do something else</Button>
        {step >= 1 && (
          <Button variant="ghost" className="h-12 w-full rounded-2xl text-muted-foreground" onClick={() => exit("continued")}>
            {`Start ${limit} min on ${label}`}
          </Button>
        )}
      </div>
    </main>
  );
}

function BigButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group flex h-16 w-full items-center justify-between gap-3 rounded-2xl bg-card px-5 text-left text-lg font-semibold shadow-sm ring-1 ring-transparent transition-all duration-200 ease-out hover:-translate-y-0.5 hover:bg-accent hover:shadow-md hover:ring-primary/30 active:translate-y-0 active:scale-[0.98] active:bg-accent"
    >
      <span>{children}</span>
      <span aria-hidden className="-translate-x-1 text-primary opacity-0 transition-all duration-200 ease-out group-hover:translate-x-0 group-hover:opacity-100">→</span>
    </button>
  );
}

type Active = { session_id: string; user_id: string; created_at: string; vibe: string | null };

function FriendsNow({ sessionId, vibe }: { sessionId: string | null; vibe: string | null }) {
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
        .select("session_id, user_id, created_at, vibe")
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
          {[...data].sort((a, b) => Number(b.vibe === vibe) - Number(a.vibe === vibe)).map((f) => (
            <li key={f.user_id} className="rounded-3xl bg-card p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <PAvatar name={f.profile!.display_name} src={f.profile!.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{f.profile!.display_name}</p>
                  <p className="text-sm text-muted-foreground">opened Instagram {timeAgo(f.created_at, now)}</p>
                  {vibe && f.vibe === vibe && (
                    <span className="mt-1 inline-block rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-semibold text-primary">Also wants to {REASONS.find((r) => r.value === vibe)?.label.toLowerCase()}</span>
                  )}
                </div>
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

function InterestIdeas({ interests, onPick }: { interests: string[]; onPick: (i: string) => void }) {
  const [picks] = useState(() => [...interests].sort(() => Math.random() - 0.5).slice(0, 3));
  if (!interests.length) {
    return (
      <a href="/profile" className="mt-6 block rounded-2xl bg-card p-4 text-sm text-muted-foreground shadow-sm">
        Add your interests on your profile and we'll suggest them here instead of Reels →
      </a>
    );
  }
  return (
    <section className="mt-6">
      <h2 className="mb-3 text-lg font-semibold">Or on your own</h2>
      <div className="flex flex-wrap gap-2">
        {picks.map((i) => (
          <button key={i} onClick={() => onPick(i)} className="min-h-12 rounded-full bg-primary/10 px-5 py-2 font-medium text-primary transition active:scale-95 active:bg-primary/20">{i}</button>
        ))}
      </div>
    </section>
  );
}
