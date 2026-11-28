# Course YouTube playlists

- Admin: open **YouTube** in the sidebar, search for a student or course, and choose **Add playlist** on the enrollment. Paste the playlist's share URL and save. Use **Edit playlist** to replace or remove the link.
- Student: open **YouTube** to see playlists for their own allotted courses.
- Teacher: open **YouTube** to see playlists for enrollments currently allotted to them.

Each enrollment stores one playlist. Multiple enrollments in the same course remain separate. Cancelled enrollments are excluded. Existing lecture recordings and learning resources are unchanged.

## Private YouTube access

The dashboard controls who sees each saved link. YouTube separately controls playback. Invite each student's Google account (and the teacher if required) to each private video in YouTube Studio. A private playlist itself is owner-only; a shareable playlist can contain privately shared videos. Do not change the videos to Public. The viewer opens YouTube and signs in with the invited account.

The app does not upload videos, change their privacy, invite viewers, or verify whether a playlist currently exists. It validates and saves a canonical HTTPS YouTube playlist URL. No YouTube API credentials are required.

Reference: https://support.google.com/youtube/answer/57793

## Implementation and verification

Migration: `20261128110000_enrollment_youtube_playlist` adds nullable URL and update-time fields to Enrollment. Deploy the migration before the new application build. No playlist is assigned by the migration.

Run `node scripts/youtube-playlists-check.cjs` for URL validation, admin authorization, stale-edit protection, link removal, and student/teacher query isolation. These checks use isolated database/auth boundaries and do not edit live enrollments.

Design follows the existing dashboard palette, fonts and navigation. The frontend design skill used the accent-ladder app direction, seed 1816771245, preserving palette and type. The admin view has search, playlist filters and pagination; viewer lists have assigned/missing playlist states. Loading states and existing dashboard error boundaries apply.

TypeScript and focused ESLint checks passed. Browser visual verification was attempted with rendered fixture previews but was blocked: the in-app browser could not reach localhost, and the native Chrome window could not be restored through the available UI API. Responsive classes were reviewed in source; desktop/mobile screenshots remain unverified.

Production build passed with `next build --webpack`. The local Turbopack build encountered a worker process failure; deployment retains the project's existing build configuration.
