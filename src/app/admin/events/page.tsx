import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { AdminEventsManager, AdminEventItem } from "./AdminEventsManager";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Events & Workshops | Admin Portal | Gandharva School of Music",
  description: "Schedule live workshops, masterclasses, recitals, and monitor registrations.",
};

const getCachedAdminEventsData = unstable_cache(
  async () => {
    return Promise.all([
      db.event.findMany({
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              teacherProfile: {
                select: {
                  instruments: true,
                },
              },
            },
          },
          registrations: {
            include: {
              student: { select: { name: true, email: true } },
            },
            orderBy: { registeredAt: "asc" },
          },
        },
        orderBy: { startsAt: "asc" },
      }),
      db.user.findMany({
        where: { role: Role.TEACHER, isActive: true },
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
        orderBy: { name: "asc" },
      }),
    ]);
  },
  ["admin-events-data"],
  { revalidate: 30, tags: ["admin-events", "events"] },
);

export default async function AdminEventsPage() {
  await requireRole(Role.ADMIN);

  const [dbEvents, dbTeachers] = await getCachedAdminEventsData();

  const formattedTeachers = dbTeachers.map((t) => ({
    id: t.id,
    name: t.name || "Teacher",
    email: t.email,
    instruments: t.teacherProfile?.instruments || [],
  }));

  const formattedEvents: AdminEventItem[] = dbEvents.map((ev) => ({
    id: ev.id,
    title: ev.title,
    description: ev.description,
    type: ev.type,
    startsAt: ev.startsAt.toISOString(),
    formattedDate: new Date(ev.startsAt).toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    durationMinutes: ev.durationMinutes,
    capacity: ev.capacity,
    isPublished: ev.isPublished,
    teacherId: ev.teacherId,
    teacher: ev.teacher
      ? {
          id: ev.teacher.id,
          name: ev.teacher.name || "Teacher",
          email: ev.teacher.email,
          instruments: ev.teacher.teacherProfile?.instruments || [],
        }
      : null,
    registrations: ev.registrations.map((r) => ({
      id: r.id,
      studentName: r.student.name || "Student",
      studentEmail: r.student.email,
      registeredAt: r.registeredAt.toISOString(),
    })),
  }));

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent-dark font-mono">
          Community & Group Activities
        </span>
        <SplitHeading
          firstClause="Academy Events &"
          accentClause="Masterclasses"
          as="h1"
          size="lg"
          className="mt-1"
        />
        <p className="text-sm text-body mt-1">
          Schedule academy workshops, exam preparation sessions, and faculty masterclasses. Monitor real-time student registrations.
        </p>
      </div>

      <AdminEventsManager
        initialEvents={formattedEvents}
        availableTeachers={formattedTeachers}
      />
    </div>
  );
}
