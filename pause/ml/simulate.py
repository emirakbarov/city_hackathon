"""Simulate GPS speed traces and student contexts for Pause's quick scroll-time model.

Each scenario = a ~2.5 minute location trace (one sample every 5 s) plus the
student's context. Labels come from the rules in rules.py, with noise so the
model has to generalise rather than copy a lookup table.
"""
import json
import numpy as np

from features import trace_features, FEATURE_NAMES
from rules import recommend_minutes

MODES = ["stationary", "gym", "walking", "cycling", "bus", "car"]
DT = 5          # seconds between GPS samples
N_SAMPLES = 30  # 2.5 minutes


def _jitter(rng, n, scale=0.35):
    # GPS speed noise when standing still: small positive values
    return np.abs(rng.normal(0, scale, n))


def _drive(rng, n, cruise, stop_every, stop_len, accel, stop_at_bus_p):
    """Generic vehicle/person speed profile with stops."""
    speed = np.zeros(n)
    at_stop = np.zeros(n, dtype=bool)
    v = rng.uniform(0, cruise)
    i = 0
    next_stop = int(rng.uniform(0.3, 1.2) * stop_every / DT)
    while i < n:
        if i >= next_stop:
            length = max(1, int(rng.uniform(*stop_len) / DT))
            bus_stop = rng.random() < stop_at_bus_p
            for j in range(i, min(n, i + length)):
                speed[j] = abs(rng.normal(0, 0.25))
                at_stop[j] = bus_stop
            i += length
            v = 0.0
            next_stop = i + max(2, int(rng.uniform(0.6, 1.4) * stop_every / DT))
            continue
        target = cruise * rng.uniform(0.75, 1.15)
        v = v + np.clip(target - v, -accel * DT, accel * DT)
        speed[i] = max(0, v + rng.normal(0, 0.4))
        i += 1
    return speed, at_stop


def simulate_trace(rng, mode):
    n = N_SAMPLES
    near_gym = np.zeros(n, dtype=bool)
    at_bus_stop = np.zeros(n, dtype=bool)
    if mode == "stationary":
        speed = _jitter(rng, n)
        # sometimes you are sitting near a bus stop (e.g. a café by the stop)
        if rng.random() < 0.15:
            at_bus_stop[:] = True
    elif mode == "gym":
        speed = _jitter(rng, n)
        # walking between machines
        for _ in range(rng.integers(0, 3)):
            k = rng.integers(0, n - 3)
            speed[k:k + 2] = rng.uniform(0.6, 1.3, 2)
        near_gym[:] = rng.random(n) < 0.95
    elif mode == "walking":
        speed, stops = _drive(rng, n, cruise=rng.uniform(1.1, 1.7), stop_every=90,
                              stop_len=(5, 30), accel=0.8, stop_at_bus_p=0.08)
        at_bus_stop = stops
        if rng.random() < 0.1:  # walking past/into a gym
            near_gym[: rng.integers(1, n)] = True
    elif mode == "cycling":
        speed, stops = _drive(rng, n, cruise=rng.uniform(4.0, 7.0), stop_every=80,
                              stop_len=(5, 35), accel=1.0, stop_at_bus_p=0.05)
        at_bus_stop = stops
    elif mode == "bus":
        traffic = rng.random() < 0.25  # crawling in traffic
        cruise = rng.uniform(1.5, 3.5) if traffic else rng.uniform(5.0, 11.0)
        speed, stops = _drive(rng, n, cruise=cruise, stop_every=rng.uniform(45, 110),
                              stop_len=(15, 60), accel=0.9, stop_at_bus_p=0.7)
        at_bus_stop = stops
    elif mode == "car":
        traffic = rng.random() < 0.2
        cruise = rng.uniform(2.0, 4.0) if traffic else rng.uniform(8.0, 16.0)
        speed, stops = _drive(rng, n, cruise=cruise, stop_every=rng.uniform(60, 150),
                              stop_len=(10, 50), accel=2.0, stop_at_bus_p=0.1)
        at_bus_stop = stops
    else:
        raise ValueError(mode)

    # GPS dropouts: occasional missing speed reading replaced by neighbour + noise
    for k in np.where(rng.random(n) < 0.05)[0]:
        speed[k] = max(0, speed[max(0, k - 1)] + rng.normal(0, 1.0))

    return [
        {"t": i * DT, "speed": round(float(speed[i]), 2),
         "atBusStop": bool(at_bus_stop[i]), "nearGym": bool(near_gym[i])}
        for i in range(n)
    ]


def simulate_context(rng, mode):
    exam_period = rng.random() < 0.35
    days_to_exam = int(rng.integers(0, 15)) if exam_period else -1
    target = int(rng.choice([30, 45, 60, 90, 120]))
    scrolled = int(np.clip(rng.gamma(2.0, target / 2.2), 0, 300))
    has_commitment = rng.random() < 0.55
    mins_to_commit = int(rng.integers(3, 180)) if has_commitment else -1
    hour = int(rng.integers(7, 25)) % 24
    return {
        "minutesScrolledToday": scrolled,
        "dailyTargetMinutes": target,
        "examPeriod": exam_period,
        "daysUntilExam": days_to_exam,
        "minutesToNextCommitment": mins_to_commit,
        "inSetRest": bool(mode == "gym" and rng.random() < 0.7),
        "mood": int(rng.integers(1, 6)),
        "hour": hour,
        "expectedTripMinutes": int(rng.integers(5, 40)) if mode == "bus" else -1,
    }


def build(n_per_mode=2500, seed=7):
    rng = np.random.default_rng(seed)
    rows = []
    for mode in MODES:
        for _ in range(n_per_mode):
            trace = simulate_trace(rng, mode)
            ctx = simulate_context(rng, mode)
            minutes = recommend_minutes(mode, ctx)
            # human-ish label noise: +/- a bit, never negative
            if minutes > 0:
                minutes = int(np.clip(round(minutes * rng.normal(1.0, 0.08)), 0, 120))
            rows.append({"mode": mode, "trace": trace, "context": ctx, "minutes": minutes})
    rng.shuffle(rows)
    return rows


if __name__ == "__main__":
    rows = build()
    with open("data/scenarios.jsonl", "w") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")
    print(f"wrote {len(rows)} scenarios")
    print("features:", FEATURE_NAMES)
