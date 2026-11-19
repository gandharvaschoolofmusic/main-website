import type { NextAuthConfig } from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { db } from "@/lib/db";

// Keep database checks in server auth, outside the lightweight middleware config.
export const validateSessionJwt: NonNullable<NonNullable<NextAuthConfig["callbacks"]>["jwt"]> = async (params) => {
  // Check the existing authenticated token before applying client session updates.
  // A fresh login has a verified user and receives a new ID in the base callback.
  if (!params.user && params.token.role === "ADMIN" && typeof params.token.sessionId === "string") {
    const session = await db.adminDeviceSession.findUnique({
      where: { sessionId: params.token.sessionId },
      select: { isRevoked: true },
    });
    // Auth.js clears the session cookie when the JWT callback returns null.
    // Do not delete the revocation row: old cookies must remain invalid.
    if (session?.isRevoked) return null;
  }
  return authConfig.callbacks!.jwt!(params);
};
