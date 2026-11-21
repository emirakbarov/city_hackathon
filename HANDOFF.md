# Claude handoff

## Completed
- Productive check-in options use the user's daily objective, interests and upcoming commitments; Duolingo and live news destinations are linked.
- Private `daily_intentions` table and daily prompt (objective, energy, available task time); first local-day open prompts once, with editable home summary.
- Imported `personalModel.ts` from emirakbarov/city_hackathon `rafs-branch`; applied after existing inference, retaining slider behaviour and 45-minute wheel cap. Learning is account-scoped on-device, records opens only; no fabricated actual-duration training.
- 14 targeted tests passed; build log reports OK. Signed-in daily objective save/reload/productive choice verified on mobile without overflow.

## Not completed
- GitHub city_hackathon is a separate repository with app under `pause/`; no push or merge there occurred. A raw merge of Raf's outdated screens would regress current auth/check-in/setup. Integrate selectively. This project's commit sync is platform-managed.
- Final post-model browser rerun timed out waiting for Be productive; diagnose account/page state before claiming full end-to-end verification of the new model.
- Test objective `Browser verification task` may remain for the requesting user: delete only that matching daily_intentions row. Prior cleanup did not complete.
- Actual Instagram duration/overrun learning and Raf's /back close automation are not connected. Geographic place learning is not connected.
- News links open live sources, not an in-app fetched article feed.
- Changes are not published by this turn.

## Environment variable names (no private values)
Browser configuration: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` (project-managed configuration; do not commit private credentials).
Server-only managed values: `APP_USER_CONNECTION_KEY_SECRET`, `GOOGLE_CALENDAR_APP_USER_CONNECTOR_CLIENT_API_KEY`, `LOVABLE_API_KEY`, `LOVABLE_CRON_SECRET`.
Private values cannot be exported from chat. Existing code can continue using configured values in Lovable. A separate host needs its own credentials and connector setup; Lovable Cloud's privileged database credentials are not available.

Run focused tests: `bunx vitest run src/lib/productivity.test.ts src/lib/personalModel.test.ts src/lib/scrollTimer.test.ts`.