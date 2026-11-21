# Pause Together

Build a mobile-first web app (installable as a PWA) called "Pause". The idea: when someone goes to open Instagram, they land in Pause first. We log that they're about to scroll, ask a few quick questions, and show them friends who are also about to scroll right now, so they can do something social together instead of watching Reels.

## How users get here (important context)
This app can't detect app launches itself. On iPhone, an Apple Shortcuts automation ("When Instagram is opened") opens:
  https://<my-app-url>/intercept?app=instagram
So /intercept is the main entry point. It must load fast and keep the user logged in on the device (persistent session, no repeated logins).

## Accounts & friends
- Sign up with email magic link, then choose a unique username, display name and optional avatar.
- Friends are managed inside Pause (we can't access Instagram's friend list):
  - Search by username and send a friend request; accept/decline incoming requests.
  - Each user has a shareable invite link (https://<my-app-url>/invite/<username>) that opens sign-up and auto-sends a friend request.
- Friendships are mutual (both must accept).

## Core flow: /intercept
Step 1: Log it. The moment the page loads, create a "session" row: id, user_id, app (from ?app=, default "instagram"), created_at, outcome = "pending".

Step 2: Quick check-in (max 3 questions, one per screen, big tap buttons, no typing required):
  1. "Why are you opening Instagram?": Bored / Procrastinating / Messaging someone / Habit / Something specific
  2. "How are you feeling?": 5 emoji scale
  3. "Free to do something in the next hour?": Yes / Maybe / No
  Save answers to the session row. Include a small "Skip" link on each question.

Step 3: Friends in the same boat. Show friends who have a session in the last 15 minutes with outcome not "cancelled" (i.e. also about to scroll). For each: avatar, name, "opened Instagram 3 min ago", and their "free to do something" answer.
  - Each friend has a "Nudge" button that sends them an in-app invite with a preset activity: "Call?", "Grab food?", "Go for a walk?", "Gym?", "Play something?" (pick one).
  - The recipient sees the invite live (use realtime subscriptions) as a banner/card they can Accept or Decline. On accept, both users see "It's on 🎉" and a button to message each other (link to their phone number/WhatsApp if they've added one in their profile, otherwise just a confirmation).
  - If no friends are currently on, show: "None of your friends are scrolling right now" + "Invite a friend" (copy invite link).
  - This list should update live without refreshing.

Step 4: Exit options at the bottom:
  - "Do something else" → outcome = "redirected", go to dashboard
  - "Continue to Instagram" → outcome = "continued", then open:
      shortcuts://run-shortcut?name=Pause%20Pass
    Do NOT link directly to

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/99cb7fc9-2d00-44ca-b0a1-599412fb7d68).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
