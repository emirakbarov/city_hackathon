# Pause: upcoming commitments and calendar (future feature, not built yet)

**Status:** Requested, not built. Save for later. Do not build until the user asks.

## What the user asked for

- A section in the app that appears when the app opens and asks the user to fill in what they have coming up.
- Users can add things they know are coming up, such as exams, deadlines and other important things.
- Users can link their Google Calendar as an alternative or addition.
- Purpose: this data will help a separate model learn the user's interests. It also gives context to the scroll-time model.

## Why it matters later

- The interest model needs to see what is actually on the user's plate, not only what they tap, to learn what they care about and when they have room for it.
- The scroll-time model (Raf's, in `ml/`) already takes exam period, days until exam, and minutes to the next commitment as inputs. Right now those values are missing in the app, so this feature is what fills them.
- Storing this data in a structured way from the start makes both models easier to build.

## Open questions for later

- What fields each commitment has (title, date, type such as exam or deadline, importance, recurrence).
- Whether Google Calendar is read-only, and which events are used.
- How often the prompt appears after the first time (on every open, or only when nothing is saved).
- Privacy: what is stored, how long, whether users can delete it, and whether it is shared with the models or kept on the device.
