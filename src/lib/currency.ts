export type CurrencyCode =
  | "INR"
  | "USD"
  | "GBP"
  | "EUR"
  | "CAD"
  | "AUD"
  | "AED"
  | "SGD";

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  flag: string;
  countryName: string;
  /** Multiplier from 1 INR to this currency (1 INR * rateFromINR = target currency) */
  rateFromINR: number;
  /** 1 unit of this currency in INR */
  inrPerUnit: number;
  formatLocale: string;
  decimals: number;
  /** Multiplier from 1 USD to this target currency (1 USD * rateFromUSD = target currency) */
  rateFromUSD: number;
}

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  INR: {
    code: "INR",
    symbol: "₹",
    name: "Indian Rupee",
    flag: "🇮🇳",
    countryName: "India",
    rateFromINR: 1,
    inrPerUnit: 1,
    formatLocale: "en-IN",
    decimals: 0,
    rateFromUSD: 86.8,
  },
  USD: {
    code: "USD",
    symbol: "$",
    name: "US Dollar",
    flag: "🇺🇸",
    countryName: "United States & Global",
    rateFromINR: 0.01152, // 1 USD = ~86.80 INR
    inrPerUnit: 86.8,
    formatLocale: "en-US",
    decimals: 0,
    rateFromUSD: 1,
  },
  GBP: {
    code: "GBP",
    symbol: "£",
    name: "British Pound",
    flag: "🇬🇧",
    countryName: "United Kingdom",
    rateFromINR: 0.00889, // 1 GBP = ~112.50 INR
    inrPerUnit: 112.5,
    formatLocale: "en-GB",
    decimals: 0,
    rateFromUSD: 0.75, // Exactly 16 USD = 12 GBP per user specification
  },
  EUR: {
    code: "EUR",
    symbol: "€",
    name: "Euro",
    flag: "🇪🇺",
    countryName: "European Union",
    rateFromINR: 0.01053, // 1 EUR = ~95.00 INR
    inrPerUnit: 95.0,
    formatLocale: "de-DE",
    decimals: 0,
    rateFromUSD: 0.92,
  },
  CAD: {
    code: "CAD",
    symbol: "CA$",
    name: "Canadian Dollar",
    flag: "🇨🇦",
    countryName: "Canada",
    rateFromINR: 0.01613, // 1 CAD = ~62.00 INR
    inrPerUnit: 62.0,
    formatLocale: "en-CA",
    decimals: 0,
    rateFromUSD: 1.36,
  },
  AUD: {
    code: "AUD",
    symbol: "A$",
    name: "Australian Dollar",
    flag: "🇦🇺",
    countryName: "Australia",
    rateFromINR: 0.0177, // 1 AUD = ~56.50 INR
    inrPerUnit: 56.5,
    formatLocale: "en-AU",
    decimals: 0,
    rateFromUSD: 1.5,
  },
  AED: {
    code: "AED",
    symbol: "AED",
    name: "UAE Dirham",
    flag: "🇦🇪",
    countryName: "United Arab Emirates",
    rateFromINR: 0.04228, // 1 AED = ~23.65 INR
    inrPerUnit: 23.65,
    formatLocale: "en-AE",
    decimals: 0,
    rateFromUSD: 3.67,
  },
  SGD: {
    code: "SGD",
    symbol: "SGD",
    name: "Singapore Dollar",
    flag: "🇸🇬",
    countryName: "Singapore",
    rateFromINR: 0.01538, // 1 SGD = ~65.00 INR
    inrPerUnit: 65.0,
    formatLocale: "en-SG",
    decimals: 0,
    rateFromUSD: 1.32,
  },
};

export const CURRENCY_LIST: CurrencyConfig[] = Object.values(SUPPORTED_CURRENCIES);

export const DEFAULT_CURRENCY: CurrencyCode = "INR";
export const CURRENCY_COOKIE_NAME = "gandharva_currency";

/**
 * Maps an ISO 3166-1 alpha-2 country code to its appropriate platform currency.
 * Defaults to USD for any international visitor outside India, or country-specific when matched.
 */
export function countryCodeToCurrency(countryCode?: string | null): CurrencyCode {
  if (!countryCode) return DEFAULT_CURRENCY;
  const code = countryCode.toUpperCase().trim();

  if (code === "IN") return "INR";
  if (["US", "PR", "VI", "GU", "AS", "MP"].includes(code)) return "USD";
  if (code === "GB") return "GBP";
  if (code === "CA") return "CAD";
  if (code === "AU" || code === "NZ") return "AUD";
  if (["AE", "SA", "QA", "KW", "OM", "BH"].includes(code)) return "AED";
  if (code === "SG") return "SGD";
  if (
    [
      "AT", "BE", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT",
      "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"
    ].includes(code)
  ) {
    return "EUR";
  }

  // Any other international country defaults to USD
  return "USD";
}

/**
 * Client-side fallback detection using browser timezone and locale.
 */
export function detectBrowserCurrency(): CurrencyCode {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const lowerTz = tz.toLowerCase();

    if (lowerTz.includes("kolkata") || lowerTz.includes("calcutta") || lowerTz.includes("india")) {
      return "INR";
    }
    if (
      lowerTz.includes("america/new_york") ||
      lowerTz.includes("america/chicago") ||
      lowerTz.includes("america/denver") ||
      lowerTz.includes("america/los_angeles") ||
      lowerTz.includes("america/phoenix") ||
      lowerTz.includes("america/anchorage") ||
      lowerTz.includes("us/")
    ) {
      return "USD";
    }
    if (lowerTz.includes("europe/london") || lowerTz.includes("london") || lowerTz.includes("belfast")) {
      return "GBP";
    }
    if (
      lowerTz.includes("toronto") ||
      lowerTz.includes("vancouver") ||
      lowerTz.includes("edmonton") ||
      lowerTz.includes("montreal") ||
      lowerTz.includes("canada/")
    ) {
      return "CAD";
    }
    if (
      lowerTz.includes("sydney") ||
      lowerTz.includes("melbourne") ||
      lowerTz.includes("brisbane") ||
      lowerTz.includes("perth") ||
      lowerTz.includes("adelaide") ||
      lowerTz.includes("australia/")
    ) {
      return "AUD";
    }
    if (
      lowerTz.includes("dubai") ||
      lowerTz.includes("abu_dhabi") ||
      lowerTz.includes("muscat") ||
      lowerTz.includes("qatar") ||
      lowerTz.includes("riyadh")
    ) {
      return "AED";
    }
    if (lowerTz.includes("singapore")) {
      return "SGD";
    }
    if (
      lowerTz.includes("europe/paris") ||
      lowerTz.includes("europe/berlin") ||
      lowerTz.includes("europe/rome") ||
      lowerTz.includes("europe/madrid") ||
      lowerTz.includes("europe/amsterdam") ||
      lowerTz.includes("europe/brussels") ||
      lowerTz.includes("europe/vienna") ||
      lowerTz.includes("europe/")
    ) {
      return "EUR";
    }

    // Check navigator language
    if (typeof navigator !== "undefined" && navigator.language) {
      const lang = navigator.language.toLowerCase();
      if (lang === "en-in" || lang === "hi" || lang === "hi-in") return "INR";
      if (lang === "en-us") return "USD";
      if (lang === "en-gb") return "GBP";
      if (lang === "en-ca") return "CAD";
      if (lang === "en-au") return "AUD";
      if (lang === "en-sg") return "SGD";
    }

    return "USD";
  } catch {
    return "USD";
  }
}

export interface ConvertedPriceResult {
  currency: CurrencyCode;
  symbol: string;
  amount: number;
  formatted: string;
  originalINR: number;
  originalINRFormatted: string;
  isConverted: boolean;
  rateUsed: number;
}

/**
 * Converts price from stored INR minor units (paise) to target currency.
 * Returns formatted localized string and breakdown.
 */
export function convertCoursePrice(
  priceMinorUnitsINR: number,
  targetCurrency: CurrencyCode = "INR",
  options?: { roundToWhole?: boolean }
): ConvertedPriceResult {
  const inrRupees = priceMinorUnitsINR / 100;
  const config = SUPPORTED_CURRENCIES[targetCurrency] || SUPPORTED_CURRENCIES.INR;
  const originalINRFormatted = `₹${inrRupees.toLocaleString("en-IN")}`;

  if (targetCurrency === "INR") {
    return {
      currency: "INR",
      symbol: "₹",
      amount: inrRupees,
      formatted: originalINRFormatted,
      originalINR: inrRupees,
      originalINRFormatted,
      isConverted: false,
      rateUsed: 1,
    };
  }

  const rawConverted = inrRupees * config.rateFromINR;
  // Round to nearest integer for clean aesthetic (e.g. $58 instead of $57.60), or 2 decimals
  const shouldRound = options?.roundToWhole ?? true;
  const convertedAmount = shouldRound
    ? Math.round(rawConverted)
    : Math.round(rawConverted * 100) / 100;

  const formattedNumber = convertedAmount.toLocaleString(config.formatLocale, {
    minimumFractionDigits: shouldRound ? 0 : 2,
    maximumFractionDigits: shouldRound ? 0 : 2,
  });

  // Handle symbol prefix/suffix
  let formatted = `${config.symbol}${formattedNumber}`;
  if (config.code === "AED") {
    formatted = `AED ${formattedNumber}`;
  } else if (config.code === "SGD") {
    formatted = `${formattedNumber} SGD`;
  } else if (config.code === "CAD" || config.code === "AUD") {
    formatted = `${config.symbol}${formattedNumber} ${config.code}`;
  } else if (config.code === "USD") {
    formatted = `$${formattedNumber} USD`;
  }

  return {
    currency: config.code,
    symbol: config.symbol,
    amount: convertedAmount,
    formatted,
    originalINR: inrRupees,
    originalINRFormatted,
    isConverted: true,
    rateUsed: config.rateFromINR,
  };
}
