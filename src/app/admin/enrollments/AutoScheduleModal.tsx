"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  CalendarClock,
  Clock,
  Calendar,
  CheckCircle2,
  X,
  Sparkles,
  ChevronRight,
  Info,
  CalendarDays,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  UserCheck,
} from "lucide-react";

export const WEEKDAY_OPTIONS = [
  { label: "Mon", full: "Monday", dayIndex: 1 },
  { label: "Tue", full: "Tuesday", dayIndex: 2 },
  { label: "Wed", full: "Wednesday", dayIndex: 3 },
  { label: "Thu", full: "Thursday", dayIndex: 4 },
  { label: "Fri", full: "Friday", dayIndex: 5 },
  { label: "Sat", full: "Saturday", dayIndex: 6 },
  { label: "Sun", full: "Sunday", dayIndex: 0 },
];

export const TIME_PRESET_OPTIONS = [
  { label: "10:00 AM", value: "10:00", emoji: "🌅" },
  { label: "03:00 PM", value: "15:00", emoji: "☀️" },
  { label: "05:00 PM", value: "17:00", emoji: "🌆" },
  { label: "06:30 PM", value: "18:30", emoji: "🌙" },
  { label: "07:30 PM", value: "19:30", emoji: "🎯" },
];

export interface GeneratedSessionSlot {
  startsAt: string;
  durationMinutes: number;
  previewLabel: string;
  dayName: string;
  dateFormatted: string;
  timeFormatted: string;
}

/**
 * Computes the next occurrence of a target day of the week (0 = Sunday, 1 = Monday, etc.)
 * at the given time string "HH:MM".
 */
export function getNextWeekdayDate(dayIndex: number, timeStr: string, fromDate = new Date()): Date {
  const [hours, minutes] = (timeStr || "17:00").split(":").map(Number);
  const d = new Date(fromDate);
  const currentDay = d.getDay();
  let diff = (dayIndex - currentDay + 7) % 7;

  // If today is the target day, check if the specified time has already passed
  if (diff === 0) {
    const currentHours = d.getHours();
    const currentMins = d.getMinutes();
    const targetH = hours ?? 17;
    const targetM = minutes ?? 0;
    if (currentHours > targetH || (currentHours === targetH && currentMins >= targetM)) {
      diff = 7; // Advance to next week
    }
  }

  d.setDate(d.getDate() + diff);
  d.setHours(hours ?? 17, minutes ?? 0, 0, 0);
  return d;
}

/**
 * Generates N weekly slots spaced exactly 7 days apart (1 session per week)
 */
export function generateWeeklySlotsList(
  firstDate: Date,
  count: number,
  durationMinutes = 60
): GeneratedSessionSlot[] {
  const slots: GeneratedSessionSlot[] = [];
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  const startMs = firstDate.getTime();
  for (let i = 0; i < count; i++) {
    const slotDate = new Date(startMs + i * 7 * 86400000);
    const dayName = DAY_NAMES[slotDate.getDay()];
    const dateNum = String(slotDate.getDate()).padStart(2, "0");
    const monthName = MONTH_NAMES[slotDate.getMonth()];
    const year = slotDate.getFullYear();
    let hours = slotDate.getHours();
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    const minutes = String(slotDate.getMinutes()).padStart(2, "0");
    const timeFormatted = `${String(hours).padStart(2, "0")}:${minutes} ${ampm}`;
    const dateFormatted = `${dateNum} ${monthName} ${year}`;

    slots.push({
      startsAt: slotDate.toISOString(),
      durationMinutes,
      previewLabel: `${dayName}, ${dateFormatted} · ${timeFormatted}`,
      dayName,
      dateFormatted,
      timeFormatted,
    });
  }
  return slots;
}

interface WeeklySchedulePickerProps {
  selectedDay: number;
  onChangeDay: (day: number) => void;
  selectedTime: string;
  onChangeTime: (time: string) => void;
  startDate: string; // YYYY-MM-DD
  onChangeStartDate: (dateStr: string) => void;
  durationMinutes: number;
  onChangeDuration: (dur: number) => void;
  amountPaid: number;
  perSessionRate: number;
  onChangePerSessionRate?: (rate: number) => void;
  sessionCount: number;
  compact?: boolean;
}

/**
 * Tactile Apple-style weekly session scheduler component.
 * Allows choosing day of the week, class timing with presets, and shows live timetable preview.
 */
export function WeeklySchedulePicker({
  selectedDay,
  onChangeDay,
  selectedTime,
  onChangeTime,
  startDate,
  onChangeStartDate,
  durationMinutes,
  onChangeDuration,
  amountPaid,
  perSessionRate,
  onChangePerSessionRate,
  sessionCount,
  compact = false,
}: WeeklySchedulePickerProps) {
  // Compute starting Date object
  const computedFirstDate = useMemo(() => {
    const [hours, minutes] = selectedTime.split(":").map(Number);
    if (startDate) {
      const [y, m, d] = startDate.split("-").map(Number);
      const parsed = new Date(y, m - 1, d, hours || 17, minutes || 0, 0, 0);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    return getNextWeekdayDate(selectedDay, selectedTime);
  }, [startDate, selectedDay, selectedTime]);

  // Live generated weekly slots
  const previewSlots = useMemo(() => {
    return generateWeeklySlotsList(computedFirstDate, sessionCount, durationMinutes);
  }, [computedFirstDate, sessionCount, durationMinutes]);

  const selectedWeekdayObj = WEEKDAY_OPTIONS.find((w) => w.dayIndex === selectedDay) || WEEKDAY_OPTIONS[0];

  const [rateText, setRateText] = useState<string>(String(perSessionRate || 800));

  useEffect(() => {
    setRateText(String(perSessionRate || 800));
  }, [perSessionRate]);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Dynamic Financial & Session Calculation Banner */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-purple-50/90 via-purple-50/50 to-white border border-purple-200/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-numeric">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#3C096C] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-heading">
                  ₹{amountPaid.toLocaleString("en-IN")} Amount Paid
                </span>
                <span className="text-[10px] text-body/50">÷</span>
                {onChangePerSessionRate ? (
                  <div
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white border border-purple-300 shadow-2xs hover:border-[#3C096C] focus-within:border-[#3C096C] focus-within:ring-2 focus-within:ring-[#3C096C]/20 transition-all cursor-text"
                    title="Click to customize per-session rate (e.g. ₹800/session)"
                  >
                    <span className="text-xs font-bold text-[#3C096C]">₹</span>
                    <input
                      type="number"
                      min="50"
                      step="50"
                      value={rateText}
                      onChange={(e) => {
                        const str = e.target.value;
                        setRateText(str);
                        const val = Number(str);
                        if (val > 0) {
                          onChangePerSessionRate(val);
                        }
                      }}
                      onBlur={() => {
                        const val = Number(rateText);
                        if (!val || val <= 0) {
                          setRateText(String(perSessionRate || 800));
                          onChangePerSessionRate(perSessionRate || 800);
                        }
                      }}
                      className="w-16 text-xs font-bold text-heading bg-transparent focus:outline-none font-numeric text-center"
                      aria-label="Per session rate"
                    />
                    <span className="text-[11px] text-body/70 font-semibold">/session</span>
                    <span className="text-[9px] font-bold text-[#3C096C] bg-purple-100/90 px-1.5 py-0.5 rounded uppercase tracking-wider ml-0.5">
                      Custom
                    </span>
                  </div>
                ) : (
                  <span className="text-xs font-medium text-body">
                    ₹{perSessionRate.toLocaleString("en-IN")}/session
                  </span>
                )}
              </div>
              <p className="text-[11px] text-body/70 mt-1">
                Automatically unlocking <span className="font-bold text-[#3C096C]">{sessionCount} weekly sessions</span> (1 session per week)
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100/80 border border-purple-200/90 text-[#3C096C] text-xs font-bold shrink-0 self-start sm:self-auto">
            <CalendarClock className="w-3.5 h-3.5" />
            <span>1 Session / Week</span>
          </div>
        </div>
      </div>

      {/* 2. Day of Week Selection (Pill Buttons) */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5 text-[#3C096C]" />
            <span>What day of the week do you want to schedule?</span>
          </label>
          <span className="text-[11px] text-body/60 font-medium">
            Repeats every {selectedWeekdayObj.full}
          </span>
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAY_OPTIONS.map((day) => {
            const isSelected = selectedDay === day.dayIndex;
            return (
              <button
                key={day.dayIndex}
                type="button"
                onClick={() => {
                  onChangeDay(day.dayIndex);
                  // Snap start date to next occurrence of that weekday
                  const nextD = getNextWeekdayDate(day.dayIndex, selectedTime);
                  const y = nextD.getFullYear();
                  const m = String(nextD.getMonth() + 1).padStart(2, "0");
                  const d = String(nextD.getDate()).padStart(2, "0");
                  onChangeStartDate(`${y}-${m}-${d}`);
                }}
                className={`py-2 px-1 rounded-xl text-center text-xs font-bold transition-all duration-150 active:scale-95 cursor-pointer ${
                  isSelected
                    ? "bg-[#3C096C] text-white shadow-xs scale-[1.02]"
                    : "bg-white hover:bg-neutral-50 text-neutral-700 border border-neutral-200 hover:border-neutral-300"
                }`}
                title={day.full}
              >
                <div className="text-[11px] font-bold">{day.label}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Class Timing & Quick Presets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-[#3C096C]" />
            <span>What is the class timing?</span>
          </label>
          <span className="text-[11px] text-body/60 font-numeric">IST · Asia/Kolkata</span>
        </div>

        <div className="space-y-2.5">
          {/* Direct Time Input */}
          <div className="relative">
            <input
              type="time"
              value={selectedTime}
              onChange={(e) => {
                onChangeTime(e.target.value);
              }}
              className="w-full px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-heading focus:outline-none focus:border-[#3C096C] font-mono shadow-2xs"
            />
          </div>

          {/* Quick Preset Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-body/60 font-medium mr-1">Quick Slots:</span>
            {TIME_PRESET_OPTIONS.map((slot) => {
              const isSelected = selectedTime === slot.value;
              return (
                <button
                  key={slot.value}
                  type="button"
                  onClick={() => onChangeTime(slot.value)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all active:scale-95 cursor-pointer ${
                    isSelected
                      ? "bg-[#3C096C] text-white shadow-2xs font-bold"
                      : "bg-white hover:bg-neutral-50 border border-neutral-200 text-body hover:text-heading"
                  }`}
                >
                  <span className="text-[10px]">{slot.emoji}</span>
                  <span>{slot.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. First Session Start Date & Duration */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-numeric">
        <div>
          <label className="text-[11px] font-semibold text-heading block mb-1">
            First Session Date (Weekly Start)
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onChangeStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-neutral-300 bg-white text-xs font-semibold text-heading focus:outline-none focus:border-[#3C096C]"
          />
          <p className="text-[10px] text-body/60 mt-0.5">
            Defaults to next upcoming {selectedWeekdayObj.full}
          </p>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-heading block mb-1">
            Class Duration
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {[45, 60, 90].map((dur) => (
              <button
                key={dur}
                type="button"
                onClick={() => onChangeDuration(dur)}
                className={`py-2 px-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer text-center ${
                  durationMinutes === dur
                    ? "bg-[#3C096C] text-white shadow-2xs"
                    : "bg-white hover:bg-neutral-50 border border-neutral-200 text-neutral-700"
                }`}
              >
                {dur}m
              </button>
            ))}
          </div>
          <p className="text-[10px] text-body/60 mt-0.5">Standard 1-on-1 private duration</p>
        </div>
      </div>

      {/* 5. Live Session Timetable Preview */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-[#3C096C]" />
            <span>Generated Timetable ({sessionCount} Weekly Sessions)</span>
          </label>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            1 session / week
          </span>
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {previewSlots.map((slot, idx) => (
            <div
              key={slot.startsAt + idx}
              className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-neutral-200/80 hover:border-purple-200 transition-colors text-xs font-numeric shadow-2xs"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-purple-100 text-[#3C096C] font-bold text-[10px] flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <div>
                  <span className="font-bold text-heading">
                    {slot.dayName}, {slot.dateFormatted}
                  </span>
                  <span className="text-body/50 text-[10px] ml-1.5">
                    ({durationMinutes} mins)
                  </span>
                </div>
              </div>

              <div className="inline-flex items-center gap-1 text-[11px] font-bold text-[#3C096C] bg-purple-50/70 px-2 py-0.5 rounded-lg border border-purple-100">
                <Clock className="w-3 h-3 text-[#3C096C]" />
                <span>{slot.timeFormatted}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface AutoScheduleAllotModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  courseTitle: string;
  amountPaid: number;
  perSessionRate: number;
  assignedTeacherName?: string | null;
  onConfirmSchedule: (slots: Array<{ startsAt: string; durationMinutes: number }>) => void;
  onConfirmWithoutSchedule: () => void;
  isPending: boolean;
}

/**
 * Apple-designed interactive modal prompted when admin clicks "Approve & Allot Course"
 * or "Approve & Add Course" with an amount paid.
 */
export function AutoScheduleAllotModal({
  isOpen,
  onClose,
  studentName,
  courseTitle,
  amountPaid,
  perSessionRate,
  assignedTeacherName,
  onConfirmSchedule,
  onConfirmWithoutSchedule,
  isPending,
}: AutoScheduleAllotModalProps) {
  const [customRate, setCustomRate] = useState<number>(perSessionRate || 800);

  useEffect(() => {
    if (perSessionRate > 0) {
      setCustomRate(perSessionRate);
    }
  }, [perSessionRate, isOpen]);

  const effectiveRate = customRate > 0 ? customRate : (perSessionRate || 800);

  // Session count calculated as amount paid / per session charge (minimum 1 if paid > 0)
  const sessionCount = useMemo(() => {
    if (effectiveRate <= 0) return 1;
    const calc = Math.floor(amountPaid / effectiveRate);
    return calc > 0 ? calc : 1;
  }, [amountPaid, effectiveRate]);

  // Scheduler configuration state
  const [selectedDay, setSelectedDay] = useState<number>(3); // Default Wednesday
  const [selectedTime, setSelectedTime] = useState<string>("17:00"); // Default 5:00 PM
  const [startDate, setStartDate] = useState<string>(() => {
    const nextD = getNextWeekdayDate(3, "17:00");
    const y = nextD.getFullYear();
    const m = String(nextD.getMonth() + 1).padStart(2, "0");
    const d = String(nextD.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });
  const [durationMinutes, setDurationMinutes] = useState<number>(60);

  // Sync start date whenever modal opens or day/time changes if not manually set
  useEffect(() => {
    if (isOpen) {
      const nextD = getNextWeekdayDate(selectedDay, selectedTime);
      const y = nextD.getFullYear();
      const m = String(nextD.getMonth() + 1).padStart(2, "0");
      const d = String(nextD.getDate()).padStart(2, "0");
      setStartDate(`${y}-${m}-${d}`);
    }
  }, [isOpen, selectedDay, selectedTime]);

  if (!isOpen) return null;

  const handleScheduleSubmit = () => {
    const [hours, minutes] = selectedTime.split(":").map(Number);
    let firstDate: Date;
    if (startDate) {
      const [y, m, d] = startDate.split("-").map(Number);
      firstDate = new Date(y, m - 1, d, hours || 17, minutes || 0, 0, 0);
    } else {
      firstDate = getNextWeekdayDate(selectedDay, selectedTime);
    }

    const slots = generateWeeklySlotsList(firstDate, sessionCount, durationMinutes).map((s) => ({
      startsAt: s.startsAt,
      durationMinutes: s.durationMinutes,
    }));

    onConfirmSchedule(slots);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/45 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-xl max-h-[92vh] flex flex-col rounded-3xl bg-white border border-neutral-200/90 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-neutral-100 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#3C096C] text-white flex items-center justify-center font-bold shadow-xs">
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-heading">
                Schedule Weekly Sessions for {studentName}
              </h3>
              <p className="text-xs text-body/70 mt-0.5">
                {courseTitle} {assignedTeacherName ? `· Mentor: ${assignedTeacherName}` : ""}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 rounded-xl text-body/50 hover:text-heading hover:bg-neutral-100 transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          <WeeklySchedulePicker
            selectedDay={selectedDay}
            onChangeDay={setSelectedDay}
            selectedTime={selectedTime}
            onChangeTime={setSelectedTime}
            startDate={startDate}
            onChangeStartDate={setStartDate}
            durationMinutes={durationMinutes}
            onChangeDuration={setDurationMinutes}
            amountPaid={amountPaid}
            perSessionRate={effectiveRate}
            onChangePerSessionRate={setCustomRate}
            sessionCount={sessionCount}
          />
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-neutral-100 bg-neutral-50/80 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onConfirmWithoutSchedule}
            disabled={isPending}
            className="text-xs font-semibold text-body hover:text-heading cursor-pointer disabled:opacity-50 order-2 sm:order-1"
          >
            Allot Course Without Scheduling Now
          </button>

          <div className="flex items-center gap-2.5 w-full sm:w-auto order-1 sm:order-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-4 py-2 rounded-xl border border-neutral-300 hover:bg-white text-body text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleScheduleSubmit}
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-[#3C096C] hover:bg-[#2D0752] text-white text-xs font-bold transition-all shadow-xs active:scale-95 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>
                Approve &amp; Schedule {sessionCount} Sessions
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
