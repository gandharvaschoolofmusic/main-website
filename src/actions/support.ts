"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth-helpers";
import { Role, TicketCategory, TicketStatus } from "@/types";
import { revalidatePath, revalidateTag } from "next/cache";
import { logger } from "@/lib/logger";
import { AuthRateLimits } from "@/lib/rate-limit";
import { isAppError } from "@/lib/errors";
import { notifyAdmins, createNotification } from "@/actions/notifications";
import { NotificationType } from "@prisma/client";
import { sendSupportTicketAdminEmail } from "@/lib/email";

export type CreateTicketInput = {
  subject: string;
  category: TicketCategory;
  message: string;
};

export type ReplyTicketInput = {
  ticketId: string;
  message: string;
};

export async function createTicketAction(input: CreateTicketInput) {
  try {
    const user = await requireUser();
    AuthRateLimits.checkTicketCreation(user.id);

    if (!input.subject?.trim() || !input.message?.trim()) {
      return {
        success: false,
        error: "Subject and message are required.",
      };
    }

    const ticket = await db.supportTicket.create({
      data: {
        userId: user.id,
        subject: input.subject.trim(),
        category: input.category || TicketCategory.OTHER,
        status: TicketStatus.OPEN,
        messages: {
          create: {
            senderId: user.id,
            senderRole: user.role,
            body: input.message.trim(),
          },
        },
      },
      include: {
        messages: true,
      },
    });

    logger.info({ ticketId: ticket.id, userId: user.id }, "Support ticket created");

    // 1. In-App Notification to all Academy Administrators
    const userCustomId = (user as any).customId;
    const userDisplayIdentifier = userCustomId ? ` (${userCustomId})` : "";
    const userRoleLabel = user.role.charAt(0) + user.role.slice(1).toLowerCase();

    try {
      await notifyAdmins({
        type: NotificationType.NEW_SUPPORT_TICKET,
        title: `New Support Ticket: ${input.subject.trim()}`,
        body: `${user.name || user.email}${userDisplayIdentifier} [${userRoleLabel}] raised a support ticket regarding "${input.subject.trim()}".`,
        link: `/admin/support/${ticket.id}`,
      });
    } catch (e) {
      logger.warn({ error: e }, "Failed to deliver in-app notification to admins");
    }

    // 2. Receipt notification to the user who created the ticket
    try {
      await createNotification({
        userId: user.id,
        type: NotificationType.SYSTEM,
        title: "Support Ticket Submitted",
        body: `Your ticket "${input.subject.trim()}" has been received. Our administration team is reviewing it.`,
        link: user.role === Role.TEACHER
          ? `/teacher/dashboard/support/${ticket.id}`
          : `/student/dashboard/support/${ticket.id}`,
      });
    } catch (e) {
      logger.warn({ error: e }, "Failed to deliver confirmation notification to ticket creator");
    }

    // 3. Email alert to Administrators
    try {
      await sendSupportTicketAdminEmail({
        ticketId: ticket.id,
        ticketSubject: input.subject.trim(),
        ticketCategory: input.category,
        userName: user.name || "Academy User",
        userEmail: user.email || "",
        userRole: user.role,
        userCustomId: userCustomId || null,
        message: input.message.trim(),
      });
    } catch (e) {
      logger.warn({ error: e }, "Failed to send support ticket email to admins");
    }

    revalidatePath("/student/dashboard/support");
    revalidatePath(`/student/dashboard/support/${ticket.id}`);
    revalidatePath("/teacher/dashboard/support");
    revalidatePath(`/teacher/dashboard/support/${ticket.id}`);
    revalidatePath("/admin/support");
    revalidatePath(`/admin/support/${ticket.id}`);
    try {
      revalidateTag("admin-support", "max");
      revalidateTag("support", "max");
    } catch {
      // safe fallback
    }

    return {
      success: true,
      ticketId: ticket.id,
    };
  } catch (error) {
    if (isAppError(error)) {
      return {
        success: false,
        error: error.message,
      };
    }
    logger.error({ error }, "Error creating support ticket");
    return {
      success: false,
      error: "Failed to create support ticket. Please try again.",
    };
  }
}

export async function replyToTicketAction(input: ReplyTicketInput) {
  try {
    const user = await requireUser();

    if (!input.ticketId || !input.message?.trim()) {
      return {
        success: false,
        error: "Message cannot be empty.",
      };
    }

    const ticket = await db.supportTicket.findUnique({
      where: { id: input.ticketId },
      include: { user: true },
    });

    if (!ticket) {
      return {
        success: false,
        error: "Ticket not found.",
      };
    }

    // Only ticket creator or ADMIN can reply
    if (ticket.userId !== user.id && user.role !== Role.ADMIN) {
      return {
        success: false,
        error: "You do not have permission to reply to this ticket.",
      };
    }

    await db.$transaction(async (tx) => {
      await tx.ticketMessage.create({
        data: {
          ticketId: input.ticketId,
          senderId: user.id,
          senderRole: user.role,
          body: input.message.trim(),
        },
      });

      // If non-admin user replies and ticket was closed or resolved, reopen it
      if (user.role !== Role.ADMIN && ticket.status !== TicketStatus.OPEN) {
        await tx.supportTicket.update({
          where: { id: input.ticketId },
          data: { status: TicketStatus.OPEN },
        });
      } else if (user.role === Role.ADMIN && ticket.status === TicketStatus.OPEN) {
        // If an admin replies to an OPEN ticket, transition it to IN_PROGRESS
        await tx.supportTicket.update({
          where: { id: input.ticketId },
          data: { status: TicketStatus.IN_PROGRESS },
        });
      }
    });

    // Notify counterpart of the new reply
    if (user.role !== Role.ADMIN) {
      // User (student/teacher) replied -> Notify Admins
      const userCustomId = (user as any).customId;
      const userDisplayIdentifier = userCustomId ? ` (${userCustomId})` : "";
      try {
        await notifyAdmins({
          type: NotificationType.SUPPORT_TICKET_REPLY,
          title: `New Reply on Ticket: ${ticket.subject}`,
          body: `${user.name || user.email}${userDisplayIdentifier} replied: "${input.message.trim().slice(0, 100)}${input.message.trim().length > 100 ? "..." : ""}"`,
          link: `/admin/support/${ticket.id}`,
        });
      } catch (e) {
        logger.warn({ error: e }, "Failed to deliver ticket reply notification to admins");
      }
    } else {
      // Admin replied -> Notify ticket owner (Student or Teacher)
      try {
        await createNotification({
          userId: ticket.userId,
          type: NotificationType.SUPPORT_TICKET_REPLY,
          title: `Support Update: ${ticket.subject}`,
          body: `Our support team has replied to your ticket: "${input.message.trim().slice(0, 100)}${input.message.trim().length > 100 ? "..." : ""}"`,
          link: ticket.user.role === Role.TEACHER
            ? `/teacher/dashboard/support/${ticket.id}`
            : `/student/dashboard/support/${ticket.id}`,
        });
      } catch (e) {
        logger.warn({ error: e }, "Failed to deliver ticket reply notification to student");
      }
    }

    revalidatePath(`/student/dashboard/support/${input.ticketId}`);
    revalidatePath(`/teacher/dashboard/support/${input.ticketId}`);
    revalidatePath(`/admin/support/${input.ticketId}`);
    revalidatePath("/student/dashboard/support");
    revalidatePath("/teacher/dashboard/support");
    revalidatePath("/admin/support");
    try {
      revalidateTag("admin-support", "max");
      revalidateTag("support", "max");
    } catch {
      // safe fallback
    }

    return { success: true };
  } catch (error) {
    logger.error({ error }, "Error replying to support ticket");
    return {
      success: false,
      error: "Failed to send reply. Please try again.",
    };
  }
}
