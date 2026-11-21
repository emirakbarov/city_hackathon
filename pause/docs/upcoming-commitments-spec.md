# Pause: upcoming commitments (future feature, not built yet)

**Status:** Requested, not built. Save for later. Do not build until the user asks.

## What the user asked for

- A section in the app that appears when the app opens and asks the user to fill in what they have coming up.
- Users can add things they know are coming up, such as exams and other important things.
- Users can link their Google Calendar as an alternative or addition.
- Purpose: this data will feed a future ML model that recommends scroll time, so Pause can suggest when someone has room to scroll and when they should not.

## Why it matters later

- The ML model needs context about the user's real schedule and pressures to recommend scroll time.
- Storing this data in a structured way from the start makes the future model easier to build.

## Open questions for later

- What fields each commitment has (title, date, type such as exam or deadline, importance, recurrence).
- Whether Google Calendar is read-only, and which events are used.
- How often the prompt appears after the first time (on every open, or only when nothing is saved).
- Privacy: what is stored, how long, and whether users can delete it.
