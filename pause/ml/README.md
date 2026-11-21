# Pause quick local scroll-time model (local-v1)

Runs fully on-device, no credits. Two small random forests exported to `scroll-model.json`.

- `simulate.py` makes 15,000 simulated scenarios (2,500 per context): a 2.5 min GPS speed trace (sample every 5 s) + student context.
- `features.py` turns a trace into 11 features (speed stats, stops per minute, stop length, share of stops at bus stops, acceleration, near-gym share).
- `rules.py` is the "teacher" policy that labels recommended minutes (bus = trip time, gym between sets = 1-3, walking/cycling/car = 0, budget, exam period, late night, low mood, next commitment).
- `train.py` trains the context classifier and the minutes regressor, prints metrics, exports `scroll-model.json` and `data/parity_cases.json`.
- `ts/` is the TypeScript inference used by the app.

Rebuild: `python3 simulate.py && python3 train.py` (needs numpy + scikit-learn).

## Results on 3,000 held-out simulated scenarios
- Context accuracy 95.3%. Stationary, gym and walking near perfect.
- Bus: precision 0.89, recall 0.83. Main confusion is bus vs car (11% of bus traces read as car), mostly buses crawling in traffic.
- Minutes: mean error 0.57 min, 96.5% within 3 min of the rule label.
- Safety: 0 of 1,500 walking/cycling/driving scenarios got any scroll time.

## Limits
- Trained on simulated data, so the real-world accuracy is unknown until we log real traces.
- `atBusStop` / `nearGym` need map data (NaPTAN bus stops, gym locations). Without them bus detection leans on the stop-and-go speed pattern only.
- The minutes model copies `rules.py`; the point is the pipeline, which can later be retrained on real feedback.
