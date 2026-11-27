# Google Calendar sync

Students and teachers connect from their dashboard Calendar page. School lessons and published registered/assigned events sync to their Google account's primary calendar. The school schedule is authoritative. The sync covers future sessions and the previous 30 days, uses stable event IDs to avoid duplicates, and cancels school events when cancelled, deleted or reassigned in the school dashboard. Personal Google events are outside this integration.

## Production setup

1. Enable the Google Calendar API in the Google Cloud project used for Google sign-in.
2. On its OAuth web client, register this exact authorized redirect URI:
   `https://www.gandharvaschoolofmusic.com/api/google-calendar/callback`
3. Configure the OAuth consent screen for the email and `https://www.googleapis.com/auth/calendar.events.owned` scopes. Add test users while in Testing. Complete Google's required verification/publishing steps for general access. Testing refresh tokens may expire.
4. In Vercel Production, set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `AUTH_SECRET`, `APP_URL=https://www.gandharvaschoolofmusic.com`, and `CRON_SECRET`. Use the same canonical origin as the registered callback. Redeploy.
5. The Vercel project must support the five-minute cron schedule already used by this site. The new job is `/api/cron/google-calendar`. An external scheduler can call it with `Authorization: Bearer <CRON_SECRET>` if needed.
6. Connect a student and teacher Google account. Check the connected email, run Sync now, and verify lesson time, classroom link, rescheduling and cancellation in Google Calendar.

Tokens are encrypted with AUTH_SECRET and stored under a dedicated google-calendar Account provider. Rotating AUTH_SECRET requires users to reconnect. Disconnect stops future synchronization and retains existing Google events. Sync failures are shown on manual sync and reported as a failed count by the scheduled endpoint. Google authorization and live delivery require production setup and have not been exercised locally.

## Where users connect

- Students: `/student/dashboard/calendar` → **Connect Google Calendar**.
- Teachers: `/teacher/dashboard/calendar` → **Connect Google Calendar**.
- The button stays visible while configuration is unavailable, with an explanation. It becomes an active Google authorization link after the required environment variables are set and the deployment finishes.
- A Google service account email/private key is not a substitute for the OAuth web client ID/secret used to connect personal student and teacher calendars.
