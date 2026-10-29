"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays,
  Clock,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
} from "lucide-react";

export interface DateTimePickerProps {
  value?: string; // ISO or "YYYY-MM-DDTHH:mm"
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  placeholder?: string;
  minDate?: string;
  maxDate?: string;
  className?: string;
  disabled?: boolean;
  compact?: boolean;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseDateTime(val?: string): {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
} {
  const d = val ? new Date(val) : new Date();
  if (isNaN(d.getTime())) {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
      hours: now.getHours(),
      minutes: now.getMinutes(),
    };
  }
  return {
    year: d.getFullYear(),
    month: d.getMonth(),
    day: d.getDate(),
    hours: d.getHours(),
    minutes: d.getMinutes(),
  };
}

function formatToInputString(
  year: number,
  month: number,
  day: number,
  hours: number,
  minutes: number
): string {
  return `${year}-${pad2(month + 1)}-${pad2(day)}T${pad2(hours)}:${pad2(minutes)}`;
}

export function DateTimePicker({
  value,
  onChange,
  name,
  required = false,
  placeholder = "Select date & time",
  className = "",
  disabled = false,
  compact = false,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Uncontrolled state fallback
  const [internalValue, setInternalValue] = useState<string>(() => {
    return value ?? new Date(Date.now() + 86400000).toISOString().slice(0, 16);
  });

  const effectiveValue = value !== undefined ? value : internalValue;

  const handleUpdate = (newVal: string) => {
    setInternalValue(newVal);
    onChange?.(newVal);
  };

  // Parsed components of current value
  const parsed = useMemo(() => parseDateTime(effectiveValue), [effectiveValue]);

  // Calendar browse view month/year
  const [viewYear, setViewYear] = useState<number>(parsed.year);
  const [viewMonth, setViewMonth] = useState<number>(parsed.month);

  useEffect(() => {
    if (isOpen) {
      setViewYear(parsed.year);
      setViewMonth(parsed.month);
    }
  }, [isOpen, parsed.year, parsed.month]);

  // Positioning state for Portaled Popover
  const [popoverCoords, setPopoverCoords] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const updateCoords = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const popoverWidth = 430;
      const popoverHeight = 280;

      let top = rect.bottom + 6;
      let left = rect.left;

      // Flip above if overflowing window bottom
      if (
        rect.bottom + popoverHeight > window.innerHeight &&
        rect.top - popoverHeight > 0
      ) {
        top = rect.top - popoverHeight - 6;
      }

      // Constrain within viewport horizontally
      if (left + popoverWidth > window.innerWidth - 12) {
        left = Math.max(12, window.innerWidth - popoverWidth - 12);
      }

      setPopoverCoords({ top, left });
    };

    updateCoords();
    window.addEventListener("scroll", updateCoords, true);
    window.addEventListener("resize", updateCoords);

    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        popoverRef.current &&
        !popoverRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Clean, non-truncating trigger format: e.g. "07 Nov 2026, 02:30 PM"
  const formattedDisplay = useMemo(() => {
    if (!effectiveValue) return placeholder;
    const d = new Date(effectiveValue);
    if (isNaN(d.getTime())) return placeholder;

    const day = pad2(d.getDate());
    const month = d.toLocaleDateString("en-US", { month: "short" });
    const year = d.getFullYear();

    let hours = d.getHours();
    const minutes = pad2(d.getMinutes());
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;

    return `${day} ${month} ${year}, ${pad2(hours)}:${minutes} ${ampm}`;
  }, [effectiveValue, placeholder]);

  // Month navigation
  const handlePrevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Select day
  const handleSelectDay = (day: number, monthOffset = 0) => {
    const targetDate = new Date(viewYear, viewMonth + monthOffset, day);
    const newStr = formatToInputString(
      targetDate.getFullYear(),
      targetDate.getMonth(),
      targetDate.getDate(),
      parsed.hours,
      parsed.minutes
    );
    handleUpdate(newStr);
    if (monthOffset !== 0) {
      setViewYear(targetDate.getFullYear());
      setViewMonth(targetDate.getMonth());
    }
  };

  // Time controls
  const isPm = parsed.hours >= 12;
  const currentHour12 = parsed.hours % 12 || 12;

  const handleHourChange = (newHour12: number) => {
    let finalHour24 = newHour12 % 12;
    if (isPm) finalHour24 += 12;
    const newStr = formatToInputString(
      parsed.year,
      parsed.month,
      parsed.day,
      finalHour24,
      parsed.minutes
    );
    handleUpdate(newStr);
  };

  const handleMinuteChange = (newMin: number) => {
    const newStr = formatToInputString(
      parsed.year,
      parsed.month,
      parsed.day,
      parsed.hours,
      newMin
    );
    handleUpdate(newStr);
  };

  const handleAmPmToggle = (targetPm: boolean) => {
    if (targetPm === isPm) return;
    const newHour24 = targetPm ? (parsed.hours % 12) + 12 : parsed.hours % 12;
    const newStr = formatToInputString(
      parsed.year,
      parsed.month,
      parsed.day,
      newHour24,
      parsed.minutes
    );
    handleUpdate(newStr);
  };

  const handleSetNow = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    handleUpdate(
      formatToInputString(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        now.getHours(),
        now.getMinutes()
      )
    );
  };

  // Calendar cells computation (35 cells max to keep height ultra compact)
  const calendarCells = useMemo(() => {
    const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();
    const daysInCurrentMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: {
      day: number;
      monthOffset: number;
      isSelected: boolean;
      isToday: boolean;
    }[] = [];

    const today = new Date();
    const isCurrentViewTodayMonth =
      today.getFullYear() === viewYear && today.getMonth() === viewMonth;
    const isSelectedMonth =
      parsed.year === viewYear && parsed.month === viewMonth;

    // Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        monthOffset: -1,
        isSelected: false,
        isToday: false,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const isSelected = isSelectedMonth && parsed.day === d;
      const isToday = isCurrentViewTodayMonth && today.getDate() === d;
      cells.push({
        day: d,
        monthOffset: 0,
        isSelected,
        isToday,
      });
    }

    // Fill remaining to exactly 35 or 42 cells
    const targetLength = cells.length > 35 ? 42 : 35;
    const remaining = targetLength - cells.length;
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        monthOffset: 1,
        isSelected: false,
        isToday: false,
      });
    }

    return cells;
  }, [viewYear, viewMonth, parsed.year, parsed.month, parsed.day]);

  return (
    <div className={`relative inline-block ${className}`}>
      {name && (
        <input
          type="hidden"
          name={name}
          value={effectiveValue}
          required={required}
        />
      )}

      {/* Trigger Button */}
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full flex items-center justify-between gap-2 rounded-xl border transition-all text-left outline-none cursor-pointer select-none active:scale-[0.98] ${
          compact ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs"
        } ${
          isOpen
            ? "border-[#3C096C] ring-2 ring-[#3C096C]/10 bg-white shadow-xs"
            : "border-neutral-200/90 hover:border-purple-300 bg-white hover:bg-neutral-50/50 shadow-2xs"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <CalendarDays className="w-3.5 h-3.5 text-[#3C096C] shrink-0" />
          <span className="font-semibold text-heading truncate font-numeric">
            {formattedDisplay}
          </span>
        </div>
        <Clock className="w-3 h-3 text-body/40 shrink-0" />
      </button>

      {/* Portaled Side-by-Side Floating Popover (Never clipped by overflow) */}
      {isOpen &&
        mounted &&
        createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "fixed",
              top: `${popoverCoords.top}px`,
              left: `${popoverCoords.left}px`,
              zIndex: 9999,
              boxShadow:
                "0 20px 45px -10px rgba(60, 9, 108, 0.16), 0 0 1px 1px rgba(0, 0, 0, 0.06)",
            }}
            className="w-[420px] max-w-[95vw] rounded-2xl bg-white border border-neutral-200/90 p-3 text-heading font-sans transition-all duration-150 animate-in fade-in zoom-in-95"
          >
            {/* Side-by-side horizontal container */}
            <div className="flex items-stretch gap-3">
              {/* LEFT COLUMN: Calendar Month & Days */}
              <div className="w-[240px] shrink-0">
                {/* Month & Navigation */}
                <div className="flex items-center justify-between mb-1.5 px-0.5">
                  <span className="font-serif font-bold text-xs text-heading tracking-tight">
                    {MONTH_NAMES[viewMonth]}{" "}
                    <span className="font-numeric text-body/60 text-[11px] font-normal">
                      {viewYear}
                    </span>
                  </span>
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg hover:bg-neutral-100 text-body hover:text-heading transition-colors active:scale-90 cursor-pointer"
                      title="Previous month"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg hover:bg-neutral-100 text-body hover:text-heading transition-colors active:scale-90 cursor-pointer"
                      title="Next month"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Weekday Labels */}
                <div className="grid grid-cols-7 gap-0.5 mb-1 text-center font-bold text-[9px] text-body/45 uppercase tracking-wider">
                  {WEEKDAYS.map((wd) => (
                    <div key={wd} className="py-0.5">
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Day Cells Grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {calendarCells.map((cell, idx) => {
                    const isOtherMonth = cell.monthOffset !== 0;

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() =>
                          handleSelectDay(cell.day, cell.monthOffset)
                        }
                        className={`h-7 w-7 mx-auto rounded-lg text-[11px] font-semibold font-numeric flex items-center justify-center transition-all cursor-pointer select-none active:scale-90 ${
                          cell.isSelected
                            ? "bg-[#3C096C] text-white shadow-xs font-bold"
                            : cell.isToday
                            ? "border border-[#3C096C]/40 text-[#3C096C] hover:bg-purple-50 font-bold"
                            : isOtherMonth
                            ? "text-neutral-300 hover:text-neutral-500 hover:bg-neutral-50"
                            : "text-heading hover:bg-purple-50 hover:text-[#3C096C]"
                        }`}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Vertical Divider */}
              <div className="w-px bg-neutral-100 shrink-0 self-stretch my-0.5" />

              {/* RIGHT COLUMN: Time Selection */}
              <div className="flex-1 flex flex-col justify-between pl-1">
                <div className="space-y-3">
                  {/* Time Section Title */}
                  <div className="flex items-center gap-1.5 text-xs font-bold text-heading">
                    <Clock className="w-3.5 h-3.5 text-[#FF7803]" />
                    <span>Time</span>
                  </div>

                  {/* Digital Clock Readout Display */}
                  <div className="text-center py-2 px-1 bg-purple-50/70 border border-purple-100 rounded-xl">
                    <span className="font-numeric text-xl font-extrabold text-[#3C096C] tracking-tight">
                      {pad2(currentHour12)}:{pad2(parsed.minutes)}
                    </span>
                    <span className="ml-1.5 text-xs font-extrabold text-[#3C096C]/80 uppercase">
                      {isPm ? "PM" : "AM"}
                    </span>
                  </div>

                  {/* Hour & Minute Selectors */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <span className="text-[9px] font-bold text-body/50 uppercase tracking-wider block mb-0.5">
                        Hour
                      </span>
                      <select
                        value={currentHour12}
                        onChange={(e) =>
                          handleHourChange(Number(e.target.value))
                        }
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-numeric font-bold text-heading focus:outline-none focus:border-[#3C096C] focus:bg-white cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                          <option key={h} value={h}>
                            {pad2(h)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <span className="text-[9px] font-bold text-body/50 uppercase tracking-wider block mb-0.5">
                        Minute
                      </span>
                      <select
                        value={parsed.minutes}
                        onChange={(e) =>
                          handleMinuteChange(Number(e.target.value))
                        }
                        className="w-full bg-neutral-50 border border-neutral-200 rounded-lg px-2 py-1 text-xs font-numeric font-bold text-heading focus:outline-none focus:border-[#3C096C] focus:bg-white cursor-pointer"
                      >
                        {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                          <option key={m} value={m}>
                            {pad2(m)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* AM / PM Segmented Switch */}
                  <div className="flex rounded-lg bg-neutral-100 p-0.5 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => handleAmPmToggle(false)}
                      className={`flex-1 py-1 rounded-md transition-all active:scale-95 cursor-pointer text-center ${
                        !isPm
                          ? "bg-white text-heading shadow-2xs font-extrabold"
                          : "text-body/60 hover:text-heading"
                      }`}
                    >
                      AM
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAmPmToggle(true)}
                      className={`flex-1 py-1 rounded-md transition-all active:scale-95 cursor-pointer text-center ${
                        isPm
                          ? "bg-[#3C096C] text-white shadow-2xs font-extrabold"
                          : "text-body/60 hover:text-heading"
                      }`}
                    >
                      PM
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-2 mt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={handleSetNow}
                    className="flex items-center gap-1 text-[10px] font-bold text-body/70 hover:text-[#3C096C] transition-colors cursor-pointer active:scale-95"
                    title="Set to current date and time"
                  >
                    <RotateCcw className="w-2.5 h-2.5" />
                    <span>Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-[#3C096C] hover:bg-[#2F0755] text-white text-[11px] font-bold shadow-xs transition-all active:scale-95 cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
