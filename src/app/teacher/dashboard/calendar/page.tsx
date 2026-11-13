import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { TeacherCalendarView } from "@/components/dashboard/TeacherCalendarView";
import { formatInViewerTimezone } from "@/lib/timezone";

export const metadata = {
  title: "Studio Calendar | Teacher Studio | Gandharva School of Music",
  description: "Interactive monthly schedule with availability overlay and booked lessons.",
};

import { unstable_cache } from "next/cache";

const getCachedTeacherCalendarData = unstable_cache(
  async (userId: string) => {
    return Promise.all([
      db.user.findUnique({
        where: { id: userId },
        include: {
          teacherProfile: {
            include: {
              availabilityRules: true,
              availabilityExceptions: {
                orderBy: { date: "asc" },
              },
              lessonsAsTeacher: {
                where: {
                  status: { in: ["SCHEDULED", "RESCHEDULED"] },
                },
                include: {
                  student: {
                    select: {
                      name: true,
                    },
                  },
                },
                orderBy: { startsAt: "asc" },
              },
            },
          },
        },
      }),
      db.event.findMany({
        where: {
          teacherId: userId,
          isPublished: true,
        },
        include: {
          registrations: {
            include: {
              student: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { registeredAt: "asc" },
          },
        },
        orderBy: { startsAt: "asc" },
      }),
    ]);
  },
  ["teacher-calendar-data"],
  { revalidate: 30, tags: ["teacher-calendar", "teacher-lessons"] }
);

export default async function TeacherCalendarPage() {
  const user = await requireRole(Role.TEACHER);

  let dbUser: any = null;
  let dbEvents: any[] = [];

  try {
    [dbUser, dbEvents] = await getCachedTeacherCalendarData(user.id);
  } catch (err) {
    console.error("Failed to load cached teacher calendar data:", err);
    [dbUser, dbEvents] = await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        include: {
          teacherProfile: {
            include: {
              availabilityRules: true,
              availabilityExceptions: {
                orderBy: { date: "asc" },
              },
              lessonsAsTeacher: {
                where: {
                  status: { in: ["SCHEDULED", "RESCHEDULED"] },
                },
                include: {
                  student: {
                    select: {
                      name: true,
                    },
                  },
                },
                orderBy: { startsAt: "asc" },
              },
            },
          },
        },
      }),
      db.event.findMany({
        where: {
          teacherId: user.id,
          isPublished: true,
        },
        include: {
          registrations: {
            include: {
              student: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
            orderBy: { registeredAt: "asc" },
          },
        },
        orderBy: { startsAt: "asc" },
      }),
    ]);
  }

  const profile = dbUser?.teacherProfile;
  const teacherTimezone = user.timezone || "UTC";

  const rules = (profile?.availabilityRules || []).map((r: any) => ({
    dayOfWeek: r.dayOfWeek,
    startMinute: r.startMinute,
    endMinute: r.endMinute,
  }));

  const exceptions = (profile?.availabilityExceptions || []).map((e: any) => {
    const d = new Date(e.date);
    const dateStr = !isNaN(d.getTime()) ? d.toISOString().split("T")[0] : "";
    return {
      id: e.id,
      date: dateStr,
      isBlocked: e.isBlocked,
      startMinute: e.startMinute,
      endMinute: e.endMinute,
    };
  });

  const lessons = (profile?.lessonsAsTeacher || []).map((l: any) => {
    const d = new Date(l.startsAt);
    const isValid = !isNaN(d.getTime());
    return {
      id: l.id,
      startsAt: isValid ? d.toISOString() : new Date().toISOString(),
      durationMinutes: l.durationMinutes || 60,
      instrument: l.instrument || "Music",
      studentName: l.student?.name || "Student",
      lessonSource: l.lessonSource as "TRIAL" | "ENROLLMENT",
      status: l.status,
      formattedTime: isValid
        ? formatInViewerTimezone(
            d,
            teacherTimezone,
            "h:mm a",
          )
        : "TBD",
    };
  });

  const formattedEvents = dbEvents.map((ev: any) => {
    const d = new Date(ev.startsAt);
    const isValid = !isNaN(d.getTime());
    return {
      id: ev.id,
      title: ev.title || "Masterclass",
      description: ev.description,
      type: ev.type,
      startsAt: isValid ? d.toISOString() : new Date().toISOString(),
      durationMinutes: ev.durationMinutes || 60,
      capacity: ev.capacity,
      formattedTime: isValid
        ? formatInViewerTimezone(
            d,
            teacherTimezone,
            "h:mm a",
          )
        : "TBD",
      registrations: (ev.registrations || []).map((r: any) => ({
        studentName: r.student?.name || "Student",
        studentEmail: r.student?.email || "",
      })),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-accent-dark font-sans">
          Schedule and Timeline
        </span>
        <h1 className="font-serif text-3xl font-bold text-heading mt-1">
          <span className="text-heading">Studio </span>
          <span className="text-accent">Calendar</span>
        </h1>
        <p className="text-xs sm:text-sm text-body mt-1">
          Visual monthly schedule showing regular working blocks (green), booked student lessons (purple), and exceptions/time-off (red).
        </p>
      </div>

      <TeacherCalendarView
        rules={rules}
        exceptions={exceptions}
        lessons={lessons}
        events={formattedEvents}
        teacherTimezone={teacherTimezone}
      />
    </div>
  );
}
