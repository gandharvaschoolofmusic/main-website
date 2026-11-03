"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Video,
  AlertCircle,
  CheckCircle2,
  Calendar as CalendarIcon,
  Sparkles,
  Users,
} from "lucide-react";

export interface CalendarAvailabilityRule {
  dayOfWeek: number; // 1=Mon, 7=Sun or 0=Sun
  startMinute: number;
  endMinute: number;
}

export interface CalendarException {
  id: string;
  date: string; // YYYY-MM-DD
  isBlocked: boolean;
  startMinute?: number | null;
  endMinute?: number | null;
}

export interface CalendarLessonItem {
  id: string;
  startsAt: string; // ISO
  durationMinutes: number;
  instrument: string;
  studentName: string;
  lessonSource: "TRIAL" | "ENROLLMENT";
  status: string;
  formattedTime: string;
}

export interface TeacherCalendarEventItem {
  id: string;
  title: string;
  description: string;
  type: string;
  startsAt: string; // ISO
  durationMinutes: number;
  capacity?: number | null;
  formattedTime: string;
  registrations: {
    studentName: string;
    studentEmail: string;
  }[];
}

interface TeacherCalendarViewProps {
  rules: CalendarAvailabilityRule[];
  exceptions: CalendarException[];
  lessons: CalendarLessonItem[];
  events?: TeacherCalendarEventItem[];
  teacherTimezone: string;
}

function formatMinutesToTime(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = h % 12 || 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
}

export function TeacherCalendarView({
  rules,
  exceptions,
  lessons,
  events = [],
  teacherTimezone,
}: TeacherCalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
  const totalDays = lastDayOfMonth.getDate();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const todayStr = new Date().toISOString().split("T")[0];

  // Prepare calendar grid days
  const days = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(Date.UTC(year, month, day));
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayOfWeek = d.getUTCDay(); // 0=Sun, 1=Mon...
    const normalizedDayOfWeek = dayOfWeek === 0 ? 7 : dayOfWeek; // 1-7 (Mon-Sun)

    // Check rules: match dayOfWeek (support 1-7 or 0-6)
    const dayRules = rules.filter(
      (r) => r.dayOfWeek === dayOfWeek || r.dayOfWeek === normalizedDayOfWeek,
    );

    // Check exceptions
    const dayExceptions = exceptions.filter((e) => e.date === dateStr);
    const isDayBlocked = dayExceptions.some((e) => e.isBlocked);

    // Check lessons
    const dayLessons = lessons.filter((l) => l.startsAt.startsWith(dateStr));

    // Check events assigned to teacher
    const dayEvents = (events || []).filter((e) => e.startsAt.startsWith(dateStr));

    days.push({
      day,
      dateStr,
      dayRules,
      dayExceptions,
      isDayBlocked,
      dayLessons,
      dayEvents,
    });
  }

  // Selected Day Details
  const selectedDayData = days.find((d) => d && d.dateStr === selectedDateStr);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Calendar Grid (2 Cols) */}
      <div className="lg:col-span-2 rounded-3xl border border-border-default bg-white p-6 shadow-sm space-y-6">
        {/* Month Navigation & Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <h2 className="font-serif text-xl font-bold text-heading">
              {monthNames[month]} {year}
            </h2>
            <div className="flex items-center gap-1 bg-bg-alt/40 rounded-xl p-1 border border-border-subtle">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded-lg text-body hover:text-heading hover:bg-white transition-colors btn-tactile"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded-lg text-body hover:text-heading hover:bg-white transition-colors btn-tactile"
                aria-label="Next month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-[11px] text-body flex-wrap font-medium">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
              <span>Available</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" />
              <span>Booked Lesson</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
              <span>Workshop / Event</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger inline-block" />
              <span>Time Off / Exception</span>
            </div>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold text-body-muted uppercase tracking-wider">
          <span>Sun</span>
          <span>Mon</span>
          <span>Tue</span>
          <span>Wed</span>
          <span>Thu</span>
          <span>Fri</span>
          <span>Sat</span>
        </div>

        {/* Calendar Day Cells - Emil Kowalski frequency gate (no motion transitions on date cells) */}
        <div className="grid grid-cols-7 gap-2">
          {days.map((item, idx) => {
            if (!item) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[75px] rounded-xl bg-bg-alt/20 border border-transparent p-2 opacity-30"
                />
              );
            }

            const isSelected = item.dateStr === selectedDateStr;
            const isToday = item.dateStr === todayStr;

            return (
              <button
                key={item.dateStr}
                type="button"
                onClick={() => setSelectedDateStr(item.dateStr)}
                className={`min-h-[75px] rounded-xl p-2 text-left border flex flex-col justify-between ${
                  isSelected
                    ? "border-primary bg-primary/10 ring-2 ring-primary/25"
                    : item.isDayBlocked
                    ? "border-danger/30 bg-danger-muted/30 hover:border-danger/50"
                    : item.dayEvents.length > 0 && item.dayLessons.length > 0
                    ? "border-accent/40 bg-accent-subtle/30 hover:border-accent"
                    : item.dayEvents.length > 0
                    ? "border-accent/35 bg-accent-subtle/40 hover:border-accent"
                    : item.dayLessons.length > 0
                    ? "border-primary/30 bg-primary-subtle/50 hover:border-primary"
                    : item.dayRules.length > 0
                    ? "border-success/30 bg-success-muted/30 hover:border-success"
                    : "border-border-subtle bg-white hover:border-border-default"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span
                    className={`text-xs ${
                      isToday
                        ? "w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center font-bold"
                        : "text-heading font-bold"
                    }`}
                  >
                    {item.day}
                  </span>
                  <div className="flex items-center gap-1">
                    {item.dayEvents.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-accent" title="Academy Workshop/Event" />
                    )}
                    {item.dayLessons.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-primary" title="Booked Lesson" />
                    )}
                  </div>
                </div>

                <div className="space-y-1 w-full mt-1">
                  {item.isDayBlocked && (
                    <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-danger-muted text-danger-dark truncate">
                      Time Off
                    </div>
                  )}

                  {item.dayEvents.length > 0 && (
                    <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent-subtle text-accent-dark border border-accent/25 truncate">
                      {item.dayEvents.length === 1 ? item.dayEvents[0].title : `${item.dayEvents.length} Events`}
                    </div>
                  )}

                  {item.dayLessons.length > 0 && (
                    <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-primary-subtle text-primary truncate">
                      {item.dayLessons.length} Lesson{item.dayLessons.length > 1 ? "s" : ""}
                    </div>
                  )}

                  {item.dayRules.length > 0 && !item.isDayBlocked && item.dayLessons.length === 0 && item.dayEvents.length === 0 && (
                    <div className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-success-muted text-success truncate">
                      Open Hours
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Day Inspector Detail Panel (1 Col) */}
      <div className="rounded-3xl border border-border-default bg-white p-6 shadow-sm space-y-5">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
            Selected Day Inspector
          </span>
          <h3 className="font-serif text-lg font-bold text-heading mt-0.5">
            {selectedDateStr}
          </h3>
          <p className="text-xs text-body-muted">
            Schedule breakdown for this date in <span className="text-heading font-semibold">{teacherTimezone}</span>.
          </p>
        </div>

        {selectedDayData ? (
          <div className="space-y-5">
            {/* Assigned Academy Workshops & Events */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-accent-dark flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-accent-dark" /> Conducted Events ({selectedDayData.dayEvents.length})
                </span>
                {selectedDayData.dayEvents.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-accent-subtle text-accent-dark border border-accent/30">
                    Teacher Assigned
                  </span>
                )}
              </div>

              {selectedDayData.dayEvents.length === 0 ? (
                <p className="text-xs text-body-muted italic p-3 rounded-xl bg-bg-alt/30 border border-border-subtle">
                  No academy events or workshops assigned on this date.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {selectedDayData.dayEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-3.5 rounded-xl bg-accent-subtle/30 border border-accent/25 space-y-2 hover:border-accent/40 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-xs font-bold text-heading">
                          {ev.title}
                        </h4>
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-white text-accent-dark border border-accent/30 shrink-0">
                          {ev.type}
                        </span>
                      </div>

                      <p className="text-[11px] text-body line-clamp-2">
                        {ev.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] pt-1 text-heading">
                        <span className="font-bold text-accent-dark flex items-center gap-1 font-numeric">
                          <Clock className="w-3 h-3 text-accent-dark" />
                          {ev.formattedTime} ({ev.durationMinutes}m)
                        </span>
                        <span className="font-medium text-body-muted flex items-center gap-1 text-[11px]">
                          <Users className="w-3 h-3 text-primary" />
                          {ev.registrations.length} {ev.capacity ? `/ ${ev.capacity}` : ""} Enrolled
                        </span>
                      </div>

                      {/* Registered Student Roster */}
                      {ev.registrations.length > 0 ? (
                        <div className="pt-2 border-t border-accent/20 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-body-muted block">
                            Enrolled Student Roster ({ev.registrations.length})
                          </span>
                          <div className="max-h-24 overflow-y-auto space-y-1 pr-1">
                            {ev.registrations.map((r, rIdx) => (
                              <div
                                key={rIdx}
                                className="flex items-center justify-between text-[10px] px-2 py-1 rounded bg-white border border-accent/15"
                              >
                                <span className="font-semibold text-heading truncate">{r.studentName}</span>
                                <span className="text-body-muted text-[9px] truncate ml-1">{r.studentEmail}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-body-muted italic pt-1 border-t border-accent/20">
                          No student seat reservations yet.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booked Lessons */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5" /> Booked Lessons (
                {selectedDayData.dayLessons.length})
              </span>

              {selectedDayData.dayLessons.length === 0 ? (
                <p className="text-xs text-body-muted italic p-3 rounded-xl bg-bg-alt/30 border border-border-subtle">
                  No lessons scheduled on this date.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayData.dayLessons.map((l) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-xl bg-bg-alt/30 border border-primary/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-heading">
                          {l.studentName}
                        </span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {l.lessonSource === "TRIAL" ? (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-accent-subtle text-accent-dark border border-accent/30">
                              Trial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary-subtle text-primary border border-primary/30">
                              Course
                            </span>
                          )}
                          {l.status === "RESCHEDULED" && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              Rescheduled
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="text-[11px] text-body-muted">
                        {l.instrument} • {l.durationMinutes}m
                      </p>
                      <p className="text-[11px] text-primary font-bold">
                        {l.formattedTime}
                      </p>

                      <div className="pt-1.5 border-t border-border-subtle flex items-center gap-2">
                        <a
                          href={`/lesson/${l.id}`}
                          className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs font-bold transition-colors shadow-xs"
                        >
                          <Video className="w-3.5 h-3.5" />
                          Join Room
                        </a>
                        <a
                          href={`/api/lessons/${l.id}/ics`}
                          download={`lesson-${l.id}.ics`}
                          className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border-subtle bg-white hover:bg-bg-alt/30 text-heading text-xs font-bold transition-colors"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                          Export
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Time-off Exceptions */}
            {selectedDayData.dayExceptions.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-danger flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Time Off and Exceptions
                </span>
                <div className="space-y-2">
                  {selectedDayData.dayExceptions.map((ex) => (
                    <div
                      key={ex.id}
                      className="p-3 rounded-xl bg-danger-muted/30 border border-danger/25 text-xs text-danger-dark font-medium"
                    >
                      {ex.isBlocked
                        ? "Full Day Blocked (Unavailable)"
                        : `Custom Window: ${formatMinutesToTime(ex.startMinute || 0)} to ${formatMinutesToTime(ex.endMinute || 0)}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Working Hours */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-success flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Recurring Working Hours
              </span>
              {selectedDayData.dayRules.length === 0 ? (
                <p className="text-xs text-body-muted italic p-3 rounded-xl bg-bg-alt/30 border border-border-subtle">
                  No recurring working hours set for this day of week.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {selectedDayData.dayRules.map((rule, i) => (
                    <div
                      key={i}
                      className="p-2.5 rounded-lg bg-success-muted/20 border border-success/25 text-xs text-success font-medium flex items-center justify-between"
                    >
                      <span>Window {i + 1}</span>
                      <span>
                        {formatMinutesToTime(rule.startMinute)} to {formatMinutesToTime(rule.endMinute)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-xs text-body-muted italic">Select a day on the calendar.</p>
        )}
      </div>
    </div>
  );
}
