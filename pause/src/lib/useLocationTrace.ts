import { useEffect, useMemo, useState } from "react";
import { speedsFromPositions, type Position, type TraceSample } from "@/lib/scrollModel";

export type LocationStatus = "pending" | "ok" | "denied" | "unavailable";

const BUFFER_MS = 150_000; // ~2.5 min, what the model was trained on
const STORE_KEY = "pause_location_trace";

function load(): Position[] {
  try {
    const raw = sessionStorage.getItem(STORE_KEY);
    return raw ? (JSON.parse(raw) as Position[]) : [];
  } catch {
    return [];
  }
}

function save(ps: Position[]) {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(ps)); } catch { /* private mode / quota: ignore */ }
}

const recent = (ps: Position[], now = Date.now()) => ps.filter((p) => now - p.timestamp <= BUFFER_MS);

/**
 * Rolling ~2.5 min GPS buffer -> speed trace for the scroll model.
 * Persisted to sessionStorage so a reload (or bouncing back from the Shortcut) keeps the history.
 *
 * TODO(map data): atBusStop / nearGym are left undefined, which makes bus detection lean on the
 * stop-and-go pattern only. Fill them by matching each position against:
 *   - NaPTAN bus stops (https://naptan.api.dft.gov.uk, e.g. within ~25 m of a stop), and
 *   - gym POIs (OSM leisure=fitness_centre via Overpass), e.g. within ~40 m.
 * Ideally pre-fetch a small tile around the user and match on-device so no location leaves the phone.
 */
export function useLocationTrace(enabled = true): { trace: TraceSample[]; status: LocationStatus; samples: number } {
  const [positions, setPositions] = useState<Position[]>([]);
  const [status, setStatus] = useState<LocationStatus>("pending");

  useEffect(() => {
    if (!enabled) return;
    setPositions(recent(load()));
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setStatus("ok");
        setPositions((prev) => {
          const next = recent([...prev, { lat: p.coords.latitude, lon: p.coords.longitude, timestamp: p.timestamp, speed: p.coords.speed }]);
          save(next);
          return next;
        });
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  const trace = useMemo(() => speedsFromPositions(positions), [positions]);
  return { trace, status, samples: positions.length };
}
