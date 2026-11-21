"""The scroll-time policy used to label the simulated data.

This is the 'teacher'. The model learns to reproduce it from noisy inputs, and
later it can be retrained on real feedback (did the user accept the time? did
they overrun?) so it drifts away from these hand rules.
"""


def recommend_minutes(mode, c):
    # Safety: never recommend scrolling while moving under your own power or driving
    if mode in ("walking", "cycling", "car"):
        return 0

    if mode == "bus":
        base = c["expectedTripMinutes"] if c["expectedTripMinutes"] > 0 else 15
    elif mode == "gym":
        base = 2 if c["inSetRest"] else 0  # 1-3 min per rest between sets
    else:  # stationary
        base = 20

    # Daily budget: shrink as you approach or pass your target
    left = c["dailyTargetMinutes"] - c["minutesScrolledToday"]
    if left <= 0:
        overrun = -left / max(c["dailyTargetMinutes"], 1)
        budget_factor = 0.25 if overrun < 0.5 else 0.1
    else:
        budget_factor = min(1.0, left / max(base, 1))
        budget_factor = max(budget_factor, 0.3)
    minutes = base * budget_factor if left <= 0 else min(base, max(left, base * 0.3))

    # Exam period: cut sharply, harder the closer the exam
    if c["examPeriod"]:
        d = c["daysUntilExam"]
        if d <= 1:
            minutes *= 0.15
        elif d <= 3:
            minutes *= 0.3
        elif d <= 7:
            minutes *= 0.55
        else:
            minutes *= 0.75

    # Late night: wind down
    if c["hour"] >= 23 or c["hour"] < 6:
        minutes *= 0.5

    # Low mood: a small, gentle allowance rather than nothing (not at the gym)
    if c["mood"] <= 2 and mode != "gym":
        minutes = max(minutes, 5)

    # Gym rest is short by nature
    if mode == "gym":
        minutes = min(minutes, 3)
        if c["inSetRest"]:
            minutes = max(minutes, 1)

    # Never run into the next commitment (leave 2 min to get going)
    if c["minutesToNextCommitment"] >= 0:
        minutes = min(minutes, max(0, c["minutesToNextCommitment"] - 2))

    return int(max(0, min(120, round(minutes))))
