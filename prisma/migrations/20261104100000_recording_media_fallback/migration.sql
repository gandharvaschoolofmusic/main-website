CREATE TABLE IF NOT EXISTS "LessonRecordingMedia" (
    "recordingId" TEXT PRIMARY KEY REFERENCES "LessonRecording"("id") ON DELETE CASCADE,
    "mimeType" TEXT NOT NULL,
    "bytes" BYTEA NOT NULL
);
ALTER TABLE "LessonRecordingMedia" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "LessonRecordingMedia" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE "LessonRecordingMedia" FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE "LessonRecordingMedia" FROM authenticated;
  END IF;
END $$;
