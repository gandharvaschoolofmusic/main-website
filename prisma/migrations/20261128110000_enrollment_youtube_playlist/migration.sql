ALTER TABLE "Enrollment" ADD COLUMN IF NOT EXISTS "youtubePlaylistUrl" TEXT,
                         ADD COLUMN IF NOT EXISTS "youtubePlaylistUpdatedAt" TIMESTAMPTZ(6);
