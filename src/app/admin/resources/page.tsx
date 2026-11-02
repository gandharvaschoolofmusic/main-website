import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { getResilientData, getLastKnownGood } from "@/lib/db-resilience";
import { isStorageConfigured } from "@/lib/supabase-storage";
import { AdminResourcesClient, AdminResourceItem } from "./AdminResourcesClient";
import type { AllottedStudentOption } from "@/actions/resources";

export const metadata = {
  title: "Academy Learning Resources | Admin Portal | Gandharva School of Music",
  description:
    "Institutional repository of sheet music, audio tracks, lesson notes, and practice exercises synced with Supabase Cloud Storage.",
};

const getCachedAdminResourcesData = unstable_cache(
  async () => {
    return getResilientData("admin-resources-v3", async () => {
      // Run all fetches in parallel using direct db queries (never call auth() inside cache scope)
      const [resources, enrollments, studentsList] = await Promise.all([
      db.resource.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          shares: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
              course: {
                select: {
                  id: true,
                  title: true,
                  instrument: true,
                },
              },
            },
          },
        },
      }),
      db.enrollment.findMany({
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
          course: {
            select: {
              id: true,
              title: true,
              instrument: true,
            },
          },
        },
        orderBy: { startedAt: "desc" },
      }),
      db.user.findMany({
        where: { role: Role.STUDENT },
        select: { id: true, name: true, email: true, image: true },
        take: 100,
      }),
    ]);

    const isDriveReady = isStorageConfigured();

    // Format resources safely for client component
    const formattedResources: AdminResourceItem[] = resources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      category: r.category,
      fileName: r.fileName,
      fileUrl: r.fileUrl,
      fileId: r.fileId,
      fileSizeBytes: r.fileSizeBytes,
      mimeType: r.mimeType,
      createdAt: r.createdAt.toISOString(),
      teacher: {
        id: r.teacher.id,
        name: r.teacher.name,
        email: r.teacher.email,
        image: r.teacher.image,
      },
      shares: r.shares.map((s) => ({
        id: s.id,
        studentId: s.studentId,
        teacherNote: s.teacherNote,
        sharedAt: s.sharedAt.toISOString(),
        isViewed: s.isViewed,
        student: {
          id: s.student.id,
          name: s.student.name,
          email: s.student.email,
          image: s.student.image,
        },
        course: s.course
          ? {
              id: s.course.id,
              title: s.course.title,
              instrument: s.course.instrument,
            }
          : null,
      })),
    }));

    // Build students list for sharing dropdown
    const studentsMap = new Map<string, AllottedStudentOption>();
    for (const enr of enrollments) {
      if (enr.student) {
        studentsMap.set(enr.student.id, {
          id: enr.student.id,
          name: enr.student.name || "Enrolled Student",
          email: enr.student.email,
          image: enr.student.image,
          courseTitle: enr.course.title,
          courseId: enr.course.id,
          instrument: enr.course.instrument,
        });
      }
    }

    for (const st of studentsList) {
      if (!studentsMap.has(st.id)) {
        studentsMap.set(st.id, {
          id: st.id,
          name: st.name || "Student",
          email: st.email,
          image: st.image,
          courseTitle: "Student Account",
          courseId: null,
          instrument: null,
        });
      }
    }

    const allStudents = Array.from(studentsMap.values());

    return {
      formattedResources,
      allStudents,
      isDriveReady,
    };
    });
  },
  ["admin-resources-data-v3"],
  { revalidate: 30, tags: ["admin-resources", "resources"] }
);

export default async function AdminResourcesPage() {
  await requireRole(Role.ADMIN);

  let data = {
    formattedResources: [] as AdminResourceItem[],
    allStudents: [] as AllottedStudentOption[],
    isDriveReady: false,
  };

  try {
    data = await getCachedAdminResourcesData();
  } catch (err) {
    console.error("[AdminResourcesPage] Failed to load cached resources data, using fallback:", err);
  }

  if (data.formattedResources.length === 0 && data.allStudents.length === 0) {
    const fallback = getLastKnownGood<typeof data>("admin-resources-v3");
    if (fallback && (fallback.formattedResources?.length > 0 || fallback.allStudents?.length > 0)) {
      data = fallback;
    }
  }

  return (
    <AdminResourcesClient
      initialResources={data.formattedResources}
      allStudents={data.allStudents}
      isDriveReady={data.isDriveReady}
    />
  );
}
