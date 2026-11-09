"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { checkAndSanitizePII } from "@/lib/pii-filter";
import { revalidatePath } from "next/cache";
import { logger } from "@/lib/logger";
import { isAppError } from "@/lib/errors";
import { MessageType, Role } from "@/types";
import { NotificationType } from "@prisma/client";
import { sendNewChatMessageEmail } from "@/lib/email";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ConversationListItem = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  instrument: string | null;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
};

export type MessageItem = {
  id: string;
  senderId: string;
  senderName: string;
  messageType: MessageType;
  body: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileSizeBytes: number | null;
  isRead: boolean;
  createdAt: Date;
  isMine: boolean;
};

// ─── Authorization: Verify teacher-student relationship ─────────────────────

/**
 * Checks whether a given teacher and student have any scheduled/completed
 * lessons together, or an active enrollment connecting them.
 * This gates who can message whom.
 */
async function verifyTeacherStudentRelationship(
  teacherId: string,
  studentId: string,
): Promise<boolean> {
  // Check for any lesson connection (trial or enrolled)
  const lessonCount = await db.lesson.count({
    where: {
      teacherId,
      studentId,
      status: { in: ["SCHEDULED", "COMPLETED"] },
    },
  });

  if (lessonCount > 0) return true;

  // Check for active enrollment with this teacher
  const enrollmentCount = await db.enrollment.count({
    where: {
      studentId,
      teacherId,
      status: "ACTIVE",
    },
  });

  return enrollmentCount > 0;
}

// ─── Get or Create Conversation ─────────────────────────────────────────────

/**
 * Get or create a conversation between a teacher and student.
 * Only works if they have a lesson/enrollment relationship.
 */
export async function getOrCreateConversation(otherUserId: string) {
  try {
    const user = await requireUser();

    if (!otherUserId) {
      return { success: false as const, error: "Invalid user specified." };
    }

    if (otherUserId === user.id) {
      return {
        success: false as const,
        error: "You cannot message yourself.",
      };
    }

    // Determine who is teacher and who is student
    const otherUser = await db.user.findUnique({
      where: { id: otherUserId },
      select: { id: true, role: true, name: true },
    });

    if (!otherUser) {
      return { success: false as const, error: "User not found." };
    }

    let teacherId: string;
    let studentId: string;

    if (user.role === Role.TEACHER && otherUser.role === Role.STUDENT) {
      teacherId = user.id;
      studentId = otherUserId;
    } else if (user.role === Role.STUDENT && otherUser.role === Role.TEACHER) {
      teacherId = otherUserId;
      studentId = user.id;
    } else {
      return {
        success: false as const,
        error: "Messaging is only available between teachers and students.",
      };
    }

    // Verify relationship
    const hasRelationship = await verifyTeacherStudentRelationship(
      teacherId,
      studentId,
    );

    if (!hasRelationship) {
      return {
        success: false as const,
        error:
          "You can only message teachers/students you have lessons or enrollments with.",
      };
    }

    // Find or create conversation
    let conversation = await db.conversation.findUnique({
      where: {
        teacherId_studentId: { teacherId, studentId },
      },
    });

    if (!conversation) {
      // Get the instrument from the most recent lesson
      const recentLesson = await db.lesson.findFirst({
        where: { teacherId, studentId },
        orderBy: { startsAt: "desc" },
        select: { instrument: true },
      });

      conversation = await db.conversation.create({
        data: {
          teacherId,
          studentId,
          instrument: recentLesson?.instrument || null,
        },
      });

      logger.info(
        { conversationId: conversation.id, teacherId, studentId },
        "Conversation created",
      );
    }

    return { success: true as const, conversationId: conversation.id };
  } catch (error) {
    if (isAppError(error)) {
      return { success: false as const, error: error.message };
    }
    logger.error({ error }, "Error creating conversation");
    return {
      success: false as const,
      error: "Failed to start conversation. Please try again.",
    };
  }
}

// ─── Get Conversations List ─────────────────────────────────────────────────

/**
 * Get all conversations for the current user with last message preview.
 */
export async function getConversations(): Promise<ConversationListItem[]> {
  const user = await requireUser();

  const isTeacher = user.role === Role.TEACHER;

  const conversations = await db.conversation.findMany({
    where: isTeacher ? { teacherId: user.id } : { studentId: user.id },
    include: {
      teacher: { select: { id: true, name: true, image: true } },
      student: { select: { id: true, name: true, image: true } },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          body: true,
          createdAt: true,
          messageType: true,
          fileName: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Get unread counts in parallel
  const unreadCounts = await Promise.all(
    conversations.map((conv) =>
      db.directMessage.count({
        where: {
          conversationId: conv.id,
          senderId: { not: user.id },
          isRead: false,
        },
      }),
    ),
  );

  return conversations.map((conv, i) => {
    const otherUser = isTeacher ? conv.student : conv.teacher;
    const lastMsg = conv.messages[0];

    let lastMessage: string | null = null;
    if (lastMsg) {
      if (lastMsg.messageType === "FILE" || lastMsg.messageType === "ASSIGNMENT") {
        lastMessage = `📎 ${lastMsg.fileName || "File"}`;
      } else {
        lastMessage =
          lastMsg.body && lastMsg.body.length > 60
            ? lastMsg.body.slice(0, 60) + "…"
            : lastMsg.body;
      }
    }

    return {
      id: conv.id,
      otherUserId: otherUser.id,
      otherUserName: otherUser.name || "Unknown",
      otherUserImage: otherUser.image,
      instrument: conv.instrument,
      lastMessage,
      lastMessageAt: lastMsg?.createdAt || null,
      unreadCount: unreadCounts[i],
    };
  });
}

// ─── Get Messages ───────────────────────────────────────────────────────────

/**
 * Get messages for a conversation. Verifies the caller is a participant.
 */
export async function getMessages(
  conversationId: string,
  cursor?: string,
  limit = 50,
): Promise<{
  messages: MessageItem[];
  nextCursor: string | null;
}> {
  const user = await requireUser();

  // Verify participation
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: {
      teacherId: true,
      studentId: true,
      teacher: { select: { name: true } },
      student: { select: { name: true } },
    },
  });

  if (!conversation) {
    return { messages: [], nextCursor: null };
  }

  if (
    conversation.teacherId !== user.id &&
    conversation.studentId !== user.id
  ) {
    return { messages: [], nextCursor: null };
  }

  const messages = await db.directMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: {
      id: true,
      senderId: true,
      messageType: true,
      body: true,
      fileName: true,
      fileUrl: true,
      fileSizeBytes: true,
      isRead: true,
      createdAt: true,
    },
  });

  const hasMore = messages.length > limit;
  const resultMessages = hasMore ? messages.slice(0, limit) : messages;

  return {
    messages: resultMessages.map((msg) => ({
      ...msg,
      senderName:
        msg.senderId === conversation.teacherId
          ? conversation.teacher.name || "Teacher"
          : conversation.student.name || "Student",
      isMine: msg.senderId === user.id,
    })),
    nextCursor: hasMore
      ? resultMessages[resultMessages.length - 1].id
      : null,
  };
}

// ─── Send Message ───────────────────────────────────────────────────────────

export type SendMessageInput = {
  conversationId: string;
  body?: string;
  messageType?: MessageType;
  fileName?: string;
  fileUrl?: string;
  fileSizeBytes?: number;
};

/**
 * Send a message in a conversation. Enforces PII filtering on text messages.
 */
export async function sendMessage(input: SendMessageInput) {
  try {
    const user = await requireUser();

    if (!input.conversationId) {
      return { success: false as const, error: "Invalid conversation." };
    }

    // Verify participation
    const conversation = await db.conversation.findUnique({
      where: { id: input.conversationId },
      select: { teacherId: true, studentId: true },
    });

    if (!conversation) {
      return { success: false as const, error: "Conversation not found." };
    }

    if (
      conversation.teacherId !== user.id &&
      conversation.studentId !== user.id
    ) {
      return {
        success: false as const,
        error: "You are not a participant in this conversation.",
      };
    }

    const messageType = input.messageType || MessageType.TEXT;

    // For text messages, enforce PII filtering
    if (messageType === MessageType.TEXT) {
      if (!input.body?.trim()) {
        return { success: false as const, error: "Message cannot be empty." };
      }

      const piiResult = checkAndSanitizePII(input.body);

      if (!piiResult.isClean) {
        logger.warn(
          {
            userId: user.id,
            conversationId: input.conversationId,
            detectedTypes: piiResult.detectedTypes,
          },
          "PII detected in message — sanitized",
        );
      }

      // Create message with sanitized text
      const message = await db.$transaction(async (tx) => {
        const msg = await tx.directMessage.create({
          data: {
            conversationId: input.conversationId,
            senderId: user.id,
            messageType: MessageType.TEXT,
            body: piiResult.sanitizedText,
          },
        });

        await tx.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        });

        return msg;
      });

      // Dispatch notifications to recipient
      const recipientId =
        conversation.teacherId === user.id
          ? conversation.studentId
          : conversation.teacherId;

      const recipient = await db.user.findUnique({
        where: { id: recipientId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (recipient) {
        const preview = piiResult.sanitizedText.slice(0, 150);
        await db.notification
          .create({
            data: {
              userId: recipient.id,
              type: NotificationType.NEW_MESSAGE,
              title: `New Message from ${user.name || "Musician"}`,
              body: preview,
              link: `/${recipient.role.toLowerCase()}/dashboard/messages?conversationId=${input.conversationId}`,
            },
          })
          .catch(() => {});

        if (recipient.email) {
          sendNewChatMessageEmail({
            recipient: {
              name: recipient.name || "Musician",
              email: recipient.email,
              role: recipient.role,
            },
            senderName:
              user.name || (user.role === Role.TEACHER ? "Instructor" : "Student"),
            senderRole: user.role,
            messagePreview: preview,
            messageType: MessageType.TEXT,
            conversationId: input.conversationId,
          }).catch((err) => {
            logger.error(
              { err, recipientId: recipient.id },
              "Failed to send chat email notification",
            );
          });
        }
      }

      revalidatePath("/teacher/dashboard/messages");
      revalidatePath("/student/dashboard/messages");

      return {
        success: true as const,
        messageId: message.id,
        piiWarning: !piiResult.isClean
          ? "Some personal information was automatically removed from your message for privacy."
          : null,
      };
    }

    // For file/assignment messages
    if (
      messageType === MessageType.FILE ||
      messageType === MessageType.ASSIGNMENT
    ) {
      // Only teachers can send assignments
      if (
        messageType === MessageType.ASSIGNMENT &&
        user.role !== Role.TEACHER
      ) {
        return {
          success: false as const,
          error: "Only teachers can send assignments.",
        };
      }

      if (!input.fileName || !input.fileUrl) {
        return {
          success: false as const,
          error: "File information is required.",
        };
      }

      // PII-filter the body text if provided (e.g., assignment description)
      let sanitizedBody = input.body?.trim() || null;
      if (sanitizedBody) {
        const piiResult = checkAndSanitizePII(sanitizedBody);
        sanitizedBody = piiResult.sanitizedText;
      }

      const message = await db.$transaction(async (tx) => {
        const msg = await tx.directMessage.create({
          data: {
            conversationId: input.conversationId,
            senderId: user.id,
            messageType,
            body: sanitizedBody,
            fileName: input.fileName,
            fileUrl: input.fileUrl,
            fileSizeBytes: input.fileSizeBytes || null,
          },
        });

        await tx.conversation.update({
          where: { id: input.conversationId },
          data: { updatedAt: new Date() },
        });

        return msg;
      });

      // Dispatch notifications to recipient
      const recipientId =
        conversation.teacherId === user.id
          ? conversation.studentId
          : conversation.teacherId;

      const recipient = await db.user.findUnique({
        where: { id: recipientId },
        select: { id: true, name: true, email: true, role: true },
      });

      if (recipient) {
        const preview = (sanitizedBody || input.fileName || "New attachment").slice(0, 150);
        await db.notification
          .create({
            data: {
              userId: recipient.id,
              type: NotificationType.NEW_MESSAGE,
              title: `New Message from ${user.name || "Musician"}`,
              body: preview,
              link: `/${recipient.role.toLowerCase()}/dashboard/messages?conversationId=${input.conversationId}`,
            },
          })
          .catch(() => {});

        if (recipient.email) {
          sendNewChatMessageEmail({
            recipient: {
              name: recipient.name || "Musician",
              email: recipient.email,
              role: recipient.role,
            },
            senderName:
              user.name || (user.role === Role.TEACHER ? "Instructor" : "Student"),
            senderRole: user.role,
            messagePreview: preview,
            messageType: messageType,
            conversationId: input.conversationId,
          }).catch((err) => {
            logger.error(
              { err, recipientId: recipient.id },
              "Failed to send chat email notification",
            );
          });
        }
      }

      revalidatePath("/teacher/dashboard/messages");
      revalidatePath("/student/dashboard/messages");

      return {
        success: true as const,
        messageId: message.id,
        piiWarning: null,
      };
    }

    return { success: false as const, error: "Unsupported message type." };
  } catch (error) {
    if (isAppError(error)) {
      return { success: false as const, error: error.message };
    }
    logger.error({ error }, "Error sending message");
    return {
      success: false as const,
      error: "Failed to send message. Please try again.",
    };
  }
}

// ─── Mark Messages as Read ──────────────────────────────────────────────────

/**
 * Mark all unread messages in a conversation as read for the current user.
 */
export async function markMessagesAsRead(conversationId: string) {
  try {
    const user = await requireUser();

    // Verify participation
    const conversation = await db.conversation.findUnique({
      where: { id: conversationId },
      select: { teacherId: true, studentId: true },
    });

    if (!conversation) return { success: false as const };

    if (
      conversation.teacherId !== user.id &&
      conversation.studentId !== user.id
    ) {
      return { success: false as const };
    }

    await db.directMessage.updateMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        isRead: false,
      },
      data: { isRead: true },
    });

    revalidatePath("/teacher/dashboard/messages");
    revalidatePath("/student/dashboard/messages");

    return { success: true as const };
  } catch (error) {
    logger.error({ error }, "Error marking messages as read");
    return { success: false as const };
  }
}

// ─── Get Total Unread Count ─────────────────────────────────────────────────

/**
 * Get total unread message count across all conversations for the current user.
 */
export async function getTotalUnreadCount(): Promise<number> {
  try {
    const user = await requireUser();

    const isTeacher = user.role === Role.TEACHER;

    // Get all conversation IDs for this user
    const conversations = await db.conversation.findMany({
      where: isTeacher ? { teacherId: user.id } : { studentId: user.id },
      select: { id: true },
    });

    if (conversations.length === 0) return 0;

    const count = await db.directMessage.count({
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        senderId: { not: user.id },
        isRead: false,
      },
    });

    return count;
  } catch {
    return 0;
  }
}

// ─── Get Messageable Users (contacts the user can message) ──────────────────

export type MessageableUser = {
  id: string;
  name: string;
  image: string | null;
  instrument: string | null;
  hasExistingConversation: boolean;
  conversationId: string | null;
};

/**
 * Get all users the current user is allowed to message.
 * For teachers: all their students with lessons/enrollments.
 * For students: all their teachers with lessons/enrollments.
 */
export async function getMessageableUsers(): Promise<MessageableUser[]> {
  const user = await requireUser();
  const isTeacher = user.role === Role.TEACHER;

  if (isTeacher) {
    // Get all students this teacher has taught or is enrolled with
    const lessons = await db.lesson.findMany({
      where: {
        teacherId: user.id,
        status: { in: ["SCHEDULED", "COMPLETED"] },
      },
      select: {
        studentId: true,
        instrument: true,
        student: { select: { id: true, name: true, image: true } },
      },
      distinct: ["studentId"],
    });

    // Also check enrollments
    const enrollments = await db.enrollment.findMany({
      where: {
        teacherId: user.id,
        status: "ACTIVE",
      },
      select: {
        studentId: true,
        course: { select: { instrument: true } },
        student: { select: { id: true, name: true, image: true } },
      },
    });

    // Merge and deduplicate
    const userMap = new Map<
      string,
      { id: string; name: string; image: string | null; instrument: string | null }
    >();

    for (const lesson of lessons) {
      if (!userMap.has(lesson.studentId)) {
        userMap.set(lesson.studentId, {
          id: lesson.student.id,
          name: lesson.student.name || "Student",
          image: lesson.student.image,
          instrument: lesson.instrument,
        });
      }
    }

    for (const enrollment of enrollments) {
      if (!userMap.has(enrollment.studentId)) {
        userMap.set(enrollment.studentId, {
          id: enrollment.student.id,
          name: enrollment.student.name || "Student",
          image: enrollment.student.image,
          instrument: enrollment.course.instrument,
        });
      }
    }

    // Check existing conversations
    const existingConversations = await db.conversation.findMany({
      where: { teacherId: user.id },
      select: { id: true, studentId: true },
    });

    const convMap = new Map(
      existingConversations.map((c) => [c.studentId, c.id]),
    );

    return Array.from(userMap.values()).map((u) => ({
      ...u,
      hasExistingConversation: convMap.has(u.id),
      conversationId: convMap.get(u.id) || null,
    }));
  } else {
    // Student: get all teachers they have lessons/enrollments with
    const lessons = await db.lesson.findMany({
      where: {
        studentId: user.id,
        status: { in: ["SCHEDULED", "COMPLETED"] },
      },
      select: {
        teacherId: true,
        instrument: true,
        teacher: { select: { id: true, name: true, image: true } },
      },
      distinct: ["teacherId"],
    });

    const enrollments = await db.enrollment.findMany({
      where: {
        studentId: user.id,
        status: "ACTIVE",
        teacherId: { not: null },
      },
      select: {
        teacherId: true,
        course: { select: { instrument: true } },
      },
    });

    const userMap = new Map<
      string,
      { id: string; name: string; image: string | null; instrument: string | null }
    >();

    for (const lesson of lessons) {
      if (!userMap.has(lesson.teacherId)) {
        userMap.set(lesson.teacherId, {
          id: lesson.teacher.id,
          name: lesson.teacher.name || "Teacher",
          image: lesson.teacher.image,
          instrument: lesson.instrument,
        });
      }
    }

    // For enrollments, fetch teacher info separately
    for (const enrollment of enrollments) {
      if (enrollment.teacherId && !userMap.has(enrollment.teacherId)) {
        const teacher = await db.user.findUnique({
          where: { id: enrollment.teacherId },
          select: { id: true, name: true, image: true },
        });
        if (teacher) {
          userMap.set(enrollment.teacherId, {
            id: teacher.id,
            name: teacher.name || "Teacher",
            image: teacher.image,
            instrument: enrollment.course.instrument,
          });
        }
      }
    }

    // Check existing conversations
    const existingConversations = await db.conversation.findMany({
      where: { studentId: user.id },
      select: { id: true, teacherId: true },
    });

    const convMap = new Map(
      existingConversations.map((c) => [c.teacherId, c.id]),
    );

    return Array.from(userMap.values()).map((u) => ({
      ...u,
      hasExistingConversation: convMap.has(u.id),
      conversationId: convMap.get(u.id) || null,
    }));
  }
}
