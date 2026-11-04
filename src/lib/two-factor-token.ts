import crypto from "crypto";

const SECRET =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  "gandharva-2fa-temporary-secret-key-change-in-prod";

export interface TwoFactorChallengePayload {
  userId: string;
  email: string;
  isSetup?: boolean;
  tempSecret?: string;
  exp: number;
}

/**
 * Creates a signed 10-minute challenge token for 2FA verification.
 */
export function createTwoFactorChallenge(payload: Omit<TwoFactorChallengePayload, "exp"> & { expiresInMs?: number }): string {
  const expiresInMs = payload.expiresInMs ?? 10 * 60 * 1000; // 10 minutes (generous window for user 2FA flow)
  const fullPayload: TwoFactorChallengePayload = {
    userId: payload.userId,
    email: payload.email,
    isSetup: payload.isSetup,
    tempSecret: payload.tempSecret,
    exp: Date.now() + expiresInMs,
  };

  const dataStr = Buffer.from(JSON.stringify(fullPayload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(dataStr)
    .digest("base64url");

  return `${dataStr}.${signature}`;
}

/**
 * Verifies and decodes a two-factor challenge token. Returns null if invalid or expired.
 */
export function verifyTwoFactorChallenge(token: string): TwoFactorChallengePayload | null {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [dataStr, signature] = token.split(".");
  if (!dataStr || !signature) return null;

  const expectedSignature = crypto
    .createHmac("sha256", SECRET)
    .update(dataStr)
    .digest("base64url");

  try {
    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return null;
    }
  } catch {
    return null;
  }

  try {
    const jsonStr = Buffer.from(dataStr, "base64url").toString("utf8");
    const payload: TwoFactorChallengePayload = JSON.parse(jsonStr);

    if (!payload.userId || !payload.exp || Date.now() > payload.exp) {
      return null; // Expired or malformed
    }

    return payload;
  } catch {
    return null;
  }
}

