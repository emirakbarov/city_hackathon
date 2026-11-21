import type { PlaceType } from "@/lib/scrollModel";

/**
 * Real-world places from OpenStreetMap (+ NaPTAN bus stops), matched on-device so no
 * location ever leaves the phone. Built by pause/ml/geo/build_places.py.
 *
 * Each entry is [lat, lon, name, radiusMetres].
 */
export type PlaceEntry = [number, number, string, number];
export type PlaceIndex = {
  version: string;
  area: string;
  study: PlaceEntry[]; // uni buildings, libraries, offices
  home: PlaceEntry[];  // student halls
  food: PlaceEntry[];  // cafés, pubs, restaurants
  park: PlaceEntry[];
  gym: PlaceEntry[];
  busStops: [number, number][];
};

export type PlaceMatch = { type: PlaceType; name: string | null; distanceM: number | null };

const BUS_STOP_M = 25;
// Priority when places overlap (a café inside a uni building counts as uni).
const ORDER: Exclude<PlaceType, "unknown">[] = ["gym", "study", "home", "food", "park"];

/** Fast equirectangular distance in metres; plenty accurate at city scale. */
export function distanceM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = ((lon2 - lon1) * Math.PI / 180) * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180);
  const y = (lat2 - lat1) * Math.PI / 180;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

/** Which kind of place is (lat, lon) inside? Picks the highest-priority match within each place's radius. */
export function matchPlace(lat: number, lon: number, idx: PlaceIndex | null | undefined): PlaceMatch {
  if (!idx) return { type: "unknown", name: null, distanceM: null };
  for (const type of ORDER) {
    let best: PlaceEntry | null = null;
    let bestD = Infinity;
    for (const p of idx[type]) {
      const d = distanceM(lat, lon, p[0], p[1]);
      if (d <= p[3] && d < bestD) { best = p; bestD = d; }
    }
    if (best) return { type, name: best[2] || null, distanceM: Math.round(bestD) };
  }
  return { type: "unknown", name: null, distanceM: null };
}

export function nearBusStop(lat: number, lon: number, idx: PlaceIndex | null | undefined) {
  if (!idx) return undefined;
  for (const s of idx.busStops) if (distanceM(lat, lon, s[0], s[1]) <= BUS_STOP_M) return true;
  return false;
}

export function nearGym(lat: number, lon: number, idx: PlaceIndex | null | undefined) {
  if (!idx) return undefined;
  return idx.gym.some((g) => distanceM(lat, lon, g[0], g[1]) <= g[3]);
}
