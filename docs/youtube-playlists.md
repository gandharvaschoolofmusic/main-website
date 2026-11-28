# Course YouTube playlists

- Admin: open **YouTube**, find and select a student, select one of their allotted courses, and choose **Add playlist**. Paste the playlist URL and save. Repeat for each course. **Edit playlist** replaces or removes only that enrollment's link. **Preview course videos** plays inside the admin dashboard.
- Student: open **YouTube** and choose a course beside the player (a dropdown on smaller screens). Select a lecture to play inside the dashboard.
- The teacher YouTube menu was removed; its old route redirects to the teacher dashboard.

Each enrollment stores one playlist. Multiple enrollments in the same course remain separate. Cancelled enrollments are excluded. Existing lecture recordings and learning resources are unchanged.

## Embedded playback and YouTube access

Use a public or unlisted playlist with embeddable videos. The dashboard controls who sees assigned courses, but unlisted YouTube URLs remain accessible to anyone who obtains the link. Embedding does not make a recording private. Private, deleted, restricted or embedding-disabled videos may be unavailable in the player. The app does not redirect viewers to YouTube; YouTube's own player branding and links remain under YouTube's control.

The app does not upload videos, change their privacy, invite viewers, or verify whether a playlist currently exists. It validates and saves a canonical HTTPS YouTube playlist URL. No YouTube API credentials are required.

The official IFrame Player API supplies playlist video IDs in owner order. Numbered lecture buttons select the corresponding playlist index, including duplicate entries. Only the selected course mounts a player. Switching courses destroys it. Playlist discovery polling is bounded and stops as soon as the list loads; errors include a reload action. No thumbnails or video titles are invented.

## Student grouping and navigation

Admin pagination contains 20 students, with all non-cancelled enrollments included for each. Search and playlist filters select students; their other courses remain visible so course assignments are never split between pages. Stable enrollment IDs drive editing and playback, including repeat enrollments in the same course.

Selecting a student or course uses local state without navigation or database requests. Previous/Next prefetch adjacent routes, retain the current screen during transitions and show pending feedback. A 30-second tagged database cache reduces repeated reads; successful saves immediately expire the playlist tag. Authorization runs before accessing cached admin data. The project retains its existing `unstable_cache` approach because Cache Components are not enabled. Page loading and error boundaries cover navigation failures.

Edits lock student/course/pagination controls until Save or Cancel. The save action still compares the expected old URL to prevent overwriting another administrator's changes. The redundant full router refresh after saving was removed; local assignment counts update from the successful result, and the server action revalidates the affected routes.

Reference: https://developers.google.com/youtube/iframe_api_reference

## Implementation and verification

Migration: `20261128110000_enrollment_youtube_playlist` adds nullable URL and update-time fields to Enrollment. Deploy the migration before the new application build. No playlist is assigned by the migration.

Run `node scripts/youtube-playlists-check.cjs` for URL validation, admin authorization, stale-edit protection, independent updates/removal across two enrollments, and library query isolation. These checks use isolated database/auth boundaries and do not edit live enrollments.

Run `node scripts/youtube-students-check.cjs` for student-level pagination, keeping all courses together, filters, page limits, cache tags and authorization before cache access.

Run `node scripts/youtube-player-check.cjs` for ordered lecture selection, duplicate playlist entries, player cleanup during course changes, delayed API loading and errors. These checks isolate the external player and do not assert actual YouTube playback availability.

Design follows the existing dashboard palette, fonts and navigation. The redesign used the design-taste-frontend accent-ladder direction, seed 804945956, with no redraws. Existing school purple/type/sidebar are retained rather than changing the shared dashboard shell. The admin question is “Which course needs this student's playlist?”; the student question is “Which course's lectures can I watch?” The defining element is the student's grouped course selector, with independent added/missing states. Desktop uses a 280px list + 20px gap + remaining detail area; tablet/mobile use full-width selectors. Production data comes from authorized database queries; there is no sample data in the shipped screens.

TypeScript, focused ESLint, behavior checks and the skill's source design lint passed. Browser visual review of an isolated component fixture was blocked because Computer Use could not reliably establish Chrome's current URL and stopped. No alternative browser automation was used. Desktop/mobile screenshots and production navigation timing remain unverified.

Production build passed with `next build --webpack`. The local Turbopack build encountered a worker process failure; deployment retains the project's existing build configuration.
