"use client";

import { useMemo, useState } from "react";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  Download,
  Video,
  X,
  Sparkles,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";

export type CalendarLesson = {
  id: string;
  instrument: string;
  startsAt: string; // ISO
  durationMinutes: number;
  status: string;
  lessonSource?: string | null;
  teacherName: string;
  teacherProfileId: string;
  formattedTime: string;
  timezoneAbbr: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  type: string;
  startsAt: string; // ISO
  durationMinutes: number;
  capacity?: number | null;
  formattedTime: string;
  timezoneAbbr: string;
  teacherName?: string | null;
  teacherEmail?: string | null;
  teacherInstruments?: string[];
};

function groupByLocalDay<T extends { startsAt: string }>(items: T[], timezone: string) {
  const days = new Map<string, T[]>();
  for (const item of items) {
    const key = formatInTimeZone(item.startsAt, timezone, "yyyy-MM-dd");
    const group = days.get(key);
    if (group) group.push(item);
    else days.set(key, [item]);
  }
  return days;
}

export function CalendarView({
  lessons,
  events = [],
  userTimezone,
}: {
  lessons: CalendarLesson[];
  events?: CalendarEvent[];
  userTimezone: string;
}) {
  const today = toZonedTime(new Date(), userTimezone);
  const [currentMonth, setCurrentMonth] = useState(today);
  const [selectedDay, setSelectedDay] = useState<Date | null>(today);
  const [selectedLesson, setSelectedLesson] = useState<CalendarLesson | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const lessonsByDay = useMemo(() => groupByLocalDay(lessons, userTimezone), [lessons, userTimezone]);
  const eventsByDay = useMemo(() => groupByLocalDay(events, userTimezone), [events, userTimezone]);
  const getLessonsForDay = (day: Date) => lessonsByDay.get(format(day, "yyyy-MM-dd")) ?? [];
  const getEventsForDay = (day: Date) => eventsByDay.get(format(day, "yyyy-MM-dd")) ?? [];

  const selectedDayLessons = selectedDay ? getLessonsForDay(selectedDay) : [];
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : [];

  return (
    <div className="space-y-6">
      {/* Calendar Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-surface-muted/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-serif text-xl font-bold text-heading">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <p className="text-xs text-body">
              Times displayed in {userTimezone}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentMonth(today)}
            className="btn-tactile px-3.5 py-1.5 rounded-lg border border-surface-muted/80 bg-bg-alt/30 hover:bg-bg-alt text-heading text-xs font-bold transition-colors"
          >
            Today
          </button>
          <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-surface-muted/80">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 rounded-md hover:bg-bg-alt/40 text-body hover:text-heading transition-colors"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 rounded-md hover:bg-bg-alt/40 text-body hover:text-heading transition-colors"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid + Side Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Month View (2 cols on desktop) */}
        <div className="lg:col-span-2 bg-white border border-surface-muted/80 rounded-2xl p-4 sm:p-6 shadow-sm">
          {/* Weekday Labels */}
          <div className="grid grid-cols-7 text-center pb-3 border-b border-surface-muted/80 text-xs font-bold uppercase tracking-wider text-heading/70">
            <span>Sun</span>
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span>Sat</span>
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 pt-2">
            {days.map((day) => {
              const dayLessons = getLessonsForDay(day);
              const dayEvents = getEventsForDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, today);
              const isCurrentMonth = isSameMonth(day, currentMonth);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDay(day);
                    if (dayLessons.length > 0) {
                      setSelectedLesson(dayLessons[0]);
                    } else {
                      setSelectedLesson(null);
                    }
                  }}
                  className={`min-h-[70px] sm:min-h-[90px] p-1.5 sm:p-2 rounded-xl border text-left transition-all flex flex-col justify-between group ${
                    isSelected
                      ? "border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20"
                      : isToday
                      ? "border-accent bg-accent/5"
                      : dayEvents.length > 0 && dayLessons.length > 0
                      ? "border-accent/40 bg-accent-subtle/25"
                      : dayEvents.length > 0
                      ? "border-accent/30 bg-accent-subtle/20"
                      : isCurrentMonth
                      ? "border-surface-muted/70 bg-white hover:bg-bg-alt/20 hover:border-primary/30"
                      : "border-surface-muted/30 bg-bg-alt/10 opacity-50 hover:opacity-80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        isToday
                          ? "w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-[11px]"
                          : isSelected
                          ? "text-primary font-extrabold"
                          : isCurrentMonth
                          ? "text-heading"
                          : "text-body/50"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    <div className="flex items-center gap-1">
                      {dayEvents.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-accent" title="Academy Workshop/Event" />
                      )}
                      {dayLessons.length > 0 && (
                        <span className="w-2 h-2 rounded-full bg-primary" title="1:1 Lesson" />
                      )}
                    </div>
                  </div>

                  {/* Indicators on date cell */}
                  <div className="space-y-1 w-full overflow-hidden mt-1">
                    {dayEvents.slice(0, 1).map((ev) => (
                      <div
                        key={ev.id}
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold truncate bg-accent-subtle text-accent-dark border border-accent/25"
                      >
                        {formatInTimeZone(ev.startsAt, userTimezone, "h:mm a")} {ev.title}
                      </div>
                    ))}
                    {dayLessons.slice(0, 2).map((lesson) => (
                      <div
                        key={lesson.id}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold truncate ${
                          lesson.lessonSource === "TRIAL"
                            ? "bg-accent/15 text-accent-dark border border-accent/30"
                            : "bg-primary/10 text-primary border border-primary/20"
                        }`}
                      >
                        {formatInTimeZone(lesson.startsAt, userTimezone, "h:mm a")} {lesson.instrument}
                      </div>
                    ))}
                    {dayLessons.length + dayEvents.length > 2 && (
                      <span className="text-[9px] text-body block text-right font-medium">
                        +{dayLessons.length + dayEvents.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel (Side Panel on Desktop) */}
        <div className="bg-white border border-surface-muted/80 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-surface-muted/80 pb-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-accent-dark">
                  Day Schedule
                </span>
                <h3 className="font-serif text-lg font-bold text-heading">
                  {selectedDay ? format(selectedDay, "EEEE, MMMM d, yyyy") : "Select a day"}
                </h3>
              </div>
              {selectedDayLessons.length + selectedDayEvents.length > 0 && (
                <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                  {selectedDayLessons.length + selectedDayEvents.length} Session{selectedDayLessons.length + selectedDayEvents.length === 1 ? "" : "s"}
                </span>
              )}
            </div>

            {selectedDayLessons.length === 0 && selectedDayEvents.length === 0 ? (
              <div className="py-12 text-center text-body space-y-2">
                <CalendarIcon className="w-8 h-8 mx-auto opacity-40 text-body" />
                <p className="text-sm font-bold text-heading">No sessions on this day</p>
                <p className="text-xs text-body max-w-xs mx-auto leading-relaxed">
                  Click any highlighted day on the calendar to inspect scheduled lessons or enrolled academy workshops.
                </p>
                <div className="pt-2">
                  <Link
                    href="/student/dashboard/events"
                    className="btn-tactile inline-block px-4 py-2 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs font-bold transition-colors shadow-xs"
                  >
                    Browse Workshops →
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
                {/* Enrolled Academy Workshops & Events */}
                {selectedDayEvents.length > 0 && (
                  <div className="space-y-2.5">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-accent-dark flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-accent-dark" />
                      Enrolled Events & Workshops ({selectedDayEvents.length})
                    </span>

                    {selectedDayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="p-4 rounded-xl border border-accent/30 bg-accent-subtle/25 space-y-2.5 hover:border-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded bg-white text-accent-dark border border-accent/30 text-[10px] font-bold uppercase">
                                {ev.type}
                              </span>
                              <span className="px-2 py-0.5 rounded bg-accent/15 text-accent-dark border border-accent/30 text-[10px] font-bold">
                                Academy Workshop
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-heading mt-1.5">
                              {ev.title}
                            </h4>
                          </div>
                          <span className="text-xs font-semibold text-body shrink-0 font-numeric">
                            {ev.durationMinutes} min
                          </span>
                        </div>

                        <p className="text-xs text-body line-clamp-2">
                          {ev.description}
                        </p>

                        {/* Faculty Mentor Information */}
                        <div className="p-2.5 rounded-lg bg-white/90 border border-accent/20 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-heading font-medium truncate">
                            <User className="w-3.5 h-3.5 text-accent-dark shrink-0" />
                            <span className="truncate">
                              {ev.teacherName ? (
                                <>
                                  <strong className="text-heading font-bold">{ev.teacherName}</strong>
                                  {ev.teacherInstruments && ev.teacherInstruments.length > 0 && (
                                    <span className="text-body-muted text-[11px] ml-1">
                                      ({ev.teacherInstruments.join(", ")})
                                    </span>
                                  )}
                                </>
                              ) : (
                                <span className="text-body-muted italic">Gandharva Faculty Assigned</span>
                              )}
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-success shrink-0 ml-1">
                            ✓ Confirmed
                          </span>
                        </div>

                        <div className="text-xs text-heading flex items-center gap-1.5 font-medium">
                          <Clock className="w-3.5 h-3.5 text-accent-dark" />
                          <span className="font-numeric">{ev.formattedTime} ({ev.timezoneAbbr})</span>
                        </div>

                        <div className="pt-2 border-t border-accent/20 flex items-center justify-between gap-2">
                          <Link
                            href="/student/dashboard/events"
                            className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-colors shadow-xs"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            Workshop Details
                          </Link>

                          <span className="text-[11px] text-body-muted font-medium">
                            First-come reserved
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {selectedDayLessons.map((lesson) => (
                  <div
                    key={lesson.id}
                    className="p-4 rounded-xl border border-surface-muted/90 bg-bg-alt/20 space-y-3 hover:border-primary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded bg-white text-heading border border-surface-muted text-xs font-bold">
                            {lesson.instrument}
                          </span>
                          {lesson.lessonSource === "TRIAL" ? (
                            <span className="px-2 py-0.5 rounded bg-accent/15 text-accent-dark border border-accent/30 text-[10px] font-bold">
                              Trial
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">
                              Enrolled
                            </span>
                          )}
                          {lesson.status === "RESCHEDULED" && (
                            <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold">
                              Rescheduled
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-bold text-heading mt-1.5 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-primary" />
                          {lesson.teacherName}
                        </h4>
                      </div>
                      <span className="text-xs font-semibold text-body">
                        {lesson.durationMinutes} min
                      </span>
                    </div>

                    <div className="text-xs text-heading flex items-center gap-1.5 font-medium">
                      <Clock className="w-3.5 h-3.5 text-primary" />
                      {lesson.formattedTime} ({lesson.timezoneAbbr})
                    </div>

                    <div className="pt-2 border-t border-surface-muted/80 flex items-center justify-between gap-2">
                      <Link
                        href={`/lesson/${lesson.id}`}
                        className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs font-bold transition-colors shadow-xs"
                      >
                        <Video className="w-3.5 h-3.5" />
                        Join Room
                      </Link>

                      <a
                        href={`/api/lessons/${lesson.id}/ics`}
                        download={`lesson-${lesson.id}.ics`}
                        className="btn-tactile inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-muted bg-white hover:bg-bg-alt/30 text-heading text-xs font-bold transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-primary" />
                        Add to Calendar
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

