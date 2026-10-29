import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdminTicketDetailView, AdminMessageItem } from "./AdminTicketDetailView";

export default async function AdminTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(Role.ADMIN);
  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          role: true,
          customId: true,
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket) {
    notFound();
  }

  const formattedMessages: AdminMessageItem[] = ticket.messages.map((m) => ({
    id: m.id,
    senderId: m.senderId,
    senderRole: m.senderRole,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <AdminTicketDetailView
      ticket={{
        id: ticket.id,
        subject: ticket.subject,
        category: ticket.category,
        status: ticket.status,
        createdAt: ticket.createdAt.toISOString(),
        userName: ticket.user.name || "User",
        userEmail: ticket.user.email,
        userRole: ticket.user.role,
        userCustomId: ticket.user.customId,
      }}
      messages={formattedMessages}
    />
  );
}
