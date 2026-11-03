"use client";

import { useState, useRef, useEffect } from "react";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCY_LIST, CurrencyCode } from "@/lib/currency";
import { Globe, ChevronDown, Check } from "lucide-react";

interface CurrencySelectorProps {
  variant?: "nav" | "landing" | "compact" | "badge";
  className?: string;
}

export function CurrencySelector({
  variant = "nav",
  className = "",
}: CurrencySelectorProps) {
  const { currency, setCurrency, currencyConfig } = useCurrency();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (code: CurrencyCode) => {
    setCurrency(code);
    setIsOpen(false);
  };

  // 1. Landing header dark variant
  if (variant === "landing") {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer btn-tactile"
          title="Select display currency"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="text-sm leading-none">{currencyConfig.flag}</span>
          <span className="tracking-wide">{currencyConfig.code}</span>
          {currencyConfig.symbol !== currencyConfig.code && (
            <span className="text-white/60 text-[11px]">({currencyConfig.symbol})</span>
          )}
          <ChevronDown
            className={`w-3 h-3 text-white/70 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white text-heading shadow-2xl border border-border-default/80 p-1.5 z-50 animate-fade-in-up font-sans">
            <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-body-muted border-b border-border-subtle mb-1">
              Select Currency
            </div>
            <div className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-thin">
              {CURRENCY_LIST.map((item) => {
                const isSelected = item.code === currency;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleSelect(item.code)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-heading hover:bg-bg-alt/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{item.flag}</span>
                      <div className="truncate">
                        <span className="font-semibold">{item.code}</span>
                        <span className="text-body-muted text-[11px] ml-1.5">
                          {item.name}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 px-2.5 py-1 text-[10px] text-body-muted/80 border-t border-border-subtle bg-bg-alt/30 rounded-lg">
              International cards supported
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. Platform sticky Navbar variant (dark primary background)
  if (variant === "nav") {
    return (
      <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-all shadow-xs cursor-pointer btn-tactile whitespace-nowrap"
          title="Select display currency"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="text-xs leading-none">{currencyConfig.flag}</span>
          <span className="font-bold tracking-wide">{currencyConfig.code}</span>
          <ChevronDown
            className={`w-3 h-3 text-white/70 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-1.5 w-52 rounded-2xl bg-white text-heading shadow-2xl border border-border-default/80 p-1.5 z-50 animate-fade-in-up font-sans">
            <div className="px-2.5 py-1.5 text-[10px] uppercase font-bold tracking-wider text-body-muted border-b border-border-subtle mb-1 flex items-center justify-between">
              <span>Display Currency</span>
              <Globe className="w-3 h-3 text-accent" />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-0.5 scrollbar-thin">
              {CURRENCY_LIST.map((item) => {
                const isSelected = item.code === currency;
                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleSelect(item.code)}
                    className={`w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs transition-colors cursor-pointer text-left ${
                      isSelected
                        ? "bg-primary/10 text-primary font-bold"
                        : "text-heading hover:bg-bg-alt/70"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-base leading-none">{item.flag}</span>
                      <div className="truncate">
                        <span className="font-semibold">{item.code}</span>
                        <span className="text-body-muted text-[11px] ml-1.5">
                          {item.name}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-primary shrink-0 ml-1.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Compact badge variant (for filters or next to prices)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-bg-alt/70 hover:bg-bg-alt border border-border-default text-heading text-xs font-semibold transition-all cursor-pointer shadow-2xs hover:border-primary/30"
        title="Change currency"
      >
        <span>{currencyConfig.flag}</span>
        <span className="font-bold">{currencyConfig.code}</span>
        <ChevronDown
          className={`w-3 h-3 text-body-muted transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1 w-48 rounded-2xl bg-white shadow-xl border border-border-default p-1 z-50 animate-fade-in-up">
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {CURRENCY_LIST.map((item) => {
              const isSelected = item.code === currency;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? "bg-primary/10 text-primary font-bold"
                      : "text-heading hover:bg-bg-alt/60"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span>{item.flag}</span>
                    <span>{item.code}</span>
                    {item.symbol !== item.code && (
                      <span className="text-[10px] text-body-muted">({item.symbol})</span>
                    )}
                  </span>
                  {isSelected && (
                    <Check className="w-3 h-3 text-primary shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
