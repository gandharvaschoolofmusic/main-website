import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { formatInViewerTimezone, getTimezoneAbbr } from "@/lib/timezone";
import { CalendarView, CalendarLesson } from "@/components/dashboard/CalendarView";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Lesson Calendar | Student Portal | Gandharva School of Music",
  description: "View and export your scheduled music lessons on an interactive month & week calendar.",
};

import { unstable_cache } from "next/cache";

const getCachedStudentCalendarData = unstable_cache(
  async (userId: string) => {
    return Promise.all([
      db.lesson.findMany({
        where: {
          studentId: userId,
          status: { in: ["SCHEDULED", "RESCHEDULED"] },
        },
        include: {
          teacher: {
            select: {
              name: true,
              email: true,
              timezone: true,
            },
          },
          teacherProfile: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          startsAt: "asc",
        },
      }),
      db.eventRegistration.findMany({
        where: {
          studentId: userId,
          event: {
            isPublished: true,
          },
        },
        include: {
          event: {
            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  teacherProfile: {
                    select: {
                      instruments: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          event: {
            startsAt: "asc",
          },
        },
      }),
    ]);
  },
  ["student-calendar-data"],
  { revalidate: 30, tags: ["student-lessons", "student-calendar"] }
);

export default async function StudentCalendarPage() {
  const user = await requireRole(Role.STUDENT);
  const studentTimezone = user.timezone || "UTC";

  let dbLessons: any[] = [];
  let dbRegistrations: any[] = [];

  try {
    [dbLessons, dbRegistrations] = await getCachedStudentCalendarData(user.id);
  } catch (err) {
    console.error("Failed to load cached student calendar data:", err);
    [dbLessons, dbRegistrations] = await Promise.all([
      db.lesson.findMany({
        where: {
          studentId: user.id,
          status: { in: ["SCHEDULED", "RESCHEDULED"] },
        },
        include: {
          teacher: {
            select: {
              name: true,
              email: true,
              timezone: true,
            },
          },
          teacherProfile: {
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          startsAt: "asc",
        },
      }),
      db.eventRegistration.findMany({
        where: {
          studentId: user.id,
          event: {
            isPublished: true,
          },
        },
        include: {
          event: {
            include: {
              teacher: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  teacherProfile: {
                    select: {
                      instruments: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          event: {
            startsAt: "asc",
          },
        },
      }),
    ]);
  }

  const formattedLessons: CalendarLesson[] = dbLessons.map((l) => {
    const startsAtDate = new Date(l.startsAt);
    const isStartsValid = !isNaN(startsAtDate.getTime());

    return {
      id: l.id,
      instrument: l.instrument || "Music",
      startsAt: isStartsValid ? startsAtDate.toISOString() : new Date().toISOString(),
      durationMinutes: l.durationMinutes || 60,
      status: l.status,
      lessonSource: l.lessonSource,
      teacherName: l.teacher?.name || "Teacher",
      teacherProfileId: l.teacherProfile?.id || "",
      formattedTime: isStartsValid
        ? formatInViewerTimezone(
            startsAtDate,
            studentTimezone,
            "h:mm a",
          )
        : "TBD",
      timezoneAbbr: isStartsValid ? getTimezoneAbbr(startsAtDate, studentTimezone) : "UTC",
    };
  });

  const formattedEvents = dbRegistrations
    .filter((reg) => reg?.event)
    .map((reg) => {
      const ev = reg.event;
      const startsAtDate = new Date(ev.startsAt);
      const isStartsValid = !isNaN(startsAtDate.getTime());

      return {
        id: ev.id,
        title: ev.title || "Masterclass",
        description: ev.description,
        type: ev.type,
        startsAt: isStartsValid ? startsAtDate.toISOString() : new Date().toISOString(),
        durationMinutes: ev.durationMinutes || 60,
        capacity: ev.capacity,
        formattedTime: isStartsValid
          ? formatInViewerTimezone(
              startsAtDate,
              studentTimezone,
              "h:mm a",
            )
          : "TBD",
        timezoneAbbr: isStartsValid ? getTimezoneAbbr(startsAtDate, studentTimezone) : "UTC",
        teacherName: ev.teacher?.name || null,
        teacherEmail: ev.teacher?.email || null,
        teacherInstruments: ev.teacher?.teacherProfile?.instruments || [],
      };
    });

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
          Schedule and Milestones
        </span>
        <SplitHeading
          as="h1"
          firstClause="Lesson"
          accentClause="Calendar"
          size="lg"
          className="mt-0.5"
        />
        <p className="text-xs sm:text-sm text-body mt-1">
          Click any date with a scheduled lesson to view details, join the classroom, or export to Apple or Google Calendar (.ics).
        </p>
      </div>

      <CalendarView
        lessons={formattedLessons}
        events={formattedEvents}
        userTimezone={studentTimezone}
      />
    </div>
  );
}

