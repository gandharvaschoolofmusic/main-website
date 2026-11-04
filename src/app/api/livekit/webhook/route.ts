import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { WebhookReceiver, EgressStatus } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AuthRateLimits } from "@/lib/rate-limit";
import { startLessonRoomEgress, stopActiveRoomEgressByRoom } from "@/lib/livekit";
import { recordParticipantJoin, recordParticipantLeave } from "@/lib/attendance";
import { recordingPlaybackUrl } from "@/lib/supabase-storage";

const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
const apiSecret =
  process.env.LIVEKIT_API_SECRET ||
  "toneroom_dev_secret_key_minimum_32_characters_long_01";

const receiver = new WebhookReceiver(apiKey, apiSecret);

/**
 * LiveKit Webhook Endpoint
 *
 * Receives cryptographically signed server events from LiveKit.
 *
 * Handled events:
 * 1. `participant_joined`: Records teacherJoinedAt or studentJoinedAt timestamps.
 * 2. `room_finished`: Automatically marks scheduled lesson as COMPLETED.
 * 3. `participant_left`: Logs participant exit.
 *
 * Security:
 * - WebhookReceiver cryptographically validates the Authorization header using HMAC-SHA256.
 * - Sliding window rate limiter protects the endpoint against abusive traffic.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const clientIp =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "127.0.0.1";

  try {
    AuthRateLimits.checkWebhook(clientIp);
  } catch {
    logger.warn({ clientIp }, "LiveKit webhook rate limit exceeded");
    return NextResponse.json(
      { error: "Too many webhook requests" },
      { status: 429 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    logger.warn({ clientIp }, "LiveKit webhook request missing authorization header");
    return NextResponse.json(
      { error: "Missing authorization header" },
      { status: 401 },
    );
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (err) {
    logger.error({ err }, "Failed to read LiveKit webhook request body");
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  let event;
  try {
    event = await receiver.receive(rawBody, authHeader);
  } catch (err) {
    logger.warn(
      { err, clientIp },
      "Invalid LiveKit webhook signature or authorization token",
    );
    return NextResponse.json(
      { error: "Invalid webhook signature" },
      { status: 401 },
    );
  }

  const roomName = event.room?.name || event.egressInfo?.roomName;
  logger.info(
    { eventType: event.event, roomName, participant: event.participant?.identity, egressId: event.egressInfo?.egressId },
    "Received valid LiveKit webhook event",
  );

  // Determine room type: individual "lesson-{id}" or group "group-{...}"
  const isIndividualRoom = roomName?.startsWith("lesson-");
  const isGroupRoom = roomName?.startsWith("group-");

  if (!roomName || (!isIndividualRoom && !isGroupRoom)) {
    return NextResponse.json({ received: true, ignored: "non-lesson-room" });
  }

  try {
    if (isIndividualRoom) {
      // ─── Individual 1:1 Lesson Room ───
      const lessonId = roomName.slice("lesson-".length);
      await handleIndividualRoom(event, lessonId);
    } else if (isGroupRoom) {
      // ─── Group Course Room ───
      await handleGroupRoom(event, roomName);
    }
  } catch (err) {
    logger.error(
      { err, roomName, eventType: event.event },
      "Error processing LiveKit webhook database update",
    );
    return NextResponse.json(
      { error: "Internal processing error" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}

/**
 * Converts any raw storage location (Supabase S3, AWS S3, Cloudflare R2, or custom bucket URL)
 * into a valid, browser-playable public HTTPS video URL.
 */
function resolvePublicRecordingUrl(location: string): string | null {
  if (!location) return null;
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const endpoint = process.env.LIVEKIT_S3_ENDPOINT || process.env.S3_ENDPOINT;
  if (location.startsWith("s3://")) {
    const { hostname: bucket, pathname } = new URL(location);
    if (project && (!endpoint || new URL(endpoint).pathname.includes("/storage/v1/s3"))) {
      return new URL(`/storage/v1/object/public/${bucket}${pathname}`, project).href;
    }
    if (endpoint) return new URL(`${bucket}${pathname}`, endpoint.replace(/\/?$/, "/")).href;
    return `https://${bucket}.s3.amazonaws.com${pathname}`;
  }
  if (!/^https?:\/\//i.test(location)) return null;
  const url = new URL(location);
  if (project && (url.hostname === new URL(project).hostname || url.hostname === new URL(project).hostname.replace(".supabase.co", ".storage.supabase.co")) && url.pathname.includes("/storage/v1/s3/")) {
    return new URL(url.pathname.replace("/storage/v1/s3/", "/storage/v1/object/public/"), project).href;
  }
  return location;
}

/**
 * Handle webhook events for individual 1:1 lesson rooms (lesson-{lessonId}).
 */
async function handleIndividualRoom(event: any, lessonId: string) {
  switch (event.event) {
    case "participant_joined": {
      const participantIdentity = event.participant?.identity;
      if (!participantIdentity) break;

      const lesson = await db.lesson.findUnique({
        where: { id: lessonId },
        include: { teacherProfile: true },
      });

      if (!lesson) {
        logger.warn({ lessonId }, "Webhook received for non-existent lesson");
        break;
      }

      const isTeacher = participantIdentity === lesson.teacherProfile.userId;
      const isStudent = participantIdentity === lesson.studentId;

      if (isTeacher) {
        await recordParticipantJoin({
          lessonId,
          userId: participantIdentity,
          userRole: "TEACHER",
          userName: event.participant?.name,
        });
      } else if (isStudent) {
        await recordParticipantJoin({
          lessonId,
          userId: participantIdentity,
          userRole: "STUDENT",
          userName: event.participant?.name,
        });
      }

      // Automatically initiate LiveKit server-side Room Composite Egress recording
      startLessonRoomEgress({
        roomName: `lesson-${lessonId}`,
        lessonId,
      }).catch((err) => {
        logger.warn(
          { err, lessonId },
          "Could not initiate LiveKit server-side Egress recording on participant_joined",
        );
      });
      break;
    }

    case "room_finished": {
      const lesson = await db.lesson.findUnique({
        where: { id: lessonId },
      });

      if (lesson) {
        if (lesson.teacherId) {
          await recordParticipantLeave({
            lessonId,
            userId: lesson.teacherId,
            userRole: "TEACHER",
          });
        }
        if (lesson.studentId) {
          await recordParticipantLeave({
            lessonId,
            userId: lesson.studentId,
            userRole: "STUDENT",
          });
        }

        const now = new Date();
        const updateData: {
          status?: "COMPLETED";
          teacherLeftAt?: Date;
          studentLeftAt?: Date;
        } = {};

        if (lesson.status === "SCHEDULED") {
          updateData.status = "COMPLETED";
        }
        if (lesson.teacherJoinedAt && !lesson.teacherLeftAt) {
          updateData.teacherLeftAt = now;
        }
        if (lesson.studentJoinedAt && !lesson.studentLeftAt) {
          updateData.studentLeftAt = now;
        }

        if (Object.keys(updateData).length > 0) {
          await db.lesson.update({
            where: { id: lessonId },
            data: updateData,
          });
        }
        logger.info(
          { lessonId, updateData },
          "Handled room_finished webhook event and finalized timestamps",
        );
      }

      // Ensure any active LiveKit Room Egress is stopped
      stopActiveRoomEgressByRoom(`lesson-${lessonId}`).catch((err) => {
        logger.warn({ err, lessonId }, "Failed to stop active room egress on room_finished");
      });
      break;
    }

    case "egress_ended": {
      const egressInfo = event.egressInfo;
      if (!egressInfo || egressInfo.status !== EgressStatus.EGRESS_COMPLETE) break;

      const fileResults = egressInfo.fileResults || [];
      if (fileResults.length === 0) {
        logger.warn(
          { egressId: egressInfo.egressId, lessonId, status: egressInfo.status, error: egressInfo.error },
          "LiveKit Egress ended with no output file results",
        );
        break;
      }

      const primaryFile = fileResults[0];
      const rawLocation = primaryFile.location || "";
      const durationSeconds = primaryFile.duration
        ? Math.max(1, Math.round(Number(primaryFile.duration) / 1_000_000_000))
        : null;
      const fileSizeBytes = primaryFile.size ? Number(primaryFile.size) : 0;
      const rawFileName = primaryFile.filename || `lesson_${lessonId}_${Date.now()}.mp4`;
      const cleanFileName = rawFileName.split("/").pop() || rawFileName;

      const fileUrl = resolvePublicRecordingUrl(rawLocation);
      if (!fileUrl || fileSizeBytes <= 0) {
        logger.warn({ egressId: egressInfo.egressId }, "Recording ended without a delivered file");
        break;
      }
      if (!await recordingPlaybackUrl(fileUrl)) {
        // A retry can succeed if the storage catalog has not caught up with delivery.
        throw new Error("Delivered recording is missing from object storage");
      }

      const lesson = await db.lesson.findUnique({
        where: { id: lessonId },
      });

      if (!lesson) {
        logger.warn({ lessonId }, "LiveKit Egress ended for non-existent lesson");
        break;
      }

      const recordingRecord = await db.lessonRecording.create({
        data: {
          lessonId,
          fileUrl,
          fileId: egressInfo.egressId || null,
          fileName: cleanFileName,
          fileSizeBytes,
          durationSeconds,
          storageBackend: "LIVEKIT_EGRESS",
          teacherJoinedAt: lesson.teacherJoinedAt,
          teacherLeftAt: lesson.teacherLeftAt,
          studentJoinedAt: lesson.studentJoinedAt,
          studentLeftAt: lesson.studentLeftAt,
        },
      });

      // Sum all recording parts for cumulative duration
      const sumAgg = await db.lessonRecording.aggregate({
        where: { lessonId },
        _sum: { durationSeconds: true },
      });
      const cumulativeDuration = sumAgg._sum.durationSeconds || durationSeconds;

      await db.lesson.update({
        where: { id: lessonId },
        data: {
          recordingUrl: fileUrl,
          recordingFileId: egressInfo.egressId || null,
          recordingDurationSeconds: cumulativeDuration,
        },
      });

      logger.info(
        { lessonId, fileUrl, recordingId: recordingRecord.id, durationSeconds, fileSizeBytes },
        "Successfully saved LiveKit Egress recording metadata to database",
      );

      try {
        revalidateTag("admin-recordings", "max");
        revalidateTag("admin-lessons", "max");
        revalidateTag("student-recordings", "max");
        revalidateTag("lessons", "max");
      } catch {}

      break;
    }

    case "participant_left": {
      const participantIdentity = event.participant?.identity;
      if (!participantIdentity) break;

      const lesson = await db.lesson.findUnique({
        where: { id: lessonId },
        include: { teacherProfile: true },
      });

      if (!lesson) break;

      const isTeacher = participantIdentity === lesson.teacherProfile.userId;
      const isStudent = participantIdentity === lesson.studentId;

      if (isTeacher) {
        await recordParticipantLeave({
          lessonId,
          userId: participantIdentity,
          userRole: "TEACHER",
        });
      } else if (isStudent) {
        await recordParticipantLeave({
          lessonId,
          userId: participantIdentity,
          userRole: "STUDENT",
        });
      }
      break;
    }

    default:
      logger.debug(
        { eventType: event.event, lessonId },
        "Unhandled LiveKit webhook event type",
      );
  }
}

/**
 * Handle webhook events for group course rooms (group-{courseId}-{teacherProfileId}-{lessonNumber}-{timestamp}).
 * All lessons sharing the same groupRoomId belong to the same physical classroom.
 */
async function handleGroupRoom(event: any, groupRoomId: string) {
  switch (event.event) {
    case "participant_joined": {
      const participantIdentity = event.participant?.identity;
      if (!participantIdentity) break;

      // Find all lessons in this group classroom
      const groupLessons = await db.lesson.findMany({
        where: { groupRoomId, status: "SCHEDULED" },
        include: { teacherProfile: true },
      });

      if (groupLessons.length === 0) {
        logger.warn({ groupRoomId }, "No scheduled lessons found for group room");
        break;
      }

      const now = new Date();

      // Check if the joining participant is the teacher (same for all group lessons)
      const isTeacher = groupLessons.some(
        (l) => l.teacherProfile.userId === participantIdentity,
      );

      if (isTeacher) {
        for (const lesson of groupLessons) {
          await recordParticipantJoin({
            lessonId: lesson.id,
            userId: participantIdentity,
            userRole: "TEACHER",
            userName: event.participant?.name,
          });
        }
        logger.info(
          { groupRoomId, teacherId: participantIdentity, count: groupLessons.length },
          "Recorded teacher join across group room lessons",
        );
      } else {
        // Student joined — find their specific lesson row and record join
        const studentLesson = groupLessons.find(
          (l) => l.studentId === participantIdentity,
        );
        if (studentLesson) {
          await recordParticipantJoin({
            lessonId: studentLesson.id,
            userId: participantIdentity,
            userRole: "STUDENT",
            userName: event.participant?.name,
          });
          logger.info(
            { groupRoomId, studentId: participantIdentity, lessonId: studentLesson.id },
            "Recorded student join for group room student",
          );
        }
      }

      // Automatically initiate LiveKit server-side Room Composite Egress recording for group room
      startLessonRoomEgress({
        roomName: groupRoomId,
        groupRoomId,
      }).catch((err) => {
        logger.warn(
          { err, groupRoomId },
          "Failed to initiate LiveKit server-side Egress recording for group room",
        );
      });
      break;
    }

    case "room_finished": {
      const now = new Date();
      // Mark ALL scheduled lessons in this group room as COMPLETED and record participant exits
      const groupLessons = await db.lesson.findMany({
        where: { groupRoomId },
      });

      for (const l of groupLessons) {
        if (l.teacherId) {
          await recordParticipantLeave({
            lessonId: l.id,
            userId: l.teacherId,
            userRole: "TEACHER",
          });
        }
        if (l.studentId) {
          await recordParticipantLeave({
            lessonId: l.id,
            userId: l.studentId,
            userRole: "STUDENT",
          });
        }
      }

      const result = await db.lesson.updateMany({
        where: { groupRoomId, status: "SCHEDULED" },
        data: { status: "COMPLETED" },
      });

      // Update teacherLeftAt where teacher joined but leftAt is null
      await db.lesson.updateMany({
        where: { groupRoomId, teacherJoinedAt: { not: null }, teacherLeftAt: null },
        data: { teacherLeftAt: now },
      });

      // Update studentLeftAt where student joined but leftAt is null
      await db.lesson.updateMany({
        where: { groupRoomId, studentJoinedAt: { not: null }, studentLeftAt: null },
        data: { studentLeftAt: now },
      });

      logger.info(
        { groupRoomId, completedCount: result.count },
        "Marked group room lessons as COMPLETED and set exit timestamps upon room_finished",
      );

      // Clean up any remaining active LiveKit Room Egress for group room
      stopActiveRoomEgressByRoom(groupRoomId).catch((err) => {
        logger.warn({ err, groupRoomId }, "Failed to stop active group room egress on room_finished");
      });
      break;
    }

    case "egress_ended": {
      const egressInfo = event.egressInfo;
      if (!egressInfo || egressInfo.status !== EgressStatus.EGRESS_COMPLETE) break;

      const fileResults = egressInfo.fileResults || [];
      if (fileResults.length === 0) {
        logger.warn(
          { egressId: egressInfo.egressId, groupRoomId, status: egressInfo.status, error: egressInfo.error },
          "LiveKit Egress ended with no output file results for group room",
        );
        break;
      }

      const primaryFile = fileResults[0];
      const rawLocation = primaryFile.location || "";
      const durationSeconds = primaryFile.duration
        ? Math.max(1, Math.round(Number(primaryFile.duration) / 1_000_000_000))
        : null;
      const fileSizeBytes = primaryFile.size ? Number(primaryFile.size) : 0;
      const rawFileName = primaryFile.filename || `group_${groupRoomId}_${Date.now()}.mp4`;
      const cleanFileName = rawFileName.split("/").pop() || rawFileName;

      const fileUrl = resolvePublicRecordingUrl(rawLocation);
      if (!fileUrl || fileSizeBytes <= 0) {
        logger.warn({ egressId: egressInfo.egressId }, "Recording ended without a delivered file");
        break;
      }
      if (!await recordingPlaybackUrl(fileUrl)) {
        // A retry can succeed if the storage catalog has not caught up with delivery.
        throw new Error("Delivered recording is missing from object storage");
      }

      const groupLessons = await db.lesson.findMany({
        where: { groupRoomId },
      });

      for (const l of groupLessons) {
        await db.lessonRecording.create({
          data: {
            lessonId: l.id,
            fileUrl,
            fileId: egressInfo.egressId || null,
            fileName: cleanFileName,
            fileSizeBytes,
            durationSeconds,
            storageBackend: "LIVEKIT_EGRESS",
            teacherJoinedAt: l.teacherJoinedAt,
            teacherLeftAt: l.teacherLeftAt,
            studentJoinedAt: l.studentJoinedAt,
            studentLeftAt: l.studentLeftAt,
          },
        });
      }

      await db.lesson.updateMany({
        where: { groupRoomId },
        data: {
          recordingUrl: fileUrl,
          recordingFileId: egressInfo.egressId || null,
          ...(durationSeconds ? { recordingDurationSeconds: durationSeconds } : {}),
        },
      });

      logger.info(
        { groupRoomId, fileUrl, lessonCount: groupLessons.length, durationSeconds, fileSizeBytes },
        "Successfully saved group room LiveKit Egress recording metadata to database",
      );

      try {
        revalidateTag("admin-recordings", "max");
        revalidateTag("admin-lessons", "max");
        revalidateTag("student-recordings", "max");
        revalidateTag("lessons", "max");
      } catch {}

      break;
    }

    case "participant_left": {
      const participantIdentity = event.participant?.identity;
      if (!participantIdentity) break;

      const groupLessons = await db.lesson.findMany({
        where: { groupRoomId },
        include: { teacherProfile: true },
      });

      if (groupLessons.length === 0) break;

      const now = new Date();
      const isTeacher = groupLessons.some(
        (l) => l.teacherProfile.userId === participantIdentity,
      );

      if (isTeacher) {
        for (const l of groupLessons) {
          await recordParticipantLeave({
            lessonId: l.id,
            userId: participantIdentity,
            userRole: "TEACHER",
          });
        }
        logger.info(
          { groupRoomId, teacherId: participantIdentity, timestamp: now },
          "Recorded teacher exit across group room lessons",
        );
      } else {
        const studentLesson = groupLessons.find(
          (l) => l.studentId === participantIdentity,
        );
        if (studentLesson) {
          await recordParticipantLeave({
            lessonId: studentLesson.id,
            userId: participantIdentity,
            userRole: "STUDENT",
          });
          logger.info(
            { groupRoomId, studentId: participantIdentity, lessonId: studentLesson.id, timestamp: now },
            "Recorded student exit for group room student",
          );
        }
      }
      break;
    }

    default:
      logger.debug(
        { eventType: event.event, groupRoomId },
        "Unhandled LiveKit webhook event type for group room",
      );
  }
}
