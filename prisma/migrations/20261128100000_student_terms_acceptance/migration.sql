ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "studentTermsAcceptedAt" TIMESTAMPTZ(6),
                   ADD COLUMN IF NOT EXISTS "studentTermsVersion" TEXT;
