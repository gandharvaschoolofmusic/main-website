-- CreateTable
CREATE TABLE "AdminDeviceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "deviceName" TEXT,
    "browser" TEXT,
    "os" TEXT,
    "ip" TEXT,
    "country" TEXT,
    "loginAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "AdminDeviceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminDeviceSession_sessionId_key" ON "AdminDeviceSession"("sessionId");

-- CreateIndex
CREATE INDEX "AdminDeviceSession_userId_idx" ON "AdminDeviceSession"("userId");

-- CreateIndex
CREATE INDEX "AdminDeviceSession_sessionId_idx" ON "AdminDeviceSession"("sessionId");

-- CreateIndex
CREATE INDEX "AdminDeviceSession_isRevoked_idx" ON "AdminDeviceSession"("isRevoked");

-- AddForeignKey
ALTER TABLE "AdminDeviceSession" ADD CONSTRAINT "AdminDeviceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

