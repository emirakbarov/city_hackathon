import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/me";
import { reasonLabel } from "@/lib/pause";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Home — Pause" },
      { name: "description", content: "Your Instagram opens, social wins and recent check-ins." },
      { property: "og:title", content: "Home — Pause" },
      { property: "og:description", content: "Your Instagram opens, social wins and recent check-ins." },
    ],
  }),
  component: Dashboard,
});

type S = { id: string; created_at: string; outcome: string; reason: string | null };

function Dashboard() {
  const me = useMe();
  const { data } = useQuery({
    queryKey: ["dashboard", me.id],
    queryFn: async () => {
      const weekAgo = new Date(); weekAgo.setHours(0, 0, 0, 0); weekAgo.setDate(weekAgo.getDate() - 6);
      const [{ data: sessions }, { count }] = await Promise.all([
        supabase.from("sessions").select("id, created_at, outcome, reason").eq("user_id", me.id)
          .gte("created_at", weekAgo.toISOString()).order("created_at", { ascending: false }),
        supabase.from("nudges").select("id", { count: "exact", head: true }).eq("status", "accepted")
          .gte("created_at", weekAgo.toISOString()),
      ]);
      return { sessions: (sessions ?? []) as S[], wins: count ?? 0, weekAgo };
    },
  });

  const sessions = data?.sessions ?? [];
  const todayKey = new Date().toDateString();
  const today = sessions.filter((s) => new Date(s.created_at).toDateString() === todayKey);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(data?.weekAgo ?? Date.now()); d.setDate(d.getDate() + i);
    return { label: d.toLocaleDateString(undefined, { weekday: "narrow" }), n: sessions.filter((s) => new Date(s.created_at).toDateString() === d.toDateString()).length };
  });
  const max = Math.max(1, ...days.map((d) => d.n));

  return (
    <main className="space-y-5 px-5 pt-6">
      <header>
        <p className="text-muted-foreground">Hey {me.display_name.split(" ")[0]}</p>
        <h1 className="text-3xl font-bold">Your pauses</h1>
      </header>

      <section className="grid grid-cols-3 gap-3">
        <Stat label="Opens today" value={today.length} />
        <Stat label="Did something else" value={today.filter((s) => s.outcome === "redirected").length} accent />
        <Stat label="Scrolled anyway" value={today.filter((s) => s.outcome === "continued").length} />
      </section>

      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Last 7 days</h2>
          <span className="text-sm text-muted-foreground">{sessions.length} opens</span>
        </div>
        <div className="flex h-32 items-end gap-2">
          {days.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-xs text-muted-foreground">{d.n || ""}</span>
              <div className="w-full rounded-lg bg-primary/80" style={{ height: `${(d.n / max) * 88 + 4}px`, opacity: d.n ? 1 : 0.2 }} />
              <span className="text-xs text-muted-foreground">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="flex items-center gap-4 rounded-3xl bg-accent p-5">
        <span className="text-4xl">🤝</span>
        <div>
          <p className="text-3xl font-bold text-accent-foreground">{data?.wins ?? 0}</p>
          <p className="text-sm text-accent-foreground/80">Social wins this week</p>
        </div>
      </section>

      <section className="rounded-3xl bg-card p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Recent</h2>
        {sessions.length === 0 ? (
          <p className="text-muted-foreground">
            No opens logged yet. <Link to="/setup" className="font-semibold text-primary">Set up the iPhone shortcut</Link> or{" "}
            <Link to="/intercept" search={{ app: "instagram" }} className="font-semibold text-primary">try a check-in</Link>.
          </p>
        ) : (
          <ul className="divide-y">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="font-medium">{reasonLabel(s.reason)}</p>
                  <p className="text-sm text-muted-foreground">{new Date(s.created_at).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}</p>
                </div>
                <OutcomeBadge outcome={s.outcome} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-3xl p-4 ${accent ? "bg-primary text-primary-foreground" : "bg-card shadow-sm"}`}>
      <p className="text-3xl font-bold">{value}</p>
      <p className={`mt-1 text-xs leading-tight ${accent ? "opacity-90" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const map: Record<string, [string, string]> = {
    redirected: ["Did something else", "bg-success/15 text-success"],
    continued: ["Scrolled", "bg-muted text-muted-foreground"],
    pending: ["Unfinished", "bg-secondary text-secondary-foreground"],
    cancelled: ["Cancelled", "bg-muted text-muted-foreground"],
  };
  const [label, cls] = map[outcome] ?? [outcome, "bg-muted"];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>{label}</span>;
}
