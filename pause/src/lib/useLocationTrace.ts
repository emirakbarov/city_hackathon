import { useEffect, useMemo, useState } from "react";
import { speedsFromPositions, type Position, type TraceSample } from "@/lib/scrollModel";
import { nearBusStop, nearGym, type PlaceIndex } from "@/lib/places";

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
 * atBusStop / nearGym come from real NaPTAN bus stops and OSM gyms (places index), matched
 * on-device so no location leaves the phone. Without the index they stay undefined and bus
 * detection leans on the stop-and-go pattern only.
 */
export function useLocationTrace(enabled = true, places?: PlaceIndex | null): {
  trace: TraceSample[]; status: LocationStatus; samples: number; last: Position | null;
} {
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

  const trace = useMemo(() => {
    const samples = speedsFromPositions(positions);
    if (!places || !positions.length) return samples;
    const t0 = positions[0]!.timestamp;
    // tag each resampled point using the raw fix closest in time
    return samples.map((s) => {
      let near = positions[0]!;
      for (const p of positions) if (Math.abs((p.timestamp - t0) / 1000 - s.t) < Math.abs((near.timestamp - t0) / 1000 - s.t)) near = p;
      return { ...s, atBusStop: nearBusStop(near.lat, near.lon, places) ?? false, nearGym: nearGym(near.lat, near.lon, places) ?? false };
    });
  }, [positions, places]);
  return { trace, status, samples: positions.length, last: positions.at(-1) ?? null };
}
