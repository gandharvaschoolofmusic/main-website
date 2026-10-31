"use client";

import { useCurrency } from "@/context/CurrencyContext";
import { getCourseTierPricing, CourseTierLevel, CoursePricingMetadata } from "@/lib/pricing-tiers";

interface PriceDisplayProps {
  priceMinorUnits?: number;
  level?: CourseTierLevel | string;
  sessionCount?: number;
  description?: string | null;
  pricingMetadata?: CoursePricingMetadata | null;
  size?: "xs" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";
  showOriginalStrike?: boolean;
  showOriginalINR?: boolean;
  showPerSessionBadge?: boolean;
  showDiscountBadge?: boolean;
  className?: string;
  subtextClassName?: string;
}

export function PriceDisplay({
  priceMinorUnits,
  level,
  sessionCount = 24,
  description,
  pricingMetadata,
  size = "lg",
  showOriginalStrike = true,
  showOriginalINR = false,
  showPerSessionBadge = false,
  showDiscountBadge = false,
  className = "",
  subtextClassName = "",
}: PriceDisplayProps) {
  const { convertPrice, isInternational, currency } = useCurrency();

  // Calculate pricing breakdown taking into account level, custom rates, priceMinorUnits, and discount
  const tierPricing = (level || priceMinorUnits !== undefined || description || pricingMetadata)
    ? getCourseTierPricing({
        level,
        sessionCount,
        currency,
        priceMinorUnits,
        description,
        pricingMetadata,
      })
    : null;

  // Fallback if level not provided
  const converted = priceMinorUnits !== undefined
    ? convertPrice(priceMinorUnits)
    : null;

  const sizeClasses: Record<string, string> = {
    xs: "text-xs font-semibold",
    sm: "text-sm font-semibold",
    md: "text-base font-bold",
    lg: "text-xl font-bold font-serif",
    xl: "text-2xl font-bold font-serif",
    "2xl": "text-3xl font-bold font-serif",
    "3xl": "text-4xl font-bold font-serif",
  };

  const selectedSize = sizeClasses[size] || sizeClasses.lg;

  // Amount & formatting values
  const mainFormatted = tierPricing
    ? tierPricing.formattedTotal
    : converted?.formatted || "₹0";

  const originalFormatted = tierPricing?.formattedOriginalTotal;
  const isDiscounted = tierPricing?.isDiscounted ?? false;
  const discountPercent = tierPricing?.discountPercent ?? 0;

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className="flex items-baseline gap-2 flex-wrap">
        {/* Strikethrough Original Price */}
        {showOriginalStrike && isDiscounted && originalFormatted && (
          <span className="text-body-muted/70 line-through text-xs sm:text-sm font-normal tabular-nums">
            {originalFormatted}
          </span>
        )}

        {/* Highlighted Offer Price */}
        <span className={`tabular-nums text-heading ${selectedSize}`}>
          {mainFormatted}
        </span>

        {/* Discount Badge */}
        {showDiscountBadge && isDiscounted && (
          <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            {discountPercent}% OFF
          </span>
        )}

        {/* Optional conversion breakdown */}
        {isInternational && showOriginalINR && converted && (
          <span
            className={`text-[11px] text-body-muted tabular-nums ${subtextClassName}`}
            title={`Equivalent to ${converted.originalINRFormatted} INR`}
          >
            (~{converted.originalINRFormatted})
          </span>
        )}
      </div>

      {/* Per Session Rate info if requested */}
      {showPerSessionBadge && tierPricing && (
        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-numeric text-accent-dark font-semibold">
          {tierPricing.isDiscounted && (
            <span className="line-through text-body-muted font-normal">
              {tierPricing.formattedOriginalPerSession}
            </span>
          )}
          <span>{tierPricing.formattedPerSession} / session</span>
        </div>
      )}

      {isInternational && (
        <span className="text-[10px] text-accent-dark font-medium">
          Prices localized to {currency}
        </span>
      )}
    </div>
  );
}
