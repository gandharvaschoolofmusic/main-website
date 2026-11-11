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
 * If the number already starts with + it is treated as international E.164 and
 * returned cleaned but unchanged (no India default is applied).
 * Only bare digit strings without a country code fall back to +91 (India).
 */
export function normalizePhoneNumber(rawPhone: string): string {
  if (!rawPhone) return "";

  // Strip all whitespace, dashes, parentheses, dots
  let cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, "");

  // If starts with 00, replace with +
  if (cleaned.startsWith("00")) {
    cleaned = "+" + cleaned.slice(2);
  }

  // If already a proper E.164 string (starts with +), clean domestic trunk 0
  // only for specific known dial codes — then return as-is.
  if (cleaned.startsWith("+")) {
    const match = cleaned.match(/^(\+(?:1|44|49|33|61|65|971|966|974|968|965|973|60|64|27|353|41|81|977|880|94|230|39|34|46|47|45))0(\d+)$/);
    if (match) {
      return `${match[1]}${match[2]}`;
    }
    return cleaned;
  }

  // Bare 10-digit number with no country prefix → assume India only
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // If 11-12 digits starting with 91 → Indian mobile stored without +
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

/**
 * Generates all plausible database representations of a phone number
 * to ensure database queries (`where: { phone: { in: variations } }`)
 * successfully locate accounts regardless of whether they were stored
 * in strict E.164 (+91XXXXXXXXXX), domestic 10-digit (XXXXXXXXXX),
 * prefix-without-plus (91XXXXXXXXXX), or raw input.
 */
export function getPhoneLookupVariations(rawPhone: string): string[] {
  if (!rawPhone || !rawPhone.trim()) return [];

  const rawTrimmed = rawPhone.trim();
  const digitsOnly = rawPhone.replace(/\D/g, "");
  const normalized = normalizePhoneNumber(rawPhone);

  const variations = new Set<string>();

  if (rawTrimmed) variations.add(rawTrimmed);
  if (normalized) variations.add(normalized);
  if (digitsOnly) variations.add(digitsOnly);

  if (normalized.startsWith("+")) {
    variations.add(normalized.slice(1)); // e.g. 919876543210
  }

  // India numbers (+91)
  if (normalized.startsWith("+91") && normalized.length === 13) {
    const tenDigits = normalized.slice(3); // e.g. 9876543210
    variations.add(tenDigits);
    variations.add(`91${tenDigits}`);
    variations.add(`0${tenDigits}`);
    variations.add(`+91${tenDigits}`);
  } else if (/^\d{10}$/.test(digitsOnly)) {
    // 10 digits without prefix
    variations.add(digitsOnly);
    variations.add(`+91${digitsOnly}`);
    variations.add(`91${digitsOnly}`);
    variations.add(`0${digitsOnly}`);
  }

  return Array.from(variations).filter(Boolean);
}


