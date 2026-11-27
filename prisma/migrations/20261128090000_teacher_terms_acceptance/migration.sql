ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "teacherTermsAcceptedAt" TIMESTAMPTZ(6),
                   ADD COLUMN IF NOT EXISTS "teacherTermsVersion" TEXT;
