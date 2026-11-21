import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import modelUrl from "@/lib/scroll-model.json?url";
import placesUrl from "@/lib/places-london.json?url";
import { matchPlace, type PlaceIndex } from "@/lib/places";
import { useMe } from "@/lib/me";
import { recommendScrollMinutes, type ContextClass, type ScrollModel } from "@/lib/scrollModel";
import { DEMO_SCENARIOS, buildScrollContext, demoScenario, loadScrollSettings, minutesScrolledToday } from "@/lib/scrollContext";
import { useLocationTrace } from "@/lib/useLocationTrace";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

const CONTEXT_META: Record<ContextClass, { emoji: string; label: string }> = {
  stationary: { emoji: "🪑", label: "Sat still" },
  gym: { emoji: "🏋️", label: "At the gym" },
  walking: { emoji: "🚶", label: "Walking" },
  cycling: { emoji: "🚲", label: "Cycling" },
  bus: { emoji: "🚌", label: "On the bus" },
  car: { emoji: "🚗", label: "In a car" },
};

// Logarithmic slider: 1–120 min, finer control at the low end.
const MIN = 1, MAX = 120, STEPS = 1000;
const toMinutes = (v: number) => Math.round(Math.exp((v / STEPS) * Math.log(MAX / MIN)) * MIN);
const toSlider = (m: number) => Math.round((Math.log(Math.max(MIN, Math.min(MAX, m)) / MIN) / Math.log(MAX / MIN)) * STEPS);

/** Fetched as a static asset so the ~750 KB forest stays out of the JS bundle. */
async function loadModel(): Promise<ScrollModel> {
  const res = await fetch(modelUrl);
  if (!res.ok) throw new Error("model fetch failed");
  return (await res.json()) as ScrollModel;
}

/** Real places (OSM + NaPTAN), also a static asset; if it fails we just don't know the place type. */
async function loadPlaces(): Promise<PlaceIndex | null> {
  try {
    const res = await fetch(placesUrl);
    return res.ok ? ((await res.json()) as PlaceIndex) : null;
  } catch {
    return null;
  }
}

const PLACE_LABEL: Record<string, string> = { study: "uni / library", home: "home", food: "café / pub", park: "park", gym: "gym" };

export function ScrollRecommendation({
  mood, demo, showDemo, onDemoChange, minutes, onMinutes, onNext,
}: {
  mood: number;
  demo: string | undefined;
  showDemo: boolean;
  onDemoChange: (id: string | undefined) => void;
  minutes: number | null;
  onMinutes: (m: number) => void;
  onNext: () => void;
}) {
  const me = useMe();
  const scenario = demoScenario(demo);
  const { data: places } = useQuery({ queryKey: ["places"], queryFn: loadPlaces, staleTime: Infinity });
  const live = useLocationTrace(!scenario, places);
  const place = useMemo(
    () => (live.last ? matchPlace(live.last.lat, live.last.lon, places) : { type: "unknown" as const, name: null, distanceM: null }),
    [live.last, places],
  );
  const [touched, setTouched] = useState(false);

  const { data: model, isError } = useQuery({ queryKey: ["scroll-model"], queryFn: loadModel, staleTime: Infinity });
  const { data: scrolled } = useQuery({ queryKey: ["scrolled-today", me.id], queryFn: () => minutesScrolledToday(me.id) });

  const rec = useMemo(() => {
    if (!model) return null;
    const ctx = { ...buildScrollContext(loadScrollSettings(), scrolled ?? 0, mood, new Date(), place.type), ...scenario?.ctx };
    return recommendScrollMinutes(scenario?.trace ?? live.trace, ctx, model);
  }, [model, scrolled, mood, scenario, live.trace, place.type]);

  const placeLine = scenario
    ? scenario.placeName ?? null
    : place.type !== "unknown" ? (place.name ?? PLACE_LABEL[place.type] ?? null) : null;

  // Pre-set the slider to the recommendation until the user moves it; a new scenario resets that.
  useEffect(() => { setTouched(false); }, [demo]);
  useEffect(() => {
    if (rec && !touched) onMinutes(Math.max(MIN, rec.minutes));
  }, [rec, touched, onMinutes]);

  const meta = rec ? CONTEXT_META[rec.context] : null;
  const locationNote = scenario ? `Demo: ${scenario.label}`
    : live.status === "denied" ? "Location is off, so this is a guess from your check-in"
    : live.status === "unavailable" ? "Couldn't get your location, so this is a guess"
    : live.samples < 6 ? "Still reading your movement…"
    : null;

  return (
    <section className="animate-in fade-in slide-in-from-right-4">
      <h1 className="mb-6 text-3xl font-bold leading-tight">Recommended scroll time</h1>

      {showDemo && (
        <div className="mb-4 flex flex-wrap gap-2">
          <DemoChip active={!scenario} onClick={() => onDemoChange(undefined)}>📍 Live</DemoChip>
          {DEMO_SCENARIOS.map((d) => (
            <DemoChip key={d.id} active={scenario?.id === d.id} onClick={() => onDemoChange(d.id)}>{d.emoji} {d.label}</DemoChip>
          ))}
        </div>
      )}

      {isError ? (
        <div className="rounded-3xl bg-card p-6 text-center shadow-sm">
          <p className="font-semibold">Couldn't load the recommender</p>
          <p className="mt-1 text-sm text-muted-foreground">Pick a time yourself below.</p>
        </div>
      ) : !rec || !meta ? (
        <div className="h-48 animate-pulse rounded-3xl bg-muted" />
      ) : (
        <div className="rounded-3xl bg-card p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-semibold">
              <span className="text-lg">{meta.emoji}</span>{meta.label}
            </span>
            <span className="text-sm text-muted-foreground">{Math.round(rec.confidence * 100)}% sure</span>
          </div>
          <p className="mt-5 text-center">
            <span className="text-7xl font-bold tabular-nums">{rec.minutes}</span>
            <span className="ml-1 text-2xl font-semibold text-muted-foreground">min</span>
          </p>
          <p className="mt-3 text-center text-lg">{rec.reason}</p>
          {placeLine && <p className="mt-2 text-center text-sm text-muted-foreground">📍 {placeLine}</p>}
          {locationNote && <p className="mt-2 text-center text-xs text-muted-foreground">{locationNote}</p>}
        </div>
      )}

      <div className="mt-5 rounded-3xl bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-baseline justify-between">
          <span className="font-semibold">Your pick</span>
          <span className="text-2xl font-bold tabular-nums">{minutes ?? MIN} min</span>
        </div>
        <Slider
          min={0} max={STEPS} step={1}
          value={[toSlider(minutes ?? MIN)]}
          onValueChange={([v]) => { setTouched(true); onMinutes(toMinutes(v ?? 0)); }}
          aria-label="Scroll minutes"
        />
        <div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>1 min</span><span>2 h</span></div>
      </div>

      <Button variant="secondary" className="mt-4 h-12 w-full rounded-2xl" onClick={onNext}>See who's free</Button>
    </section>
  );
}

function DemoChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${active ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
      {children}
    </button>
  );
}
