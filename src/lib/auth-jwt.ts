import type { NextAuthConfig } from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

// Keep database checks in server auth, outside the lightweight middleware config.
export const validateSessionJwt: NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]> = async (params) => {
  // Check the existing authenticated token before applying client session updates.
  // A fresh login has a verified user and receives a new ID in the base callback.
  if (!params.user && params.token.role === "ADMIN" && typeof params.token.sessionId === "string") {
    const session = await db.adminDeviceSession.findUnique({
      where: { sessionId: params.token.sessionId },
      select: { isRevoked: true, lastSeenAt: true },
    });
    // Auth.js clears the session cookie when the JWT callback returns null.
    // Do not delete the revocation row: old cookies must remain invalid.
    if (session?.isRevoked) return null;
    // Foreground admin pages check their session every 30 seconds. Keep the
    // displayed last-seen time current, with at most one write per minute.
    if (session && Date.now() - session.lastSeenAt.getTime() >= 60_000) {
      await db.adminDeviceSession.updateMany({
        where: {
          sessionId: params.token.sessionId,
          isRevoked: false,
          lastSeenAt: { lte: new Date(Date.now() - 60_000) },
        },
        data: { lastSeenAt: new Date() },
      }).catch((error) => {
        // A metadata write failure must not sign out an otherwise valid session.
        logger.warn({ error }, "Failed to update admin session last seen");
      });
    }
  }
  return authConfig.callbacks!.jwt!(params);
};
