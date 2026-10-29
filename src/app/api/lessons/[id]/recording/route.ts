import { NextRequest } from "next/server";
import { revalidateTag } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadToSupabase } from "@/lib/supabase-storage";
import { logger } from "@/lib/logger";
import fs from "fs";
import path from "path";

/**
 * POST /api/lessons/[id]/recording
 *
 * Automatically called when a lesson ends or client leaves.
 * Receives the recorded lesson video/audio (WebM/MP4).
 *
 * 1. Authenticates session (Teacher, Student, or Admin).
 * 2. Uploads to Supabase storage / database.
 * 3. Gracefully falls back to local server storage if database is unreachable.
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

    if (!file) {
      return Response.json(
        { error: "No recording file provided in request." },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Construct human-readable recording file name
    const existingCount = await db.lessonRecording.count({
      where: { lessonId },
    });

    const sanitize = (val: string) =>
      val.replace(/[^a-zA-Z0-9]/g, "_").replace(/_+/g, "_").trim();

    const safeInstrument = sanitize(lesson.instrument || "Lesson");
    const safeStudent = sanitize(lesson.student?.name?.split(" ")[0] || "Student");
    const safeTeacher = sanitize(lesson.teacher?.name?.split(" ")[0] || "Teacher");
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStamp = `${String(now.getUTCHours()).padStart(2, "0")}h${String(now.getUTCMinutes()).padStart(2, "0")}m`;
    const partSuffix = existingCount > 0 ? `_Part${existingCount + 1}` : "";
    const fileName = `Gandharva_${safeInstrument}_${safeStudent}_${safeTeacher}_${dateStamp}_${timeStamp}${partSuffix}.webm`;
    const mimeType = file.type || "video/webm";

    let fileUrl = "";
    let fileId: string | null = null;
    let storageBackend: "SUPABASE" | "LOCAL" = "LOCAL";

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
        "Supabase recording upload encountered an error. Falling back to local disk storage...",
      );
    }

    // 6. Fallback to local disk storage if Supabase failed
    if (storageBackend !== "SUPABASE") {
      const recordingsDir = path.join(process.cwd(), "public", "recordings");
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const localFilePath = path.join(recordingsDir, fileName);
      fs.writeFileSync(localFilePath, buffer);
      fileUrl = `/recordings/${fileName}`;
      storageBackend = "LOCAL";

      logger.info(
        { lessonId, localFilePath, fileName },
        "Lesson recording safely saved to local disk storage",
      );
    }

    // 7. Persist to database (each rejoin creates a new LessonRecording entry)
    const recordingRecord = await db.lessonRecording.create({
      data: {
        lessonId,
        fileUrl,
        fileId,
        fileName,
        fileSizeBytes: buffer.length,
        durationSeconds,
        storageBackend,
      },
    });

    // Calculate total cumulative duration for the lesson across all parts
    const sumAgg = await db.lessonRecording.aggregate({
      where: { lessonId },
      _sum: { durationSeconds: true },
    });
    const cumulativeDuration = sumAgg._sum.durationSeconds || durationSeconds;

    await db.lesson.update({
      where: { id: lessonId },
      data: {
        recordingUrl: fileUrl,
        recordingFileId: fileId,
        recordingDurationSeconds: cumulativeDuration,
      },
    });

    if (lesson.groupRoomId) {
      await db.lesson.updateMany({
        where: { groupRoomId: lesson.groupRoomId },
        data: {
          recordingUrl: fileUrl,
          recordingFileId: fileId,
          recordingDurationSeconds: cumulativeDuration,
        },
      });
    }

    try {
      revalidateTag("admin-recordings", "max");
      revalidateTag("admin-lessons", "max");
    } catch {
      // Revalidation during non-cache contexts is safe to ignore
    }

    return Response.json({
      success: true,
      recordingId: recordingRecord.id,
      fileUrl,
      fileId,
      storageBackend,
      uploadError: uploadError ? uploadError : undefined,
    });
  } catch (error) {
    logger.error({ error }, "Failed to process lesson recording upload");
    const message =
      error instanceof Error ? error.message : "Recording upload failed.";
    return Response.json({ error: message }, { status: 500 });
  }
}
