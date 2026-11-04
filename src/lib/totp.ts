import crypto from "crypto";
import QRCode from "qrcode";

// Standard RFC 4648 Base32 alphabet
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Decode a base32 string into a Buffer.
 */
export function base32Decode(base32Str: string): Buffer {
  const clean = base32Str.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const output: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const val = BASE32_ALPHABET.indexOf(clean[i]);
    if (val === -1) continue;

    value = (value << 5) | val;
    bits += 5;

    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

/**
 * Encode a Buffer into a base32 string.
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

/**
 * Generate a cryptographically secure random Base32 secret for TOTP.
 * 20 bytes (160 bits) as recommended by RFC 4226 / RFC 6238.
 */
export function generateTotpSecret(byteLength = 20): string {
  const randomBytes = crypto.randomBytes(byteLength);
  return base32Encode(randomBytes);
}

/**
 * Build the standard otpauth:// URL recognized by Google Authenticator,
 * Microsoft Authenticator, 1Password, and Apple Passwords.
 */
export function buildOtpAuthUrl({
  issuer = "Gandharva School of Music",
  accountName,
  secret,
}: {
  issuer?: string;
  accountName: string;
  secret: string;
}): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedAccount = encodeURIComponent(accountName);
  const cleanSecret = secret.replace(/[\s-]/g, "").toUpperCase();

  return `otpauth://totp/${encodedIssuer}:${encodedAccount}?secret=${cleanSecret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Generate a QR code Data URL (PNG) from an otpauth:// URL.
 */
export async function generateQrCodeDataUrl(otpAuthUrl: string): Promise<string> {
  return QRCode.toDataURL(otpAuthUrl, {
    width: 260,
    margin: 2,
    color: {
      dark: "#1A022D",
      light: "#FFFFFF",
    },
    errorCorrectionLevel: "M",
  });
}

/**
 * Compute the 6-digit TOTP code for a given secret at a specific counter step.
 */
export function computeTotpAtStep(secret: string, step: number): string {
  const key = base32Decode(secret);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(step), 0);

  const hmac = crypto.createHmac("sha1", key).update(counterBuffer).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;

  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);

  const otp = binary % 1000000;
  return otp.toString().padStart(6, "0");
}

/**
 * Verify a 6-digit user-provided code against a TOTP secret.
 * Allows a drift window of ±1 step (30 seconds before and 30 seconds after)
 * to accommodate user device clock skew.
 */
export function verifyTotpCode(
  secret: string,
  userCode: string,
  options?: { window?: number; timestampMs?: number }
): boolean {
  if (!secret || !userCode) return false;

  const cleanCode = userCode.trim().replace(/[\s-]/g, "");
  if (!/^\d{6}$/.test(cleanCode)) return false;

  const window = options?.window ?? 1; // ±1 step window
  const nowMs = options?.timestampMs ?? Date.now();
  const currentStep = Math.floor(nowMs / 1000 / 30);

  for (let delta = -window; delta <= window; delta++) {
    const step = currentStep + delta;
    const expected = computeTotpAtStep(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(cleanCode))) {
      return true;
    }
  }

  return false;
}

/**
 * Generate cryptographically secure one-time backup recovery codes.
 * e.g. ["8492-4192", "1940-5821", ...]
 */
export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const part1 = crypto.randomInt(1000, 9999).toString();
    const part2 = crypto.randomInt(1000, 9999).toString();
    codes.push(`${part1}-${part2}`);
  }
  return codes;
}

/**
 * Format a base32 secret with spaces for easier manual typing in Authenticator:
 * e.g. "JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP"
 */
export function formatSecretForDisplay(secret: string): string {
  const clean = secret.replace(/[\s-]/g, "").toUpperCase();
  return clean.match(/.{1,4}/g)?.join(" ") || clean;
}

