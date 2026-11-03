import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { isStorageConfigured } from "@/lib/supabase-storage";
import { TeacherResourcesClient, TeacherResourceItem } from "@/components/resources/TeacherResourcesClient";
import type { AllottedStudentOption } from "@/actions/resources";
import { unstable_cache } from "next/cache";

export const metadata = {
  title: "Learning Resources | Teacher Studio | Gandharva School of Music",
  description: "Upload, manage, and share sheet music, practice exercises, and audio tracks with your students.",
};

const getCachedTeacherResourcesData = unstable_cache(
  async (userId: string) => {
    const [resources, enrollments, courseTeachers, trialLessons] = await Promise.all([
      db.resource.findMany({
        where: { teacherId: userId },
        orderBy: { createdAt: "desc" },
        include: {
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
        where: { teacherId: userId },
        include: {
          student: {
            select: { id: true, name: true, email: true, image: true },
          },
          course: {
            select: { id: true, title: true, instrument: true },
          },
        },
      }),
      db.courseTeacher.findMany({
        where: { teacherId: userId },
        include: {
          course: {
            include: {
              enrollments: {
                include: {
                  student: {
                    select: { id: true, name: true, email: true, image: true },
                  },
                },
              },
            },
          },
        },
      }),
      db.lesson.findMany({
        where: { teacherId: userId, lessonSource: "TRIAL" },
        include: {
          student: {
            select: { id: true, name: true, email: true, image: true },
          },
        },
      }),
    ]);

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

    for (const ct of courseTeachers) {
      for (const enr of ct.course.enrollments) {
        if (enr.student && !studentsMap.has(enr.student.id)) {
          studentsMap.set(enr.student.id, {
            id: enr.student.id,
            name: enr.student.name || "Course Student",
            email: enr.student.email,
            image: enr.student.image,
            courseTitle: ct.course.title,
            courseId: ct.course.id,
            instrument: ct.course.instrument,
          });
        }
      }
    }

    for (const tl of trialLessons) {
      if (tl.student && !studentsMap.has(tl.student.id)) {
        studentsMap.set(tl.student.id, {
          id: tl.student.id,
          name: tl.student.name || "Trial Student",
          email: tl.student.email,
          image: tl.student.image,
          courseTitle: "Trial Lesson",
          instrument: tl.instrument,
        });
      }
    }

    return {
      resources,
      allottedStudents: Array.from(studentsMap.values()),
    };
  },
  ["teacher-resources-data"],
  { revalidate: 30, tags: ["teacher-resources", "teacher-students"] }
);

export default async function TeacherResourcesPage() {
  const user = await requireRole(Role.TEACHER);

  let resourcesData = { resources: [] as any[], allottedStudents: [] as AllottedStudentOption[] };

  try {
    resourcesData = await getCachedTeacherResourcesData(user.id);
  } catch (err) {
    console.error("Failed to load cached teacher resources:", err);
  }

  const { resources, allottedStudents } = resourcesData;
  const isDriveReady = isStorageConfigured();

  // Format resources safely
  const formattedResources: TeacherResourceItem[] = resources.map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    fileName: r.fileName,
    fileUrl: r.fileUrl,
    fileId: r.fileId,
    fileSizeBytes: r.fileSizeBytes,
    mimeType: r.mimeType,
    createdAt: new Date(r.createdAt).toISOString(),
    shares: (r.shares || []).map((s: any) => ({
      id: s.id,
      studentId: s.studentId,
      teacherNote: s.teacherNote,
      sharedAt: new Date(s.sharedAt).toISOString(),
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

  return (
    <TeacherResourcesClient
      initialResources={formattedResources}
      allottedStudents={allottedStudents}
      isDriveReady={isDriveReady}
    />
  );
}
