import crypto from "crypto";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Generate a cryptographically secure URL-safe token.
 */
export function generateSecureToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

/**
 * Create an email verification token expiring in 24 hours.
 */
export async function createEmailVerificationToken(
  email: string,
): Promise<string> {
  const normalizedEmail = email.trim().toLowerCase();
  const token = generateSecureToken();
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // Delete any existing verification tokens for this email
  await db.verificationToken.deleteMany({
    where: { identifier: normalizedEmail },
  });

  await db.verificationToken.create({
    data: {
      identifier: normalizedEmail,
      token,
      expires,
    },
  });

  logger.info({ email: normalizedEmail }, "Created email verification token");
  return token;
}

/**
 * Validate and resolve an email verification token.
 * Returns the email if valid, or null if invalid/expired.
 * Retains the token for its 24h validity window so that React StrictMode,
 * page refreshes, and email client link scanners do not cause false verification failures.
 */
export async function consumeEmailVerificationToken(
  token: string,
): Promise<string | null> {
  const record = await db.verificationToken.findUnique({
    where: { token },
  });

  if (!record) {
    return null;
  }

  if (record.expires < new Date()) {
    // Expired token: clean up from database
    try {
      await db.verificationToken.delete({ where: { token } });
    } catch {
      // Ignore concurrent deletion
    }
    return null;
  }

  // Token is valid; return the associated email address.
  return record.identifier.trim().toLowerCase();
}


/**
 * Create a single-use password reset token expiring in 30 minutes (per brief requirement).
 */
export async function createPasswordResetToken(
  email: string,
): Promise<string> {
  const token = generateSecureToken();
  const expires = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

  // Invalidate any previously un-used tokens for this email
  await db.passwordResetToken.updateMany({
    where: { email, used: false },
    data: { used: true },
  });

  await db.passwordResetToken.create({
    data: {
      email,
      token,
      expires,
      used: false,
    },
  });

  logger.info({ email }, "Created password reset token (30 min TTL)");
  return token;
}

/**
 * Validate a password reset token without consuming it yet.
 */
export async function validatePasswordResetToken(
  token: string,
): Promise<{ id: string; email: string } | null> {
  const record = await db.passwordResetToken.findUnique({
    where: { token },
  });

  if (!record || record.used) {
    return null;
  }

  if (record.expires < new Date()) {
    return null;
  }

  return { id: record.id, email: record.email };
}

/**
 * Mark a password reset token as consumed.
 */
export async function consumePasswordResetToken(
  id: string,
): Promise<void> {
  await db.passwordResetToken.update({
    where: { id },
    data: { used: true },
  });
}
