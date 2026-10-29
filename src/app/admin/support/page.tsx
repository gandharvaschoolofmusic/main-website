import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { AdminTicketsManager, AdminTicketItem } from "./AdminTicketsManager";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Support Desk Queue | Admin Portal | Gandharva School of Music",
  description: "Monitor and respond to student inquiries and faculty support tickets.",
};

const getCachedAdminSupportData = unstable_cache(
  async () => {
    const dbTickets = await db.supportTicket.findMany({
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
            customId: true,
          },
        },
        _count: {
          select: { messages: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const formattedTickets: AdminTicketItem[] = dbTickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      category: t.category,
      status: t.status,
      createdAt: t.createdAt.toISOString(),
      userName: t.user.name || "User",
      userEmail: t.user.email,
      userRole: t.user.role,
      userCustomId: t.user.customId,
      messagesCount: t._count.messages,
    }));

    return formattedTickets;
  },
  ["admin-support-data-v1"],
  { revalidate: 30, tags: ["admin-support", "support"] }
);

export default async function AdminSupportPage() {
  await requireRole(Role.ADMIN);

  let formattedTickets: AdminTicketItem[] = [];
  try {
    formattedTickets = await getCachedAdminSupportData();
  } catch (err) {
    console.error("[AdminSupportPage] Failed to load cached support tickets, using fallback:", err);
  }

  return (
    <div className="space-y-6">
      <div>
        <span className="text-[11px] font-bold uppercase tracking-widest text-accent-dark font-mono">
          Inquiry Help Desk
        </span>
        <SplitHeading
          firstClause="Support Desk"
          accentClause="Triage"
          as="h1"
          size="lg"
          className="mt-1"
        />
        <p className="text-sm text-body mt-1">
          Review, assign, and reply to open support requests submitted by students and faculty members.
        </p>
      </div>

      <AdminTicketsManager initialTickets={formattedTickets} />
    </div>
  );
}
