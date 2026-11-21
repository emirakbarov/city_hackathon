# Pause scroll model: JSON format (contract between Python training and TypeScript inference)

File: `scroll-model.json`

```jsonc
{
  "version": "local-v1",
  "stopSpeed": 0.6,          // m/s, below = stopped (features.py STOP_SPEED)
  "minStopS": 10,            // stop segment must last >= this many seconds (MIN_STOP_S)
  "classes": ["stationary","gym","walking","cycling","bus","car"],
  "traceFeatureNames": [...11 names, order as in features.py FEATURE_NAMES],
  "classifier": { "trees": [Tree, ...] },     // random forest, average leaf probability vectors
  "regressorFeatureNames": [
    "minutesScrolledToday","dailyTargetMinutes","minutesLeft","examPeriod","daysUntilExam",
    "minutesToNextCommitment","inSetRest","mood","hour","expectedTripMinutes",
    "p_stationary","p_gym","p_walking","p_cycling","p_bus","p_car"
  ],
  "regressor": { "trees": [Tree, ...] }       // random forest, average leaf scalar values
}
```

Tree (flat arrays, node 0 is root):
```jsonc
{ "f": [int],      // feature index, -1 = leaf
  "t": [number],   // threshold: go LEFT if x[f] <= t else RIGHT
  "l": [int], "r": [int],   // child node indices (-1 at leaves)
  "v": [number[] | number]  // classifier: class-probability array per node; regressor: number per node
}
```

Regressor input encoding:
- `minutesLeft = dailyTargetMinutes - minutesScrolledToday`
- booleans -> 1/0
- missing values (no exam, no commitment, no trip) -> -1
- `p_*` = classifier probabilities for the trace

Trace input: array of `{ t: seconds, speed: m/s, atBusStop?: boolean, nearGym?: boolean }`, ~5 s apart, ~2.5 min long.
Feature definitions: see `features.py` (must match exactly, including stop-segment length = t[j]-t[i] + (t[1]-t[0]) and p75 index = min(n-1, int(0.75*(n-1)+0.5))).

Post-processing guards applied after the regressor (same in Python eval and TS):
1. If top class is walking/cycling/car with prob >= 0.6 -> 0 minutes (safety).
2. If minutesToNextCommitment >= 0 -> cap at max(0, minutesToNextCommitment - 2).
3. If top class is gym -> cap at 3.
4. Round, clamp to [0, 120].
