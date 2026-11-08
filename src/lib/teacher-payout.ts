/**
 * Gandharva Institutional Teacher Payout Calculation Engine
 *
 * Rules:
 * - 9:00 AM to 9:00 PM IST (Day Shift): Default ₹300 (30,000 paise)
 * - 9:00 PM to 9:00 AM IST (Night Shift): Default ₹500 (50,000 paise)
 * - Rates can be customized per faculty profile by administrator.
 * - When lessons are scheduled, the payout record automatically reflects the lesson start timing.
 */

export const DEFAULT_DAY_PAYOUT_PAISE = 30000; // ₹300
export const DEFAULT_NIGHT_PAYOUT_PAISE = 50000; // ₹500

export type PayoutTier = "DAY" | "NIGHT";

export interface PayoutTierInfo {
  tier: PayoutTier;
  label: string;
  window: string;
  defaultRupees: number;
  isDay: boolean;
}

/**
 * Determines whether a date/time falls within the Day window (9:00 AM to 9:00 PM IST).
 * All day/night boundaries operate in India Standard Time (IST / Asia/Kolkata).
 */
export function isDayTimeSlot(date: Date | string, timezone = "Asia/Kolkata"): boolean {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return true;

  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(d);

    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const totalMinutes = hour * 60 + minute;

    // 9:00 AM = 9 * 60 = 540 minutes
    // 9:00 PM = 21 * 60 = 1260 minutes
    // Day: 09:00 <= time < 21:00
    return totalMinutes >= 540 && totalMinutes < 1260;
  } catch {
    // Fallback if timezone conversion fails
    const utcHours = d.getUTCHours();
    const utcMins = d.getUTCMinutes();
    const istMinutes = (utcHours * 60 + utcMins + 330) % 1440; // +5:30
    return istMinutes >= 540 && istMinutes < 1260;
  }
}

/**
 * Returns metadata describing the payout shift (Day vs Night) for display in badges and cards.
 */
export function getPayoutTierInfo(date: Date | string, timezone = "Asia/Kolkata"): PayoutTierInfo {
  const isDay = isDayTimeSlot(date, timezone);
  if (isDay) {
    return {
      tier: "DAY",
      label: "Day Shift",
      window: "9:00 AM – 9:00 PM IST",
      defaultRupees: 300,
      isDay: true,
    };
  }

  return {
    tier: "NIGHT",
    label: "Night Shift",
    window: "9:00 PM – 9:00 AM IST",
    defaultRupees: 500,
    isDay: false,
  };
}

/**
 * Calculates the remuneration payout (in minor units / paise) for a lesson
 * based on its scheduled start time and the teacher's profile payout rates.
 * Free trials carry NO remuneration (returns 0).
 */
export function calculateLessonPayoutMinor(
  startsAt: Date | string,
  teacherProfile?: {
    payoutDayRate?: number | null;
    payoutNightRate?: number | null;
    payoutPerSession?: number | null;
  } | null,
  lessonSource?: string | null
): number {
  if (lessonSource === "TRIAL") {
    return 0;
  }

  const isDay = isDayTimeSlot(startsAt);

  if (isDay) {
    if (
      typeof teacherProfile?.payoutDayRate === "number" &&
      teacherProfile.payoutDayRate > 0
    ) {
      return teacherProfile.payoutDayRate;
    }
    return DEFAULT_DAY_PAYOUT_PAISE;
  } else {
    if (
      typeof teacherProfile?.payoutNightRate === "number" &&
      teacherProfile.payoutNightRate > 0
    ) {
      return teacherProfile.payoutNightRate;
    }
    return DEFAULT_NIGHT_PAYOUT_PAISE;
  }
}

