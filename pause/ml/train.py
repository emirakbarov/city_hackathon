"""Train the quick local Pause model and export it to scroll-model.json.

Two small random forests:
  1. context classifier: GPS trace features -> stationary/gym/walking/cycling/bus/car
  2. minutes regressor: student context + classifier probabilities -> recommended minutes
"""
import json
import sys
import numpy as np
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_predict
from sklearn.metrics import accuracy_score, confusion_matrix, mean_absolute_error

from features import trace_features, FEATURE_NAMES, STOP_SPEED, MIN_STOP_S

CLASSES = ["stationary", "gym", "walking", "cycling", "bus", "car"]
REG_FEATURES = [
    "minutesScrolledToday", "dailyTargetMinutes", "minutesLeft", "examPeriod", "daysUntilExam",
    "minutesToNextCommitment", "inSetRest", "mood", "hour", "expectedTripMinutes",
] + [f"p_{c}" for c in CLASSES]
UNSAFE = {"walking", "cycling", "car"}


def ctx_vector(c, probs):
    return [
        c["minutesScrolledToday"], c["dailyTargetMinutes"],
        c["dailyTargetMinutes"] - c["minutesScrolledToday"],
        1 if c["examPeriod"] else 0, c["daysUntilExam"], c["minutesToNextCommitment"],
        1 if c["inSetRest"] else 0, c["mood"], c["hour"], c["expectedTripMinutes"],
    ] + list(probs)


def guards(raw, probs, c):
    top = CLASSES[int(np.argmax(probs))]
    m = raw
    if top in UNSAFE and max(probs) >= 0.6:
        m = 0
    if c["minutesToNextCommitment"] >= 0:
        m = min(m, max(0, c["minutesToNextCommitment"] - 2))
    if top == "gym":
        m = min(m, 3)
    return int(min(120, max(0, round(m))))


def export_tree(est, classifier):
    t = est.tree_
    if classifier:
        vals = t.value[:, 0, :]
        vals = vals / vals.sum(axis=1, keepdims=True)
        v = [[round(float(x), 5) for x in row] for row in vals]
    else:
        v = [round(float(x), 4) for x in t.value[:, 0, 0]]
    return {
        "f": [int(x) if x >= 0 else -1 for x in t.feature],
        "t": [round(float(x), 6) for x in t.threshold],
        "l": [int(x) for x in t.children_left],
        "r": [int(x) for x in t.children_right],
        "v": v,
    }


def main():
    rows = [json.loads(l) for l in open("data/scenarios.jsonl")]
    X = np.array([trace_features(r["trace"]) for r in rows])
    y = np.array([CLASSES.index(r["mode"]) for r in rows])
    idx = np.arange(len(rows))
    tr, te = train_test_split(idx, test_size=0.2, random_state=0, stratify=y)

    clf = RandomForestClassifier(n_estimators=30, max_depth=9, min_samples_leaf=5,
                                 random_state=0, n_jobs=-1)
    # out-of-fold probabilities so the regressor learns from realistic (imperfect) detections
    oof = cross_val_predict(clf, X[tr], y[tr], cv=5, method="predict_proba", n_jobs=-1)
    clf.fit(X[tr], y[tr])
    p_te = clf.predict_proba(X[te])
    pred = p_te.argmax(1)
    print("context accuracy:", round(accuracy_score(y[te], pred), 4))
    print("confusion (rows=true, cols=pred)", CLASSES)
    print(confusion_matrix(y[te], pred))
    bus = CLASSES.index("bus")
    tp = ((pred == bus) & (y[te] == bus)).sum()
    print("bus precision:", round(tp / max(1, (pred == bus).sum()), 4),
          "bus recall:", round(tp / max(1, (y[te] == bus).sum()), 4))

    R_tr = np.array([ctx_vector(rows[i]["context"], p) for i, p in zip(tr, oof)])
    m_tr = np.array([rows[i]["minutes"] for i in tr])
    reg = RandomForestRegressor(n_estimators=30, max_depth=10, min_samples_leaf=4,
                                random_state=0, n_jobs=-1)
    reg.fit(R_tr, m_tr)

    R_te = np.array([ctx_vector(rows[i]["context"], p) for i, p in zip(te, p_te)])
    raw = reg.predict(R_te)
    final = np.array([guards(r, p, rows[i]["context"]) for r, p, i in zip(raw, p_te, te)])
    truth = np.array([rows[i]["minutes"] for i in te])
    print("minutes MAE:", round(mean_absolute_error(truth, final), 2))
    print("within 3 min:", round(float(np.mean(np.abs(truth - final) <= 3)), 4))
    unsafe_true = np.array([rows[i]["mode"] in UNSAFE for i in te])
    print("unsafe scenarios given >0 min:", int(((final > 0) & unsafe_true).sum()), "of", int(unsafe_true.sum()))
    for c in CLASSES:
        mask = np.array([rows[i]["mode"] == c for i in te])
        print(f"  {c:10s} MAE {mean_absolute_error(truth[mask], final[mask]):5.2f}  "
              f"mean true {truth[mask].mean():5.1f}  mean pred {final[mask].mean():5.1f}")

    model = {
        "version": "local-v1",
        "stopSpeed": STOP_SPEED, "minStopS": MIN_STOP_S,
        "classes": CLASSES,
        "traceFeatureNames": FEATURE_NAMES,
        "classifier": {"trees": [export_tree(e, True) for e in clf.estimators_]},
        "regressorFeatureNames": REG_FEATURES,
        "regressor": {"trees": [export_tree(e, False) for e in reg.estimators_]},
    }
    json.dump(model, open("scroll-model.json", "w"), separators=(",", ":"))

    # parity cases for the TS implementation
    cases = []
    for i, p, r in list(zip(te, p_te, raw))[:200]:
        cases.append({
            "trace": rows[i]["trace"], "context": rows[i]["context"],
            "features": [float(x) for x in X[i]],
            "probabilities": [float(x) for x in p],
            "minutes": guards(r, p, rows[i]["context"]),
        })
    json.dump(cases, open("data/parity_cases.json", "w"))
    print("exported scroll-model.json and data/parity_cases.json")


if __name__ == "__main__":
    main()
