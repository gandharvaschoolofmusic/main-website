import { CurrencyCode, SUPPORTED_CURRENCIES } from "./currency";

export type CourseTierLevel = "FOUNDATION" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED";

export interface TierPriceDefinition {
  inr: {
    offer: number; // ₹ per session
    original: number; // ₹ per session
  };
  usd: {
    offer: number; // $ per session
    original: number; // $ per session
  };
}

/**
 * Official platform base rates per session:
 * 
 * India (INR):
 * - Foundation & Beginners: ₹800 (was ₹900)
 * - Intermediate: ₹1,000 (was ₹1,200)
 * - Advanced: ₹1,250 (was ₹1,500)
 * 
 * Abroad (USD Base):
 * - Foundation & Beginners: $16 (was $18) -> In UK: 12 GBP (was 14 GBP)
 * - Intermediate: $21 (was $25) -> In UK: 16 GBP (was 19 GBP)
 * - Advanced: $28 (was $35) -> In UK: 21 GBP (was 26 GBP)
 */
export const LEVEL_PER_SESSION_RATES: Record<CourseTierLevel, TierPriceDefinition> = {
  FOUNDATION: {
    inr: { offer: 800, original: 900 },
    usd: { offer: 16, original: 18 },
  },
  BEGINNER: {
    inr: { offer: 800, original: 900 },
    usd: { offer: 16, original: 18 },
  },
  INTERMEDIATE: {
    inr: { offer: 1000, original: 1200 },
    usd: { offer: 21, original: 25 },
  },
  ADVANCED: {
    inr: { offer: 1250, original: 1500 },
    usd: { offer: 28, original: 35 },
  },
};

export interface CoursePricingBreakdown {
  level: CourseTierLevel;
  currency: CurrencyCode;
  symbol: string;
  sessionCount: number;

  // Per session
  perSessionOffer: number;
  perSessionOriginal: number;
  formattedPerSession: string;
  formattedOriginalPerSession: string;

  // Total
  totalOffer: number;
  totalOriginal: number;
  formattedTotal: string;
  formattedOriginalTotal: string;

  // Discount & Savings
  discountPercent: number;
  savingsTotal: number;
  formattedSavingsTotal: string;
  isDiscounted: boolean;
  isInternational: boolean;
}

export function normalizeCourseLevel(level?: string | null): CourseTierLevel {
  if (!level) return "BEGINNER";
  const upper = String(level).toUpperCase().trim();
  if (upper.includes("FOUNDATION")) return "FOUNDATION";
  if (upper.includes("INTERMEDIATE")) return "INTERMEDIATE";
  if (upper.includes("ADVANCE")) return "ADVANCED";
  return "BEGINNER";
}

export interface CoursePricingRates {
  INR: number;
  SA_UAE: number;
  USD: number;
  CAD: number;
  GBP: number;
  EUR: number;
  SGD: number;
}

export interface CoursePricingMetadata {
  discountPercent: number;
  rates: CoursePricingRates;
}

export function parsePricingFromDescription(description?: string | null): CoursePricingMetadata | null {
  if (!description) return null;
  const match = description.match(/<!--\s*pricing:\s*([\s\S]*?)\s*-->/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[1]);
    if (parsed && parsed.rates) {
      return {
        discountPercent: typeof parsed.discountPercent === "number" ? parsed.discountPercent : 0,
        rates: {
          INR: Number(parsed.rates.INR) || 800,
          SA_UAE: Number(parsed.rates.SA_UAE) || Number(parsed.rates.INR) || 800,
          USD: Number(parsed.rates.USD) || 16,
          CAD: Number(parsed.rates.CAD) || 22,
          GBP: Number(parsed.rates.GBP) || 12,
          EUR: Number(parsed.rates.EUR) || 15,
          SGD: Number(parsed.rates.SGD) || 21,
        },
      };
    }
  } catch {}
  return null;
}

export function cleanDescriptionText(description?: string | null): string {
  if (!description) return "";
  return description.replace(/\s*<!--\s*pricing:[\s\S]*?-->/g, "").trim();
}

/**
 * Calculates official localized pricing breakdown for any course level and session count,
 * taking into account custom course rates, actual priceMinorUnits, and admin promotional discounts.
 */
export function getCourseTierPricing({
  level,
  sessionCount = 24,
  currency = "INR",
  priceMinorUnits,
  description,
  pricingMetadata,
}: {
  level?: string | null;
  sessionCount?: number;
  currency?: CurrencyCode;
  priceMinorUnits?: number;
  description?: string | null;
  pricingMetadata?: CoursePricingMetadata | null;
}): CoursePricingBreakdown {
  const normLevel = normalizeCourseLevel(level);
  const tierDef = LEVEL_PER_SESSION_RATES[normLevel];
  const config = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES.INR;
  const count = sessionCount > 0 ? sessionCount : 24;

  const meta = pricingMetadata || parsePricingFromDescription(description);

  let perSessionOffer = 0;
  let perSessionOriginal = 0;
  let totalOffer = 0;
  let totalOriginal = 0;
  let discountPercent = 0;

  if (meta) {
    discountPercent = meta.discountPercent || 0;

    // Per-session rate based on viewer currency
    if (currency === "INR") {
      perSessionOriginal = meta.rates.INR;
    } else if (currency === "USD") {
      perSessionOriginal = meta.rates.USD;
    } else if (currency === "CAD") {
      perSessionOriginal = meta.rates.CAD;
    } else if (currency === "GBP") {
      perSessionOriginal = meta.rates.GBP;
    } else if (currency === "EUR") {
      perSessionOriginal = meta.rates.EUR;
    } else if (currency === "SGD") {
      perSessionOriginal = meta.rates.SGD;
    } else {
      const rate = config.rateFromUSD ?? 1;
      perSessionOriginal = Math.round(meta.rates.USD * rate);
    }

    totalOriginal = perSessionOriginal * count;

    if (discountPercent > 0) {
      if (currency === "INR" && priceMinorUnits && priceMinorUnits > 0) {
        totalOffer = Math.round(priceMinorUnits / 100);
      } else {
        totalOffer = Math.max(0, Math.round(totalOriginal * (1 - discountPercent / 100)));
      }
      perSessionOffer = Math.max(1, Math.round(totalOffer / count));
    } else {
      if (currency === "INR" && priceMinorUnits && priceMinorUnits > 0) {
        totalOffer = Math.round(priceMinorUnits / 100);
        perSessionOffer = Math.max(1, Math.round(totalOffer / count));
        totalOriginal = totalOffer;
        perSessionOriginal = perSessionOffer;
      } else {
        totalOffer = totalOriginal;
        perSessionOffer = perSessionOriginal;
      }
    }
  } else if (priceMinorUnits !== undefined && priceMinorUnits > 0) {
    const inrOfferTotal = Math.round(priceMinorUnits / 100);
    const inrBaseTotal = tierDef.inr.offer * count;

    if (currency === "INR") {
      totalOffer = inrOfferTotal;
      perSessionOffer = Math.round(totalOffer / count);
      if (totalOffer < inrBaseTotal) {
        totalOriginal = inrBaseTotal;
        perSessionOriginal = tierDef.inr.offer;
        discountPercent = Math.round(((totalOriginal - totalOffer) / totalOriginal) * 100);
      } else {
        totalOriginal = totalOffer;
        perSessionOriginal = perSessionOffer;
      }
    } else {
      const rate = config.rateFromUSD ?? 1;
      perSessionOffer = Math.round(tierDef.usd.offer * rate);
      perSessionOriginal = Math.round(tierDef.usd.original * rate);
      totalOriginal = perSessionOriginal * count;
      totalOffer = Math.round((inrOfferTotal / (tierDef.inr.offer * count)) * totalOriginal);
      if (totalOffer < totalOriginal) {
        discountPercent = Math.round(((totalOriginal - totalOffer) / totalOriginal) * 100);
      }
    }
  } else {
    // Default fallback to tier definition table
    if (currency === "INR") {
      perSessionOffer = tierDef.inr.offer;
      perSessionOriginal = tierDef.inr.original;
    } else if (currency === "USD") {
      perSessionOffer = tierDef.usd.offer;
      perSessionOriginal = tierDef.usd.original;
    } else {
      const rate = config.rateFromUSD ?? 1;
      perSessionOffer = Math.round(tierDef.usd.offer * rate);
      perSessionOriginal = Math.round(tierDef.usd.original * rate);
    }

    totalOffer = perSessionOffer * count;
    totalOriginal = perSessionOriginal * count;
    discountPercent =
      perSessionOriginal > perSessionOffer
        ? Math.round(((perSessionOriginal - perSessionOffer) / perSessionOriginal) * 100)
        : 0;
  }

  const savingsTotal = Math.max(0, totalOriginal - totalOffer);
  const isDiscounted = discountPercent > 0 && totalOriginal > totalOffer;

  // Helper for formatting
  const formatAmount = (amt: number): string => {
    const formattedNum = amt.toLocaleString(config.formatLocale, {
      maximumFractionDigits: 0,
    });
    if (config.code === "AED") {
      return `AED ${formattedNum}`;
    }
    if (config.code === "SGD") {
      return `${formattedNum} SGD`;
    }
    if (config.code === "CAD" || config.code === "AUD") {
      return `${config.symbol}${formattedNum} ${config.code}`;
    }
    return `${config.symbol}${formattedNum}`;
  };

  return {
    level: normLevel,
    currency: config.code,
    symbol: config.symbol,
    sessionCount: count,
    perSessionOffer,
    perSessionOriginal,
    formattedPerSession: formatAmount(perSessionOffer),
    formattedOriginalPerSession: formatAmount(perSessionOriginal),
    totalOffer,
    totalOriginal,
    formattedTotal: formatAmount(totalOffer),
    formattedOriginalTotal: formatAmount(totalOriginal),
    discountPercent,
    savingsTotal,
    formattedSavingsTotal: formatAmount(savingsTotal),
    isDiscounted,
    isInternational: currency !== "INR",
  };
}
