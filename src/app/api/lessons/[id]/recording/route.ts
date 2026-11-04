import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadToSupabase } from "@/lib/supabase-storage";
import { logger } from "@/lib/logger";
import { createHash, randomUUID } from "node:crypto";

/**
 * POST /api/lessons/[id]/recording
 *
 * Automatically called when a lesson ends or client leaves.
 * Receives the recorded lesson video/audio (WebM/MP4).
 *
 * 1. Authenticates session (Teacher, Student, or Admin).
 * 2. Uploads to Supabase storage / database.
 * 3. Atomically saves media bytes in Postgres if object storage is unavailable.
 * 4. Persists the recording metadata to Lesson and LessonRecording models.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: lessonId } = await params;

    // 1. Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json(
        { error: "Unauthorized. Must be signed in to upload recordings." },
        { status: 401 },
      );
    }

    // 2. Fetch lesson to verify participation & metadata
    const lesson = await db.lesson.findUnique({
      where: { id: lessonId },
      include: {
        teacher: { select: { id: true, name: true } },
        student: { select: { id: true, name: true } },
      },
    });

    if (!lesson) {
      return Response.json({ error: "Lesson not found." }, { status: 404 });
    }

    const userId = session.user.id;
    const isParticipant =
      lesson.teacherId === userId ||
      lesson.studentId === userId ||
      session.user.role === "ADMIN";

    if (!isParticipant) {
      return Response.json(
        { error: "Forbidden. Only participants or admins can save recordings." },
        { status: 403 },
      );
    }

    // 3. Parse uploaded file from formData
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const durationSecondsRaw = formData.get("durationSeconds") as string | null;
    const durationSeconds = durationSecondsRaw
      ? parseInt(durationSecondsRaw, 10)
      : null;

    if (!(file instanceof File) || !file.size || file.size > 32 * 1024 * 1024) {
      return Response.json(
        { error: "A nonempty recording of up to 32 MB is required." },
        { status: 400 },
      );
    }

    const segment = formData.get("segmentId");
    const recordingId = typeof segment === "string" && /^[a-f0-9-]{36}$/i.test(segment)
      ? createHash("sha256").update(`${lessonId}/${userId}/${segment}`).digest("hex")
      : randomUUID();
    const existing = await db.lessonRecording.findUnique({ where: { id: recordingId } });
    if (existing) return Response.json({ success: true, recordingId, fileUrl: existing.fileUrl, storageBackend: existing.storageBackend });
    const buffer = Buffer.from(await file.arrayBuffer());
    const isWebm = buffer.readUIntBE(0, Math.min(4, buffer.length)) === 0x1a45dfa3;
    const isMp4 = buffer.toString("ascii", 4, 8) === "ftyp";
    if (!isWebm && !isMp4) return Response.json({ error: "Invalid recording file" }, { status: 422 });

    const sanitize = (val: string) =>
      val.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim();

    const safeInstrument = sanitize(lesson.instrument || "Lesson");
    const safeStudent = sanitize(lesson.student?.name?.split(" ")[0] || "Student");
    const safeTeacher = sanitize(lesson.teacher?.name?.split(" ")[0] || "Teacher");
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStamp = `${String(now.getUTCHours()).padStart(2, "0")}h${String(now.getUTCMinutes()).padStart(2, "0")}m`;
    const partSuffix = `_${recordingId}`;
    const mimeType = isMp4 ? "video/mp4" : "video/webm";
    const extension = mimeType.split(";")[0].toLowerCase() === "video/mp4" ? "mp4" : "webm";
    const fileName = `Gandharva_${safeInstrument}_${safeStudent}_${safeTeacher}_${dateStamp}_${timeStamp}${partSuffix}.${extension}`;

    let fileUrl = "";
    let fileId: string | null = null;
    let storageBackend: "SUPABASE" | "DATABASE" = "DATABASE";

    // 5. Upload to Supabase storage / database
    let uploadError: string | null = null;
    try {
      const uploadResult = await uploadToSupabase(buffer, fileName, mimeType, {
        bucket: "recordings",
        preserveExactName: true,
      });
      fileUrl = uploadResult.fileUrl;
      fileId = uploadResult.fileId;
      storageBackend = "SUPABASE";
      logger.info(
        { lessonId, fileId, fileName, backend: uploadResult.storageBackend },
        "Lesson recording successfully stored in Supabase",
      );
    } catch (err: unknown) {
      uploadError = err instanceof Error ? err.message : String(err);
      logger.warn(
        { error: uploadError, lessonId },
        "Object storage rejected the recording. Saving the media in the lesson database.",
      );
    }

    if (storageBackend === "DATABASE") {
      fileUrl = `/api/lessons/${lessonId}/playback?part=${recordingId}`;
    }

    // 7. Determine participant join/leave timestamps for this recording snapshot
    const isTeacher = userId === lesson.teacherId;
    const isStudent = userId === lesson.studentId;

    const teacherJoinedAtRaw = formData.get("teacherJoinedAt") as string | null;
    const teacherLeftAtRaw = formData.get("teacherLeftAt") as string | null;
    const studentJoinedAtRaw = formData.get("studentJoinedAt") as string | null;
    const studentLeftAtRaw = formData.get("studentLeftAt") as string | null;

    const teacherJoinedAt = teacherJoinedAtRaw
      ? new Date(teacherJoinedAtRaw)
      : lesson.teacherJoinedAt || (isTeacher ? now : null);
    const teacherLeftAt = teacherLeftAtRaw
      ? new Date(teacherLeftAtRaw)
      : isTeacher
      ? now
      : lesson.teacherLeftAt;
    const studentJoinedAt = studentJoinedAtRaw
      ? new Date(studentJoinedAtRaw)
      : lesson.studentJoinedAt || (isStudent ? now : null);
    const studentLeftAt = studentLeftAtRaw
      ? new Date(studentLeftAtRaw)
      : isStudent
      ? now
      : lesson.studentLeftAt;

    // Commit the file reference, fallback bytes and archive summary together.
    const recordingRecord = await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Lesson" WHERE id = ${lessonId} FOR UPDATE`;
      const saved = await tx.lessonRecording.findUnique({ where: { id: recordingId } });
      if (saved) return saved;
      const record = await tx.lessonRecording.create({ data: {
        id: recordingId, lessonId, fileUrl, fileId, fileName, fileSizeBytes: buffer.length,
        durationSeconds, storageBackend, teacherJoinedAt, teacherLeftAt, studentJoinedAt, studentLeftAt,
      } });
      if (storageBackend === "DATABASE") {
        await tx.$executeRaw`INSERT INTO "LessonRecordingMedia" ("recordingId", "mimeType", "bytes")
          VALUES (${record.id}, ${mimeType}, ${buffer})`;
      }
      const sum = await tx.lessonRecording.aggregate({ where: { lessonId }, _sum: { durationSeconds: true } });
      await tx.lesson.updateMany({
        where: lesson.groupRoomId ? { groupRoomId: lesson.groupRoomId } : { id: lessonId },
        data: { recordingUrl: fileUrl, recordingFileId: fileId, recordingDurationSeconds: sum._sum.durationSeconds },
      });
      return record;
    }, { timeout: 30000 });

    try {
      revalidateTag("admin-recordings", "max");
      revalidateTag("admin-lessons", "max");
      revalidateTag("student-recordings", "max");
      revalidateTag("lessons", "max");
    } catch {
      // Revalidation during non-cache contexts is safe to ignore
    }

    return Response.json({
      success: true,
      recordingId: recordingRecord.id,
      fileUrl: recordingRecord.fileUrl,
      fileId: recordingRecord.fileId,
      storageBackend: recordingRecord.storageBackend,
    });
  } catch (error) {
    logger.error({ error }, "Failed to process lesson recording upload");
    const message =
      error instanceof Error ? error.message : "Recording upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
