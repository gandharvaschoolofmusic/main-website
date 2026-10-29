import { NextRequest, NextResponse } from "next/server";
import { WebhookReceiver } from "livekit-server-sdk";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { AuthRateLimits } from "@/lib/rate-limit";

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

  const roomName = event.room?.name;
  logger.info(
    { eventType: event.event, roomName, participant: event.participant?.identity },
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

      const now = new Date();
      const isTeacher = participantIdentity === lesson.teacherProfile.userId;
      const isStudent = participantIdentity === lesson.studentId;

      if (isTeacher && !lesson.teacherJoinedAt) {
        await db.lesson.update({
          where: { id: lessonId },
          data: { teacherJoinedAt: now },
        });
        logger.info(
          { lessonId, teacherId: participantIdentity, timestamp: now },
          "Recorded teacherJoinedAt via LiveKit webhook",
        );
      } else if (isStudent && !lesson.studentJoinedAt) {
        await db.lesson.update({
          where: { id: lessonId },
          data: { studentJoinedAt: now },
        });
        logger.info(
          { lessonId, studentId: participantIdentity, timestamp: now },
          "Recorded studentJoinedAt via LiveKit webhook",
        );
      }
      break;
    }

    case "room_finished": {
      const lesson = await db.lesson.findUnique({
        where: { id: lessonId },
      });

      if (lesson) {
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

      const now = new Date();
      const isTeacher = participantIdentity === lesson.teacherProfile.userId;
      const isStudent = participantIdentity === lesson.studentId;

      if (isTeacher) {
        await db.lesson.update({
          where: { id: lessonId },
          data: { teacherLeftAt: now },
        });
        logger.info(
          { lessonId, teacherId: participantIdentity, timestamp: now },
          "Recorded teacherLeftAt via LiveKit webhook",
        );
      } else if (isStudent) {
        await db.lesson.update({
          where: { id: lessonId },
          data: { studentLeftAt: now },
        });
        logger.info(
          { lessonId, studentId: participantIdentity, timestamp: now },
          "Recorded studentLeftAt via LiveKit webhook",
        );
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
        // Update teacherJoinedAt for ALL lessons in this group that haven't recorded it yet
        const lessonsToUpdate = groupLessons.filter((l) => !l.teacherJoinedAt);
        for (const lesson of lessonsToUpdate) {
          await db.lesson.update({
            where: { id: lesson.id },
            data: { teacherJoinedAt: now },
          });
        }
        logger.info(
          { groupRoomId, teacherId: participantIdentity, updatedCount: lessonsToUpdate.length },
          "Recorded teacherJoinedAt for group room lessons",
        );
      } else {
        // Student joined — find their specific lesson row and update studentJoinedAt
        const studentLesson = groupLessons.find(
          (l) => l.studentId === participantIdentity && !l.studentJoinedAt,
        );
        if (studentLesson) {
          await db.lesson.update({
            where: { id: studentLesson.id },
            data: { studentJoinedAt: now },
          });
          logger.info(
            { groupRoomId, studentId: participantIdentity, lessonId: studentLesson.id },
            "Recorded studentJoinedAt for group room student",
          );
        }
      }
      break;
    }

    case "room_finished": {
      const now = new Date();
      // Mark ALL scheduled lessons in this group room as COMPLETED and fill missing leftAt
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
        await db.lesson.updateMany({
          where: { groupRoomId },
          data: { teacherLeftAt: now },
        });
        logger.info(
          { groupRoomId, teacherId: participantIdentity, timestamp: now },
          "Recorded teacherLeftAt for group room",
        );
      } else {
        const studentLesson = groupLessons.find(
          (l) => l.studentId === participantIdentity,
        );
        if (studentLesson) {
          await db.lesson.update({
            where: { id: studentLesson.id },
            data: { studentLeftAt: now },
          });
          logger.info(
            { groupRoomId, studentId: participantIdentity, lessonId: studentLesson.id, timestamp: now },
            "Recorded studentLeftAt for group room student",
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
