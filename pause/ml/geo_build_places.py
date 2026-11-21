"""Merge the downloaded OSM / NaPTAN files in geo/ into one compact places index for the app.

Input: geo/*.json, each a list of [lat, lon] or [lat, lon, name] (optionally a dict with a "radius_m").
The place type comes from the file name. Output: places-london.json (see src/lib/places.ts).

Usage: python3 geo_build_places.py [out_path]
"""
import glob
import json
import os
import sys

TYPE_KEYWORDS = [  # first match wins
    ("busStops", ["bus_stop", "busstop", "naptan"]),
    ("gym", ["gym", "fitness", "sports_centre", "sport"]),
    ("home", ["hall", "dorm", "student_accom", "residential", "accommodation"]),
    ("study", ["univ", "college", "librar", "office", "study", "school"]),
    ("food", ["cafe", "café", "restaurant", "pub", "bar", "food", "fast"]),
    ("park", ["park", "garden"]),
]
RADIUS_M = {"study": 60, "home": 50, "food": 25, "park": 100, "gym": 40}


# per-item OSM type -> app place type (for files like places_city.json with a "type" field)
ITEM_TYPE = {
    "university": "study", "college": "study", "library": "study", "office": "study", "school": "study",
    "student_halls": "home", "dormitory": "home", "halls": "home",
    "pub": "food", "bar": "food", "cafe": "food", "restaurant": "food", "fast_food": "food", "food": "food",
    "park": "park", "garden": "park",
    "gym": "gym", "fitness_centre": "gym", "sports_centre": "gym",
}


def type_for(fname):
    f = fname.lower()
    for t, keys in TYPE_KEYWORDS:
        if any(k in f for k in keys):
            return t
    return None


def entry(item, t):
    if isinstance(item, dict):
        lat, lon = item.get("lat"), item.get("lon")
        name, r = item.get("name") or "", item.get("radius_m") or RADIUS_M[t]
    else:
        lat, lon = item[0], item[1]
        name = item[2] if len(item) > 2 and isinstance(item[2], str) else ""
        r = RADIUS_M[t]
    return [round(float(lat), 5), round(float(lon), 5), name, int(r)]


def main(out):
    idx = {"version": "osm-naptan-1", "area": "London",
           "study": [], "home": [], "food": [], "park": [], "gym": [], "busStops": []}
    for path in sorted(glob.glob(os.path.join(os.path.dirname(__file__), "geo", "*.json"))):
        t = type_for(os.path.basename(path))
        data = json.load(open(path))
        if isinstance(data, dict):  # {type: [...]} bundles
            for k, v in data.items():
                kt = type_for(k)
                if kt:
                    for it in v:
                        idx[kt].append(entry(it, kt) if kt != "busStops" else [round(it[0], 5), round(it[1], 5)])
            continue
        if isinstance(data, list) and data and isinstance(data[0], dict) and "type" in data[0]:
            n = 0
            for it in data:
                kt = ITEM_TYPE.get(str(it["type"]).lower())
                if kt:
                    idx[kt].append(entry(it, kt)); n += 1
            print(f"{os.path.basename(path)} -> by item type: {n} of {len(data)}")
            continue
        if not t:
            print("skipping (unknown type):", path)
            continue
        for it in data:
            if t == "busStops":
                idx[t].append([round(float(it[0]), 5), round(float(it[1]), 5)])
            else:
                idx[t].append(entry(it, t))
        print(f"{os.path.basename(path)} -> {t}: {len(data)}")
    json.dump(idx, open(out, "w"), separators=(",", ":"), ensure_ascii=False)
    print({k: len(v) for k, v in idx.items() if isinstance(v, list)}, "->", out)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "places-london.json")
