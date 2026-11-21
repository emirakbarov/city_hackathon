import { useEffect, useRef, useState } from "react";

export const MAX_MIN = 45;
export const SOFT_MIN = 30;

/** How fast minutes grow per dragged pixel: easy at first, gently slowing to 30, then one steady hard pace to 45. */
function falloff(m: number) {
  if (m <= SOFT_MIN) return 1.4 - 0.8 * (m / SOFT_MIN);
  return 0.4;
}

/** Drag `deltaPx` on a track `trackWidth` wide starting at `current` minutes. Keeps fractions. */
export function dragMinutes(current: number, deltaPx: number, trackWidth: number) {
  const k = (SOFT_MIN * 0.8) / Math.max(1, trackWidth); // ~1 full-width drag to reach 30 min
  const step = deltaPx > 0 ? 1 : -1;
  const n = Math.min(4000, Math.abs(Math.round(deltaPx)));
  let m = Math.max(1, Math.min(MAX_MIN, current));
  for (let i = 0; i < n; i++) {
    m += step * k * (step > 0 ? falloff(m) : 1);
    m = Math.max(1, Math.min(MAX_MIN, m));
  }
  return m;
}

/** Same drag, rounded to the minute the user sees. */
export function nextMinutes(current: number, deltaPx: number, trackWidth: number) {
  return Math.round(dragMinutes(current, deltaPx, trackWidth));
}

export function LimitSlider({ onChange, suggested }: { onChange: (m: number) => void; suggested?: number | null }) {
  const [raw, setRaw] = useState(suggested ?? 15);
  const moved = useRef(false);
  // Start at the model's suggestion until the user moves the thumb.
  useEffect(() => { if (suggested != null && !moved.current) setRaw(suggested); }, [suggested]);
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<number | null>(null);
  const m = Math.max(1, Math.min(MAX_MIN, Math.round(raw)));
  const pct = (m / MAX_MIN) * 100;
  const hard = m > SOFT_MIN;

  useEffect(() => onChange(m), [m, onChange]);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = trackRef.current;
      if (!el || drag.current === null) return;
      const from = drag.current;
      drag.current = e.clientX;
      moved.current = true;
      setRaw((prev) => dragMinutes(prev, e.clientX - from, el.getBoundingClientRect().width));
    };
    const up = () => { drag.current = null; };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, []);

  const nudge = (delta: number) => {
    moved.current = true;
    setRaw((prev) => Math.max(1, Math.min(MAX_MIN, Math.round(prev) + delta)));
  };

  return (
    <div className="select-none">
      <p className={`mb-4 text-center font-display text-6xl font-bold tabular-nums ${hard ? "text-primary" : ""}`}>
        {m}
        <span className="ml-1 text-xl font-semibold text-muted-foreground">min</span>
      </p>

      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Scroll limit in minutes"
        aria-valuemin={1}
        aria-valuemax={MAX_MIN}
        aria-valuenow={m}
        aria-valuetext={`${m} minutes`}
        className="relative h-16 w-full touch-none rounded-full bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onPointerDown={(e) => { drag.current = e.clientX; }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); nudge(1); }
          if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); nudge(-1); }
        }}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${hard ? "bg-primary/30" : "bg-primary/20"}`}
          style={{ width: `${pct}%` }}
        />
        {[15, 30].map((t) => (
          <div key={t} className="absolute top-1/2 h-6 w-px -translate-y-1/2 bg-border" style={{ left: `${(t / MAX_MIN) * 100}%` }} />
        ))}
        <div
          className={`absolute top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full shadow-md transition-colors ${hard ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}
          style={{ left: `calc(${pct}% * 0.86 + 7%)` }}
        >
          <span className="text-lg font-bold tabular-nums">{m}</span>
        </div>
      </div>

      <div className="mt-2 flex justify-between px-1 text-xs text-muted-foreground">
        <span>0</span>
        <span>15</span>
        <span>30</span>
        <span>45</span>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">
        {hard ? "Getting harder… really?" : "Slide right for more minutes"}
      </p>
    </div>
  );
}
