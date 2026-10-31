/**
 * Client-safe phone number utilities.
 * Contains no Node.js built-ins or database dependencies so it can safely be imported into Client Components.
 */

/**
 * Formats a dial code and local phone input into standard international E.164.
 * Strips accidental domestic trunk zeros (e.g. 0176... in Germany -> +49176...) and cleans whitespace/symbols.
 */
export function formatInternationalE164(dialCode: string, rawNumber: string): string {
  if (!rawNumber) return "";
  let trimmed = rawNumber.trim().replace(/[\s\-\(\)\.]/g, "");

  // If already starts with +, clean domestic 0 after dial code if present
  if (trimmed.startsWith("+")) {
    const match = trimmed.match(/^(\+(?:1|44|49|33|61|65|971|966|974|968|965|973|60|64|27|353|41|81|977|880|94|230|39|34|46|47|45))0(\d+)$/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
    return trimmed;
  }

  if (trimmed.startsWith("00")) {
    return formatInternationalE164("+", trimmed.slice(2));
  }

  // Strip leading domestic trunk zero(s)
  let cleanDigits = trimmed.replace(/\D/g, "");
  if (cleanDigits.startsWith("0")) {
    cleanDigits = cleanDigits.replace(/^0+/, "");
  }

  const cleanDialCode = dialCode.startsWith("+") ? dialCode : `+${dialCode.replace(/\D/g, "")}`;
  return `${cleanDialCode}${cleanDigits}`;
}

/**
 * Normalizes phone numbers to standard E.164 format.
 * Defaults to India (+91) if a 10-digit number is provided without a country code.
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";

  // Strip all whitespace, dashes, parentheses, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  // If starts with 00, replace with +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // If starts with +, strip any domestic 0 after dial code if present
  if (cleaned.startsWith("+")) {
    const match = cleaned.match(/^(\+(?:1|44|49|33|61|65|971|966|974|968|965|973|60|64|27|353|41|81|977|880|94|230|39|34|46|47|45))0(\d+)$/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
    return cleaned;
  }

  // If it's a 10-digit number, prepend +91
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If 11 or 12 digits starting with 91, add +
  if (/^91\d{10}$/.test(cleaned)) {
    return `+${cleaned}`;
  }

  // Default fallback: ensure leading +
  return `+${cleaned}`;
}

/**
 * Checks if a string is a valid international/national mobile number.
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone);
  // Valid E.164 phone numbers: + followed by 7 to 15 digits
  return /^\+[1-9]\d{6,14}$/.test(normalized);
}

