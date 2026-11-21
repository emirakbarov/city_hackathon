import { createFileRoute, Link } from "@tanstack/react-router";
import { TimerOff, ArrowRight, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/me";
import { CANCEL_LIMIT_URL, timerMinutes } from "@/lib/scrollTimer";

export const Route = createFileRoute("/_authenticated/times-up")({
  validateSearch: (s: Record<string, unknown>): { minutes?: number } => {
    const minutes = timerMinutes(s["minutes"]);
    return minutes === undefined ? {} : { minutes };
  },
  head: () => ({
    meta: [
      { title: "Time’s up — Pause" },
      { name: "description", content: "Your chosen Instagram time is over. Make room for something else." },
      { property: "og:title", content: "Time’s up — Pause" },
      { property: "og:description", content: "Your chosen Instagram time is over. Make room for something else." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimesUp,
});

function TimesUp() {
  const { minutes } = Route.useSearch();
  const me = useMe();
  return (
    <main className="flex min-h-[85dvh] flex-col px-5 pb-6 pt-12">
      <div className="mb-8 flex items-center gap-2 text-lg font-semibold text-primary"><TimerOff className="h-6 w-6" /> Pause</div>
      <h1 className="text-4xl font-bold leading-tight">Time’s up.</h1>
      <p className="mt-4 text-lg text-muted-foreground">{minutes ? `Your ${minutes} minutes on Instagram are over.` : "Your chosen time on Instagram is over."}</p>
      <p className="mt-2 text-muted-foreground">You gave yourself a limit. Take a little space from the scroll.</p>
      {!!me.interests?.length && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Make time for you</h2>
          <div className="flex flex-wrap gap-2">
            {me.interests.slice(0, 3).map((interest) => <Button key={interest} asChild variant="secondary" className="min-h-12 rounded-2xl"><Link to="/">{interest}<ArrowRight /></Link></Button>)}
          </div>
        </section>
      )}
      <div className="mt-auto space-y-3 pt-10">
        <Button asChild className="h-14 w-full rounded-2xl text-lg"><Link to="/">Do something else<ArrowRight /></Link></Button>
        <Button asChild variant="secondary" className="h-14 w-full rounded-2xl"><Link to="/friends"><Users />See your friends</Link></Button>
        <Button asChild variant="ghost" className="min-h-11 w-full text-sm underline underline-offset-4"><a href={CANCEL_LIMIT_URL}>Cancel limit and open Instagram</a></Button>
      </div>
    </main>
  );
}