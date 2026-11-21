"""Trace features. Must match extractTraceFeatures() in scrollModel.ts exactly."""
import math

STOP_SPEED = 0.6   # m/s, below this counts as stopped
MIN_STOP_S = 10    # a stop must last at least this long

FEATURE_NAMES = [
    "mean_speed", "max_speed", "std_speed", "p75_speed", "frac_stopped",
    "stops_per_min", "mean_stop_s", "frac_stops_at_bus_stop", "mean_abs_accel",
    "moving_mean_speed", "frac_near_gym",
]


def trace_features(trace):
    n = len(trace)
    if n == 0:
        return [0.0] * len(FEATURE_NAMES)
    speeds = [max(0.0, float(s.get("speed") or 0.0)) for s in trace]
    times = [float(s["t"]) for s in trace]
    duration = max(times[-1] - times[0], 1.0)
    mean = sum(speeds) / n
    std = math.sqrt(sum((v - mean) ** 2 for v in speeds) / n)
    srt = sorted(speeds)
    p75 = srt[min(n - 1, int(0.75 * (n - 1) + 0.5))]
    stopped = [v < STOP_SPEED for v in speeds]
    frac_stopped = sum(stopped) / n

    # stop segments
    stops, i = [], 0
    while i < n:
        if stopped[i]:
            j = i
            while j + 1 < n and stopped[j + 1]:
                j += 1
            length = times[j] - times[i] + (times[1] - times[0] if n > 1 else 5.0)
            if length >= MIN_STOP_S:
                at_bus = any(trace[k].get("atBusStop") for k in range(i, j + 1))
                stops.append((length, at_bus))
            i = j + 1
        else:
            i += 1
    stops_per_min = len(stops) / (duration / 60.0)
    mean_stop = sum(s[0] for s in stops) / len(stops) if stops else 0.0
    frac_bus = sum(1 for s in stops if s[1]) / len(stops) if stops else 0.0

    accels = [abs(speeds[k] - speeds[k - 1]) / max(times[k] - times[k - 1], 1.0) for k in range(1, n)]
    mean_acc = sum(accels) / len(accels) if accels else 0.0
    moving = [v for v in speeds if v >= STOP_SPEED]
    moving_mean = sum(moving) / len(moving) if moving else 0.0
    gym = sum(1 for s in trace if s.get("nearGym")) / n

    return [mean, max(speeds), std, p75, frac_stopped, stops_per_min, mean_stop,
            frac_bus, mean_acc, moving_mean, gym]
