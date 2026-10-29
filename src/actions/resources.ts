"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Role, ResourceCategory, NotificationType } from "@prisma/client";
import { uploadToSupabase, deleteFromSupabase, isStorageConfigured } from "@/lib/supabase-storage";
import { createNotification } from "@/actions/notifications";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";

export type ResourceActionResponse<T = unknown> = {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
};

// ─── Maximum file size: 25 MB ────────────────────────────────────────────────
const MAX_RESOURCE_SIZE = 25 * 1024 * 1024;

// ─── Allowed extensions ──────────────────────────────────────────────────────
const ALLOWED_EXTENSIONS = [
  "pdf",
  "mp3",
  "wav",
  "m4a",
  "ogg",
  "doc",
  "docx",
  "txt",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "zip",
  "mp4",
];

// ─── 1. Upload Resource (Teacher only) ────────────────────────────────────────

export async function uploadResourceAction(
  formData: FormData
): Promise<ResourceActionResponse<{ id: string; title: string; fileUrl: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required." };
    }

    if (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN) {
      return {
        success: false,
        error: "Only faculty members can upload learning resources.",
      };
    }

    const title = formData.get("title")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || null;
    const categoryRaw = formData.get("category")?.toString() || "SHEET_MUSIC";
    const file = formData.get("file") as File | null;

    if (!title || title.length < 2) {
      return {
        success: false,
        error: "Resource title must be at least 2 characters long.",
      };
    }

    if (!file || file.size === 0) {
      return { success: false, error: "Please select a file to upload." };
    }

    if (file.size > MAX_RESOURCE_SIZE) {
      return {
        success: false,
        error: "File size exceeds the 25MB limit. Please compress or select a smaller file.",
      };
    }

    const fileExt = file.name.split(".").pop()?.toLowerCase() || "";
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      return {
        success: false,
        error: `File format .${fileExt} is not supported. Allowed formats: PDF, MP3, WAV, DOC, DOCX, Images, MP4, ZIP.`,
      };
    }

    if (!isStorageConfigured()) {
      return {
        success: false,
        error:
          "Supabase storage is not configured on this platform. Please contact administration.",
      };
    }

    // Convert file to buffer and upload to Supabase
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResult = await uploadToSupabase(
      buffer,
      file.name,
      file.type || "application/octet-stream",
      { bucket: "resources" }
    );

    // Save resource record in DB
    const category = Object.values(ResourceCategory).includes(categoryRaw as ResourceCategory)
      ? (categoryRaw as ResourceCategory)
      : ResourceCategory.SHEET_MUSIC;

    const resource = await db.resource.create({
      data: {
        teacherId: session.user.id,
        title,
        description,
        category,
        fileName: file.name,
        fileUrl: uploadResult.fileUrl,
        fileId: uploadResult.fileId,
        fileSizeBytes: uploadResult.fileSizeBytes,
        mimeType: uploadResult.mimeType,
      },
    });

    logger.info(
      { teacherId: session.user.id, resourceId: resource.id, fileName: file.name },
      "Teacher uploaded new learning resource to Supabase"
    );

    revalidatePath("/teacher/dashboard/resources");
    revalidatePath("/student/dashboard/resources");
    revalidatePath("/admin/resources");

    return {
      success: true,
      message: `"${title}" successfully uploaded to Supabase!`,
      data: {
        id: resource.id,
        title: resource.title,
        fileUrl: resource.fileUrl,
      },
    };
  } catch (err) {
    logger.error({ err }, "Error in uploadResourceAction");
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while uploading resource.",
    };
  }
}

// ─── 2. Delete Resource (Teacher only) ────────────────────────────────────────

export async function deleteResourceAction(
  resourceId: string
): Promise<ResourceActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required." };
    }

    const resource = await db.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return { success: false, error: "Resource not found." };
    }

    // Permission check: must be owner or admin
    if (resource.teacherId !== session.user.id && session.user.role !== Role.ADMIN) {
      return { success: false, error: "You do not have permission to delete this resource." };
    }

    // Try deleting file from Supabase
    if (resource.fileId) {
      await deleteFromSupabase(resource.fileId, "resources").catch(() => {});
    }

    // Delete from DB (cascades to ResourceShare)
    await db.resource.delete({
      where: { id: resourceId },
    });

    logger.info({ resourceId, teacherId: session.user.id }, "Resource deleted");

    revalidatePath("/teacher/dashboard/resources");
    revalidatePath("/student/dashboard/resources");
    revalidatePath("/admin/resources");

    return {
      success: true,
      message: "Resource removed successfully.",
    };
  } catch (err) {
    logger.error({ err, resourceId }, "Error in deleteResourceAction");
    return {
      success: false,
      error: "Failed to delete resource. Please try again.",
    };
  }
}

// ─── 3. Send / Share Resource with Course-Allotted Students ──────────────────

export async function shareResourceAction({
  resourceId,
  studentIds,
  courseId,
  teacherNote,
}: {
  resourceId: string;
  studentIds: string[];
  courseId?: string;
  teacherNote?: string;
}): Promise<ResourceActionResponse<{ sharedCount: number }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required." };
    }

    if (!studentIds || studentIds.length === 0) {
      return { success: false, error: "Please select at least one student to receive this resource." };
    }

    const resource = await db.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource) {
      return { success: false, error: "Resource not found." };
    }

    if (resource.teacherId !== session.user.id && session.user.role !== Role.ADMIN) {
      return { success: false, error: "Unauthorized access to this resource." };
    }

    const teacherUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { name: true },
    });
    const teacherName = teacherUser?.name || "Your Teacher";

    let sharedCount = 0;

    for (const studentId of studentIds) {
      // Upsert share record
      await db.resourceShare.upsert({
        where: {
          resourceId_studentId: {
            resourceId,
            studentId,
          },
        },
        create: {
          resourceId,
          studentId,
          courseId: courseId || null,
          teacherNote: teacherNote?.trim() || null,
          sharedAt: new Date(),
          isViewed: false,
        },
        update: {
          courseId: courseId || undefined,
          teacherNote: teacherNote?.trim() || undefined,
          sharedAt: new Date(),
        },
      });

      // Send real-time notification to the student
      try {
        await createNotification({
          userId: studentId,
          type: NotificationType.NEW_RESOURCE_SHARED,
          title: "New Learning Material",
          body: `Maestro ${teacherName} shared "${resource.title}" with you.${
            teacherNote ? ` Note: "${teacherNote.slice(0, 80)}..."` : ""
          }`,
          link: "/student/dashboard/resources",
        });
      } catch {
        // Non-blocking notification
      }

      sharedCount++;
    }

    revalidatePath("/teacher/dashboard/resources");
    revalidatePath("/student/dashboard/resources");
    revalidatePath("/admin/resources");

    return {
      success: true,
      message: `Resource sent to ${sharedCount} student${sharedCount === 1 ? "" : "s"} successfully!`,
      data: { sharedCount },
    };
  } catch (err) {
    logger.error({ err, resourceId }, "Error in shareResourceAction");
    return {
      success: false,
      error: "Failed to share resource with students.",
    };
  }
}

// ─── 4. Unshare Resource with a student ──────────────────────────────────────

export async function unshareResourceAction(
  resourceId: string,
  studentId: string
): Promise<ResourceActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return { success: false, error: "Authentication required." };
    }

    const resource = await db.resource.findUnique({
      where: { id: resourceId },
    });

    if (!resource || (resource.teacherId !== session.user.id && session.user.role !== Role.ADMIN)) {
      return { success: false, error: "Unauthorized." };
    }

    await db.resourceShare.deleteMany({
      where: {
        resourceId,
        studentId,
      },
    });

    revalidatePath("/teacher/dashboard/resources");
    revalidatePath("/student/dashboard/resources");
    revalidatePath("/admin/resources");

    return {
      success: true,
      message: "Access revoked for student.",
    };
  } catch (err) {
    logger.error({ err }, "Error in unshareResourceAction");
    return {
      success: false,
      error: "Failed to revoke access.",
    };
  }
}

// ─── 5. Mark Resource as Viewed (Student) ────────────────────────────────────

export async function markResourceViewedAction(shareId: string): Promise<ResourceActionResponse> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Unauthorized" };

    await db.resourceShare.updateMany({
      where: {
        id: shareId,
        studentId: session.user.id,
      },
      data: {
        isViewed: true,
        viewedAt: new Date(),
      },
    });

    return { success: true };
  } catch {
    return { success: false, error: "Failed to update status." };
  }
}

// ─── 6. Fetch Teacher's Uploaded Resources ───────────────────────────────────

export async function getTeacherResources() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db.resource.findMany({
    where: { teacherId: session.user.id },
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
  });
}

// ─── 7. Fetch Teacher's Allotted Students (for sharing dropdown) ─────────────

export type AllottedStudentOption = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  courseTitle?: string | null;
  courseId?: string | null;
  instrument?: string | null;
};

export async function getTeacherAllottedStudents(): Promise<AllottedStudentOption[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const teacherId = session.user.id;

  // 1. Enrolled students assigned to this teacher
  const enrollments = await db.enrollment.findMany({
    where: { teacherId },
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
  });

  // 2. Courses where this teacher is listed in CourseTeacher
  const courseTeachers = await db.courseTeacher.findMany({
    where: { teacherId },
    include: {
      course: {
        include: {
          enrollments: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  image: true,
                },
              },
            },
          },
        },
      },
    },
  });

  // 3. Trial students who had a lesson scheduled with this teacher
  const trialLessons = await db.lesson.findMany({
    where: { teacherId, lessonSource: "TRIAL" },
    include: {
      student: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
  });

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
        courseTitle: `Trial (${tl.instrument})`,
        courseId: null,
        instrument: tl.instrument,
      });
    }
  }

  return Array.from(studentsMap.values());
}

// ─── 8. Fetch Student's Received Resources ───────────────────────────────────

export async function getStudentReceivedResources() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db.resourceShare.findMany({
    where: { studentId: session.user.id },
    orderBy: { sharedAt: "desc" },
    include: {
      resource: {
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
  });
}

// ─── 9. Fetch All Resources for Admin ─────────────────────────────────────────

export async function getAdminResources() {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return [];

  return db.resource.findMany({
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
  });
}

// ─── 10. Fetch All Students for Admin Resource Sharing ──────────────────────

export async function getAdminAllStudents(): Promise<AllottedStudentOption[]> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== Role.ADMIN) return [];

  const enrollments = await db.enrollment.findMany({
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
  });

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

  const allStudents = await db.user.findMany({
    where: { role: Role.STUDENT },
    select: { id: true, name: true, email: true, image: true },
    take: 100,
  });

  for (const st of allStudents) {
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

  return Array.from(studentsMap.values());
}
