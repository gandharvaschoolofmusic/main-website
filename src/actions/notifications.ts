"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NotificationType, Role } from "@prisma/client";

// ─── Fetch recent notifications for the authenticated user ───────────────────

export async function getNotifications(limit = 30) {
  const session = await auth();
  if (!session?.user?.id) return [];

  const userId = session.user.id;
  const userRole = session.user.role;

  // Check existing notifications count
  const count = await db.notification.count({
    where: { userId },
  });

  // If user has zero notifications, seed initial fast info based on real platform state
  if (count === 0) {
    try {
      if (userRole === Role.ADMIN) {
        // Find recent teachers, students, trials, and support tickets to give admin real fast info right away
        const [recentTeachers, recentStudents, pendingTrials, openTickets] = await Promise.all([
          db.teacherProfile.findMany({
            take: 2,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, email: true } } },
          }),
          db.user.findMany({
            where: { role: Role.STUDENT },
            take: 2,
            orderBy: { createdAt: "desc" },
            select: { name: true, email: true },
          }),
          db.trialRequest.findMany({
            where: { status: "PENDING" },
            take: 2,
            orderBy: { createdAt: "desc" },
            select: { studentName: true, instrument: true },
          }),
          db.supportTicket.findMany({
            where: { status: "OPEN" },
            take: 2,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { name: true, customId: true } } },
          }),
        ]);

        const initialAdminNotifications = [];

        for (const tk of openTickets) {
          initialAdminNotifications.push({
            userId,
            type: NotificationType.NEW_SUPPORT_TICKET,
            title: `Support Ticket: ${tk.subject}`,
            body: `${tk.user.name || "A student"}${tk.user.customId ? ` (${tk.user.customId})` : ""} opened a support ticket.`,
            link: `/admin/support/${tk.id}`,
            isRead: false,
          });
        }

        for (const t of recentTeachers) {
          initialAdminNotifications.push({
            userId,
            type: NotificationType.NEW_TEACHER_SIGNUP,
            title: "New Faculty Registered",
            body: `${t.user.name || "A new teacher"} registered for ${t.instruments.join(", ") || "Music"}. Status: ${t.approvalStatus}.`,
            link: "/admin/teachers",
            isRead: false,
          });
        }

        for (const s of recentStudents) {
          initialAdminNotifications.push({
            userId,
            type: NotificationType.NEW_STUDENT_SIGNUP,
            title: "New Student Enrolled",
            body: `${s.name || s.email} joined Gandharva School of Music.`,
            link: "/admin/users",
            isRead: false,
          });
        }

        for (const tr of pendingTrials) {
          initialAdminNotifications.push({
            userId,
            type: NotificationType.NEW_TRIAL_REQUEST,
            title: "Pending Trial Request",
            body: `${tr.studentName} requested a 1:1 trial session for ${tr.instrument}.`,
            link: "/admin/trials",
            isRead: false,
          });
        }

        if (initialAdminNotifications.length === 0) {
          initialAdminNotifications.push({
            userId,
            type: NotificationType.SYSTEM,
            title: "Gandharva Admin Center",
            body: "Welcome to the executive admin hub. Real-time platform alerts and registrations will appear here.",
            link: "/admin",
            isRead: false,
          });
        }

        await db.notification.createMany({
          data: initialAdminNotifications,
        });
      } else if (userRole === Role.TEACHER) {
        const profile = await db.teacherProfile.findUnique({
          where: { userId },
          select: { approvalStatus: true, instruments: true },
        });

        const initialTeacherNotifications = [];

        if (profile?.approvalStatus === "APPROVED") {
          initialTeacherNotifications.push({
            userId,
            type: NotificationType.TEACHER_APPROVED,
            title: "Faculty Profile Approved",
            body: "Your teaching credentials have been verified. Configure your weekly teaching schedule to receive student bookings.",
            link: "/teacher/dashboard/availability",
            isRead: false,
          });
        } else if (profile?.approvalStatus === "PENDING") {
          initialTeacherNotifications.push({
            userId,
            type: NotificationType.SYSTEM,
            title: "Application Under Review",
            body: "Welcome to Gandharva Faculty! Your application is being reviewed by the academic committee.",
            link: "/teacher/dashboard",
            isRead: false,
          });
        }

        if (initialTeacherNotifications.length > 0) {
          await db.notification.createMany({
            data: initialTeacherNotifications,
          });
        }
      } else {
        // STUDENT
        await db.notification.create({
          data: {
            userId,
            type: NotificationType.SYSTEM,
            title: "Welcome to Gandharva!",
            body: "Explore accredited courses, book your free 1:1 live trial lesson, and start your music journey.",
            link: "/book-trial",
            isRead: false,
          },
        });
      }
    } catch {
      // Non-critical fallback
    }
  }

  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

// ─── Unread count ────────────────────────────────────────────────────────────

export async function getUnreadCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return db.notification.count({
    where: { userId: session.user.id, isRead: false },
  });
}

// ─── Delete a single notification ────────────────────────────────────────────

export async function deleteNotification(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.notification.deleteMany({
    where: { id: notificationId, userId: session.user.id },
  });
}

// ─── Clear all notifications for user ────────────────────────────────────────

export async function clearAllNotifications() {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.notification.deleteMany({
    where: { userId: session.user.id },
  });
}

// ─── Mark a single notification as read ──────────────────────────────────────

export async function markNotificationRead(notificationId: string) {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.notification.updateMany({
    where: { id: notificationId, userId: session.user.id },
    data: { isRead: true },
  });
}

// ─── Mark all notifications as read ──────────────────────────────────────────

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });
}

// ─── Create a notification (used internally by other server actions) ─────────

export async function createNotification({
  userId,
  type,
  title,
  body,
  link,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) {
  return db.notification.create({
    data: { userId, type, title, body, link },
  });
}

// ─── Notify all admins (helper) ──────────────────────────────────────────────

export async function notifyAdmins({
  type,
  title,
  body,
  link,
}: {
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}) {
  const admins = await db.user.findMany({
    where: { role: Role.ADMIN },
    select: { id: true },
  });

  if (admins.length === 0) return;

  await db.notification.createMany({
    data: admins.map((admin) => ({
      userId: admin.id,
      type,
      title,
      body,
      link,
    })),
  });
}
