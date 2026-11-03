import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";

/**
 * Standard IANA identifier for Indian Standard Time (IST, UTC+05:30).
 */
export const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Format a UTC Date instant into Indian Standard Time (IST).
 * Standardized across Admin dashboard and notifications.
 * Defaults to "Nov 4, 2026 at 2:30 PM IST".
 */
export function formatToIST(
  dateInput: Date | string | number | null | undefined,
  formatStr = "MMM d, yyyy 'at' h:mm a 'IST'"
): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  try {
    return formatInTimeZone(d, IST_TIMEZONE, formatStr);
  } catch {
    return "";
  }
}

/**
 * Format date part only in IST (e.g. "Nov 4, 2026" or "Wed, Nov 4, 2026").
 */
export function formatISTDateOnly(
  dateInput: Date | string | number | null | undefined,
  formatStr = "MMM d, yyyy"
): string {
  return formatToIST(dateInput, formatStr);
}

/**
 * Format time part only in IST with IST suffix (e.g. "2:30 PM IST").
 */
export function formatISTTimeOnly(
  dateInput: Date | string | number | null | undefined,
  withSuffix = true
): string {
  const pattern = withSuffix ? "h:mm a 'IST'" : "h:mm a";
  return formatToIST(dateInput, pattern);
}

/**
 * Convert a Date/ISO to a wall-clock local input string in IST for datetime pickers ("yyyy-MM-dd'T'HH:mm").
 */
export function toISTInputString(
  dateInput: Date | string | number | null | undefined
): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "object" && dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return "";
  try {
    return formatInTimeZone(d, IST_TIMEZONE, "yyyy-MM-dd'T'HH:mm");
  } catch {
    return "";
  }
}

/**
 * Parse an IST datetime-local input string ("yyyy-MM-dd'T'HH:mm" or ISO) into a proper UTC Date object.
 */
export function fromISTInputToUtc(istDateTimeStr: string): Date {
  if (!istDateTimeStr) return new Date();
  try {
    const trimmed = istDateTimeStr.trim();
    // If it already ends with Z or has an explicit offset, parse directly or via fromZonedTime
    if (trimmed.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(trimmed)) {
      return new Date(trimmed);
    }
    return fromZonedTime(trimmed, IST_TIMEZONE);
  } catch {
    return new Date(istDateTimeStr);
  }
}

/**
 * Format a UTC Date instant in the viewer's timezone.
 * Defaults to readable time with timezone abbreviation (e.g., "2:00 PM EDT").
 */
export function formatInViewerTimezone(
  date: Date,
  timezone: string,
  formatStr = "h:mm a zzz",
): string {
  try {
    return formatInTimeZone(date, timezone, formatStr);
  } catch {
    // Fallback if invalid timezone passed
    return formatInTimeZone(date, "UTC", formatStr);
  }
}

/**
 * Project a teacher's local slot (date string + minute of day) to a UTC Date.
 * @param dateStr Date in YYYY-MM-DD format (in the teacher's timezone)
 * @param minuteOfDay Minutes from midnight (e.g. 540 = 9:00 AM, 840 = 2:00 PM)
 * @param teacherTimezone Teacher's IANA timezone (e.g. "America/New_York", "Europe/Berlin")
 */
export function projectTeacherSlotToUtc(
  dateStr: string,
  minuteOfDay: number,
  teacherTimezone: string,
): Date {
  const hours = Math.floor(minuteOfDay / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (minuteOfDay % 60).toString().padStart(2, "0");

  // Construct ISO-like local wall-clock string
  const localDateTimeStr = `${dateStr}T${hours}:${minutes}:00`;

  // Convert wall clock time in teacher's timezone to UTC Date
  return fromZonedTime(localDateTimeStr, teacherTimezone);
}

/**
 * Get the short timezone abbreviation for a given date instant and IANA timezone.
 * e.g., "EDT", "EST", "CET", "CEST", "IST".
 */
export function getTimezoneAbbr(date: Date, timezone: string): string {
  try {
    return formatInTimeZone(date, timezone, "zzz");
  } catch {
    return "UTC";
  }
}

/**
 * Get the current date in YYYY-MM-DD format in a specific timezone.
 */
export function getLocalDateString(date: Date, timezone: string): string {
  try {
    return formatInTimeZone(date, timezone, "yyyy-MM-dd");
  } catch {
    return formatInTimeZone(date, "UTC", "yyyy-MM-dd");
  }
}

/**
 * Validate whether a timezone string is a valid IANA timezone identifier.
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz.trim() });
    return true;
  } catch {
    return false;
  }
}

export interface TimezoneOption {
  value: string;
  label: string;
  group: string;
}

export const POPULAR_TIMEZONES: TimezoneOption[] = [
  { value: "Asia/Kolkata", label: "India Standard Time (IST, GMT+5:30)", group: "Asia & Pacific" },
  { value: "America/New_York", label: "US Eastern (EST/EDT, New York)", group: "Americas" },
  { value: "America/Chicago", label: "US Central (CST/CDT, Chicago)", group: "Americas" },
  { value: "America/Denver", label: "US Mountain (MST/MDT, Denver)", group: "Americas" },
  { value: "America/Los_Angeles", label: "US Pacific (PST/PDT, Los Angeles)", group: "Americas" },
  { value: "Europe/London", label: "UK / London (GMT/BST)", group: "Europe" },
  { value: "Europe/Paris", label: "Central Europe (CET/CEST, Paris)", group: "Europe" },
  { value: "Europe/Berlin", label: "Germany (CET/CEST, Berlin)", group: "Europe" },
  { value: "Asia/Dubai", label: "Gulf / Dubai (GST, GMT+4)", group: "Middle East" },
  { value: "Asia/Singapore", label: "Singapore / Perth (SGT, GMT+8)", group: "Asia & Pacific" },
  { value: "Asia/Tokyo", label: "Japan / Tokyo (JST, GMT+9)", group: "Asia & Pacific" },
  { value: "Australia/Sydney", label: "Australia / Sydney (AEST/AEDT)", group: "Asia & Pacific" },
  { value: "Pacific/Auckland", label: "New Zealand (NZST/NZDT)", group: "Asia & Pacific" },
  { value: "UTC", label: "Universal Coordinated Time (UTC)", group: "Global" },
];

/**
 * Deterministically format a date to "MMM d, yyyy" using UTC to prevent SSR/hydration mismatch.
 */
export function formatDeterministicDate(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}


