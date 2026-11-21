import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  dailyBudget, habits, revisionPressure, type Aim, type Exam, type Habits,
} from "@/lib/personalModel";
import {
  loadAim, loadExams, loadPersonalState, resetPersonalState, saveAim, saveExams,
} from "@/lib/personalStore";
import { examKey, examsFromIcs } from "@/lib/ics";

export const Route = createFileRoute("/_authenticated/plan")({
  head: () => ({
    meta: [
      { title: "Your plan — Pause" },
      { name: "description", content: "Your daily scroll aim, upcoming exams and what Pause has learned about your habits." },
      { property: "og:title", content: "Your plan — Pause" },
      { property: "og:description", content: "Your daily scroll aim, upcoming exams and what Pause has learned about your habits." },
    ],
  }),
  component: Plan,
});

const MIN_AIM = 10, MAX_AIM = 180;
const DEFAULT_HOURS = { 1: 6, 2: 15, 3: 30 } as const;
const IMPORTANCE: Record<Exam["importance"], string> = { 1: "Minor", 2: "Normal", 3: "Big" };
const DAY_MS = 86_400_000;

function Card({ title, children, hint }: { title: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      <div className="space-y-3 text-[15px] leading-relaxed">{children}</div>
    </section>
  );
}

function Plan() {
  const [ready, setReady] = useState(false);
  const [aim, setAim] = useState<Aim>({ dailyTargetMinutes: 60 });
  const [exams, setExams] = useState<Exam[]>([]);
  const [learned, setLearned] = useState<Habits | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Decided once on load, so the cards don't jump around while the goal is being typed.
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    const a = loadAim();
    setAim(a);
    setOnboarding(!a.goal?.trim());
    setExams(loadExams());
    setLearned(habits(loadPersonalState(), Date.now()));
    setNow(Date.now());
    setReady(true);
  }, []);

  function updateAim(next: Aim) {
    const clamped = { ...next, dailyTargetMinutes: Math.min(MAX_AIM, Math.max(MIN_AIM, Math.round(next.dailyTargetMinutes))) };
    setAim(clamped);
    saveAim(clamped);
  }
  function updateExams(next: Exam[]) {
    saveExams(next);
    setExams(loadExams()); // sorted by date
  }

  if (!ready) return <main className="px-5 pt-6" />;

  const aimCard = <AimCard aim={aim} onChange={updateAim} onboarding={onboarding} />;
  const budgetCard = <BudgetCard aim={aim} exams={exams} now={now} />;

  return (
    <main className="space-y-4 px-5 pt-6">
      <header>
        <h1 className="text-3xl font-bold">Your plan</h1>
        <p className="text-muted-foreground">Your aim, your exams, and a scroll budget that fits around them.</p>
      </header>

      {onboarding ? <>{aimCard}{budgetCard}</> : <>{budgetCard}{aimCard}</>}

      <ExamsCard exams={exams} now={now} onChange={updateExams} />

      <LearnedCard learned={learned} onReset={() => {
        resetPersonalState();
        setLearned(habits(loadPersonalState(), Date.now()));
        setNow(Date.now());
        toast("Pause has forgotten what it learned");
      }} />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* a. Aim                                                              */
/* ------------------------------------------------------------------ */

function AimCard({ aim, onChange, onboarding }: { aim: Aim; onChange: (a: Aim) => void; onboarding: boolean }) {
  const m = aim.dailyTargetMinutes;
  return (
    <section className={`rounded-3xl p-5 shadow-sm ${onboarding ? "bg-accent" : "bg-card"}`}>
      <h2 className="text-xl font-semibold">{onboarding ? "Set your aim to start" : "Your aim"}</h2>
      {onboarding && (
        <p className="mt-1 text-sm text-accent-foreground/80">
          What are you working towards, and how much scrolling a day feels right? Pause builds everything else around this.
        </p>
      )}
      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Daily scroll target</p>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-2xl" aria-label="5 minutes less"
              disabled={m <= MIN_AIM} onClick={() => onChange({ ...aim, dailyTargetMinutes: m - 5 })}>
              <Minus className="h-5 w-5" />
            </Button>
            <div className="flex-1 text-center">
              <span className="text-4xl font-bold">{m}</span>
              <span className="ml-1 text-muted-foreground">min / day</span>
            </div>
            <Button variant="outline" size="icon" className="h-12 w-12 shrink-0 rounded-2xl" aria-label="5 minutes more"
              disabled={m >= MAX_AIM} onClick={() => onChange({ ...aim, dailyTargetMinutes: m + 5 })}>
              <Plus className="h-5 w-5" />
            </Button>
          </div>
          <Slider className="mt-4 py-2" min={MIN_AIM} max={MAX_AIM} step={5} value={[m]}
            onValueChange={([v]) => v !== undefined && onChange({ ...aim, dailyTargetMinutes: v })} aria-label="Daily scroll target" />
        </div>
        <div>
          <label htmlFor="aim-goal" className="mb-2 block text-sm font-medium text-muted-foreground">Your goal (optional)</label>
          <Input id="aim-goal" className="h-12 rounded-2xl bg-background text-base" placeholder="Do well in my first-year exams"
            value={aim.goal ?? ""} maxLength={120}
            onChange={(e) => onChange({ ...aim, goal: e.target.value || undefined })} />
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* b. Exams                                                            */
/* ------------------------------------------------------------------ */

function daysUntil(date: string, now: number) {
  return Math.ceil((new Date(date).getTime() - now) / DAY_MS);
}
function whenLabel(days: number) {
  if (days < 0) return "done";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function ExamsCard({ exams, now, onChange }: { exams: Exam[]; now: number; onChange: (e: Exam[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [importance, setImportance] = useState<Exam["importance"]>(2);
  const [hours, setHours] = useState("");

  function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) { toast.error("Add a title and a date"); return; }
    const h = hours.trim() === "" ? undefined : Math.max(0, Number(hours));
    const exam: Exam = { id: crypto.randomUUID(), title: title.trim(), date, importance, revisionHoursLeft: h ?? DEFAULT_HOURS[importance] };
    if (exams.some((x) => examKey(x) === examKey(exam))) { toast("That exam is already on your list"); return; }
    onChange([...exams, exam]);
    setTitle(""); setDate(""); setHours(""); setImportance(2);
    toast.success("Exam added");
  }

  async function importIcs(file: File) {
    try {
      const added = examsFromIcs(await file.text(), exams);
      if (added.length) onChange([...exams, ...added]);
      toast(added.length ? `Added ${added.length} exam${added.length === 1 ? "" : "s"} from your calendar` : "No new exams found in that file");
    } catch {
      toast.error("Couldn't read that calendar file");
    }
  }

  const upcoming = exams.filter((e) => daysUntil(e.date, now) >= 0);
  const past = exams.filter((e) => daysUntil(e.date, now) < 0);

  return (
    <Card title="Exams coming up" hint="The closer an exam and the more revision left, the smaller your scroll budget.">
      {upcoming.length === 0 && <p className="text-muted-foreground">No exams yet. Add one below or import your calendar.</p>}
      <ul className="space-y-3">
        {[...upcoming, ...past].map((e) => {
          const d = daysUntil(e.date, now);
          return (
            <li key={e.id} className={`rounded-2xl bg-muted p-4 ${d < 0 ? "opacity-60" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{e.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {new Date(e.date).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    {" · "}<span className={d >= 0 && d <= 3 ? "font-semibold text-primary" : ""}>{whenLabel(d)}</span>
                  </p>
                  <span className="mt-1 inline-block rounded-full bg-background px-2 py-0.5 text-xs font-medium">{IMPORTANCE[e.importance]}</span>
                </div>
                <button aria-label={`Delete ${e.title}`} onClick={() => onChange(exams.filter((x) => x.id !== e.id))}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground active:bg-accent">
                  <Trash2 className="h-5 w-5" />
                </button>
              </div>
              {d >= 0 && (
                <div className="mt-3 flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Revision left</span>
                  <RevisionHours value={e.revisionHoursLeft ?? DEFAULT_HOURS[e.importance]}
                    onChange={(v) => onChange(exams.map((x) => (x.id === e.id ? { ...x, revisionHoursLeft: v } : x)))} />
                  <span className="text-sm text-muted-foreground">h</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form onSubmit={add} className="space-y-3 rounded-2xl border p-4">
        <p className="font-semibold">Add an exam</p>
        <Input className="h-12 rounded-2xl text-base" placeholder="e.g. Linear Algebra" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Exam title" />
        <Input type="datetime-local" className="h-12 rounded-2xl text-base" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Exam date and time" />
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Importance">
          {([1, 2, 3] as const).map((i) => (
            <button type="button" key={i} role="radio" aria-checked={importance === i} onClick={() => setImportance(i)}
              className={`h-12 rounded-2xl text-sm font-semibold ${importance === i ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {IMPORTANCE[i]}
            </button>
          ))}
        </div>
        <Input type="number" inputMode="decimal" min={0} className="h-12 rounded-2xl text-base" value={hours} onChange={(e) => setHours(e.target.value)}
          placeholder={`Revision hours needed (default ${DEFAULT_HOURS[importance]})`} aria-label="Revision hours needed" />
        <Button type="submit" className="h-12 w-full rounded-2xl text-base">Add exam</Button>
      </form>

      {/* TODO: live Google Calendar sync, see docs/upcoming-commitments-spec.md. Until then, import an .ics export. */}
      <div className="rounded-2xl bg-muted p-4">
        <input ref={fileRef} type="file" accept=".ics,text/calendar" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void importIcs(f); e.target.value = ""; }} />
        <Button variant="outline" className="h-12 w-full rounded-2xl bg-background text-base" onClick={() => fileRef.current?.click()}>
          <CalendarPlus className="mr-2 h-5 w-5" />Import from calendar (.ics)
        </Button>
        <p className="mt-2 text-sm text-muted-foreground">
          Picks out anything called exam, test, quiz, midterm, final or assessment. Google Calendar can export an .ics file from
          {" "}<b>Settings → Import &amp; export</b>. Live Google Calendar sync is coming soon.
        </p>
      </div>
    </Card>
  );
}

function RevisionHours({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const n = Number(text);
    if (text.trim() === "" || Number.isNaN(n) || n < 0) { setText(String(value)); return; }
    if (n !== value) onChange(n);
  };
  return (
    <div className="flex items-center gap-1">
      <button type="button" aria-label="One hour less" onClick={() => onChange(Math.max(0, value - 1))}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-background active:bg-accent"><Minus className="h-4 w-4" /></button>
      <Input type="number" inputMode="decimal" min={0} className="h-10 w-16 rounded-xl bg-background text-center text-base"
        value={text} onChange={(e) => setText(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} aria-label="Revision hours left" />
      <button type="button" aria-label="One hour more" onClick={() => onChange(value + 1)}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-background active:bg-accent"><Plus className="h-4 w-4" /></button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* c. Today's budget                                                   */
/* ------------------------------------------------------------------ */

function BudgetCard({ aim, exams, now }: { aim: Aim; exams: Exam[]; now: number }) {
  const budget = Math.round(dailyBudget(aim, exams, now));
  const pressure = revisionPressure(exams, now);
  const start = new Date(now); start.setHours(12, 0, 0, 0);
  const week = Array.from({ length: 7 }, (_, i) => {
    const at = i === 0 ? now : start.getTime() + i * DAY_MS;
    return {
      label: i === 0 ? "Today" : new Date(at).toLocaleDateString(undefined, { weekday: "short" }),
      minutes: Math.round(dailyBudget(aim, exams, at)),
    };
  });
  const max = Math.max(1, aim.dailyTargetMinutes, ...week.map((d) => d.minutes));

  return (
    <section className="rounded-3xl bg-card p-5 shadow-sm">
      <h2 className="text-xl font-semibold">Today's budget</h2>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-primary p-4 text-primary-foreground">
          <p className="text-4xl font-bold">{budget}<span className="ml-1 text-base font-medium opacity-90">min</span></p>
          <p className="mt-1 text-xs opacity-90">to scroll today</p>
        </div>
        <div className="rounded-3xl bg-muted p-4">
          <p className="text-4xl font-bold">{pressure.dailyHours.toFixed(1)}<span className="ml-1 text-base font-medium text-muted-foreground">h</span></p>
          <p className="mt-1 text-xs text-muted-foreground">revision a day{pressure.next ? ` · ${pressure.next.title} ${whenLabel(pressure.next.days)}` : ""}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        Your scroll budget shrinks as revision piles up: aim ÷ (1 + 0.5 × revision hours per day)
      </p>
      <div className="mt-4 flex h-28 items-end gap-2" aria-label="Scroll budget for the next 7 days">
        {week.map((d, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs text-muted-foreground">{d.minutes}</span>
            <div className={`w-full rounded-lg ${i === 0 ? "bg-primary" : "bg-primary/50"}`} style={{ height: `${(d.minutes / max) * 64 + 4}px` }} />
            <span className="text-[11px] text-muted-foreground">{d.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* d. What Pause has learned                                           */
/* ------------------------------------------------------------------ */

function hourLabel(h: number) {
  return new Date(2000, 0, 1, h).toLocaleTimeString(undefined, { hour: "numeric" });
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}

function LearnedCard({ learned, onReset }: { learned: Habits | null; onReset: () => void }) {
  if (!learned) return null;
  const learning = <span className="font-normal text-muted-foreground">learning… needs 3 days</span>;
  return (
    <Card title="What Pause has learned about you" hint="This stays on your phone.">
      <div className="divide-y">
        <Fact label="Days observed" value={learned.daysObserved} />
        <Fact label="Usual wake-up" value={learned.usualWake ?? learning} />
        <Fact label="Usual bedtime" value={learned.usualBedtime ?? learning} />
        <Fact label="When you scroll most" value={learned.peakHours.length ? learned.peakHours.map(hourLabel).join(", ") : <span className="font-normal text-muted-foreground">not enough yet</span>} />
        <Fact label="Times Pause checked how long you scrolled" value={learned.overrunSamples} />
      </div>
      <div>
        <p className="mb-2 font-medium">Places you go a lot</p>
        {learned.frequentPlaces.length === 0 ? (
          <p className="text-sm text-muted-foreground">None yet. Places show up after about 3 visits.</p>
        ) : (
          <ul className="space-y-2">
            {learned.frequentPlaces.map((p, i) => (
              <li key={i} className="flex items-center justify-between rounded-2xl bg-muted px-4 py-3">
                <span className="font-medium capitalize">{p.label}</span>
                <span className="text-sm text-muted-foreground">{p.visits} visits</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button variant="outline" className="h-12 w-full rounded-2xl" onClick={() => {
        if (window.confirm("Forget your sleep times, places and habits? Your aim and exams stay.")) onReset();
      }}>
        Reset what Pause learned
      </Button>
    </Card>
  );
}
