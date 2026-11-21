"""The scroll-time policy used to label the simulated data.

This is the 'teacher'. The model learns to reproduce it from noisy inputs, and
later it can be retrained on real feedback (did the user accept the time? did
they overrun?) so it drifts away from these hand rules.
"""


PLACE_TYPES = ["study", "home", "food", "park", "gym", "unknown"]


def is_lunch(hour):
    return 12 <= hour < 14


def is_work_time(place, hour):
    return place == "study" and 9 <= hour < 18 and not is_lunch(hour)


def place_base(place, hour):
    """Starting allowance when sitting still, by place type and hour."""
    if place == "study":          # uni buildings, libraries, offices
        if is_lunch(hour):
            return 10
        if 9 <= hour < 18:
            return 0                # working hours: get the work done
        return 10                   # early morning / evening in the library
    if place == "home":           # halls / home
        if hour >= 18 or hour < 9:
            return 30
        return 15 if not is_lunch(hour) else 20
    if place == "food":           # cafe, pub, restaurant: you're with people or eating
        return 10
    if place == "park":
        return 5
    if place == "gym":
        return 2
    return 20                       # unknown place


def recommend_minutes(mode, c):
    # Safety: never recommend scrolling while moving under your own power or driving
    if mode in ("walking", "cycling", "car"):
        return 0

    if mode == "bus":
        base = c["expectedTripMinutes"] if c["expectedTripMinutes"] > 0 else 15
    elif mode == "gym":
        base = 2 if c["inSetRest"] else 0  # 1-3 min per rest between sets
    else:  # stationary: depends on what kind of place you're in and the time
        base = place_base(c.get("placeType", "unknown"), c["hour"])

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

    # Low mood: a small, gentle allowance rather than nothing (not at the gym,
    # and only 3 min if you're in a study building during working hours)
    if c["mood"] <= 2 and mode != "gym":
        floor = 3 if (mode == "stationary" and is_work_time(c.get("placeType"), c["hour"])) else 5
        minutes = max(minutes, floor)

    # Gym rest is short by nature
    if mode == "gym":
        minutes = min(minutes, 3)
        if c["inSetRest"]:
            minutes = max(minutes, 1)

    # Never run into the next commitment (leave 2 min to get going)
    if c["minutesToNextCommitment"] >= 0:
        minutes = min(minutes, max(0, c["minutesToNextCommitment"] - 2))

    return int(max(0, min(120, round(minutes))))
