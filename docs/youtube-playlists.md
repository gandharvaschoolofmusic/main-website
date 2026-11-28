# Course YouTube playlists

- Admin: open **YouTube** in the sidebar, search for a student or course, and choose **Add playlist** on the enrollment. Paste the playlist's share URL and save. Use **Edit playlist** to replace or remove the link.
- Student: open **YouTube** and click a course name to expand its player and lecture list. Select any lecture to play it inside the dashboard.
- Teacher: the same player is available for enrollments currently allotted to them.

Each enrollment stores one playlist. Multiple enrollments in the same course remain separate. Cancelled enrollments are excluded. Existing lecture recordings and learning resources are unchanged.

## Embedded playback and YouTube access

Use a public or unlisted playlist with embeddable videos. The dashboard controls who sees assigned courses, but unlisted YouTube URLs remain accessible to anyone who obtains the link. Embedding does not make a recording private. Private, deleted, restricted or embedding-disabled videos may be unavailable in the player. The app does not redirect viewers to YouTube; YouTube's own player branding and links remain under YouTube's control.

The app does not upload videos, change their privacy, invite viewers, or verify whether a playlist currently exists. It validates and saves a canonical HTTPS YouTube playlist URL. No YouTube API credentials are required.

The official IFrame Player API supplies playlist video IDs in owner order. Numbered lecture buttons select the corresponding playlist index, including duplicate entries. Only the expanded course mounts a player. Closing or switching courses destroys it. Playlist discovery polling is bounded and stops as soon as the list loads; errors include a reload action. No thumbnails or video titles are invented.

Reference: https://developers.google.com/youtube/iframe_api_reference

## Implementation and verification

Migration: `20261128110000_enrollment_youtube_playlist` adds nullable URL and update-time fields to Enrollment. Deploy the migration before the new application build. No playlist is assigned by the migration.

Run `node scripts/youtube-playlists-check.cjs` for URL validation, admin authorization, stale-edit protection, link removal, and student/teacher query isolation. These checks use isolated database/auth boundaries and do not edit live enrollments.

Run `node scripts/youtube-player-check.cjs` for ordered lecture selection, duplicate playlist entries, player cleanup during course changes, delayed API loading and errors. These checks isolate the external player and do not assert actual YouTube playback availability.

Design follows the existing dashboard palette, fonts and navigation. The frontend design skill used the accent-ladder app direction, seed 1816771245, preserving palette and type. The admin view has search, playlist filters and pagination; viewer lists have assigned/missing playlist states. Loading states and existing dashboard error boundaries apply.

TypeScript and focused ESLint checks passed. Browser visual verification was attempted with rendered fixture previews but was blocked: the in-app browser could not reach localhost, and the native Chrome window could not be restored through the available UI API. Responsive classes were reviewed in source; desktop/mobile screenshots remain unverified.

Production build passed with `next build --webpack`. The local Turbopack build encountered a worker process failure; deployment retains the project's existing build configuration.
