<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules
- Daily intentions are owner-only rows keyed by user and local calendar date; productive suggestions reuse these, interests and commitments independently of the timer.
- Apply Raf's personalModel after the existing scroll inference and before wheelStart; device learning is account-scoped and records only observed opens, with structured commitments mapped to exams, so slider behaviour and the 45-minute cap stay intact without inventing actual usage.
- Sign-in supports magic links, email/password and managed Google OAuth; OAuth returns to public /auth before a validated local destination, and recovery lives at public /reset-password, so protected routes never receive a transient missing session.
- Shortcuts owns scroll expiry in a persistent JSON file; expired opens go to /times-up without logging or clearing expiry; an explicit Pause Pass `cancel` command saves `{"cancelled":true}` and automation bypasses expiry until a new timed pass, because Safari and Home Screen storage differ.
- Friends' session visibility goes through `session_status` (trigger-mirrored from `sessions`); `sessions` is owner-only so mood stays private; only the check-in choice (socialise/productive/relax) is mirrored as `vibe` for matching.
- Phone numbers are read only via the `get_phone` RPC (self or accepted friends); `profiles.phone` has no column SELECT grant.
- Avatars are stored as small data URLs on `profiles.avatar_url` because public storage buckets are blocked in this workspace.
- "Continue to Instagram" must open the Pause Pass shortcut, never `instagram://`, to avoid re-triggering the automation loop.

- Upcoming commitments live in `public.commitments` (title, kind exam|deadline|other, due_date, source manual|google_calendar, external_id); `modelInputs()` in src/lib/commitments.ts maps them to the scroll model inputs — why: one structured source for manual and future calendar entries.
- Google Calendar uses the per-user App User Connector (`src/lib/googleCalendar.functions.ts`); encrypted keys live in server-only `app_user_connections`; events map via `mapEvent()` (all-day end exclusive) into `commitments` with source google_calendar — why: each user's own calendar, one commitments source.
