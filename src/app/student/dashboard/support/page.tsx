import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role, TicketCategory, TicketStatus } from "@/types";
import Link from "next/link";
import {
  HelpCircle,
  MessageSquare,
  Clock,
  ChevronRight,
} from "lucide-react";
import { SupportTicketForm } from "./SupportTicketForm";
import { FaqAccordion } from "./FaqAccordion";
import { SplitHeading } from "@/components/ui/SplitHeading";
import { getSupportTicketDisplaySubject } from "@/lib/support-ticket-display";

export const metadata = {
  title: "Help & Support | Student Portal | Gandharva School of Music",
  description:
    "Get help with trial allocations, course billing, teacher scheduling, or technical video classroom issues.",
};

export default async function StudentSupportPage() {
  const user = await requireRole(Role.STUDENT);

  const tickets = await db.supportTicket.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusColors: Record<TicketStatus, string> = {
    OPEN: "bg-accent/15 text-accent-dark border-accent/30 font-bold",
    IN_PROGRESS: "bg-primary/10 text-primary border-primary/20 font-bold",
    RESOLVED: "bg-success-muted text-success border-success/30 font-bold",
    CLOSED: "bg-bg-alt text-body border-surface-muted font-medium",
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
          Student Assistance and Concierge
        </span>
        <SplitHeading
          as="h1"
          firstClause="Help and"
          accentClause="Support Center"
          size="lg"
          className="mt-0.5"
        />
        <p className="text-xs sm:text-sm text-body mt-1 max-w-xl">
          Browse common questions below, or submit a support ticket to our academy administration for scheduling, billing, or technical queries.
        </p>
      </div>

      {/* FAQ Accordion Section */}
      <div className="space-y-3">
        <h2 className="font-serif text-lg font-bold text-heading flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-accent" />
          Frequently Asked Questions
        </h2>
        <FaqAccordion />
      </div>

      {/* Ticket Creation & List Section */}
      <div className="space-y-4 pt-4 border-t border-surface-muted/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Your Support Tickets
            </h2>
            <p className="text-xs text-body">
              Direct threaded communication with Gandharva academy administrators.
            </p>
          </div>
        </div>

        {/* New Ticket Form (Collapsible Client Component) */}
        <SupportTicketForm />

        {/* Ticket List */}
        {tickets.length === 0 ? (
          <div className="py-12 text-center rounded-2xl border border-dashed border-surface-muted bg-bg-alt/20 space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto text-body/40" />
            <p className="text-heading text-sm font-bold">No support tickets filed</p>
            <p className="text-xs text-body">
              Need help with a session or course? Fill out the form above to open a ticket.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/student/dashboard/support/${ticket.id}`}
                className="btn-tactile p-4 rounded-xl border border-surface-muted/90 bg-white hover:bg-bg-alt/20 hover:border-primary/30 transition-all flex items-center justify-between gap-4 group shadow-xs"
              >
                <div className="space-y-1.5 overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] border ${
                        statusColors[ticket.status]
                      }`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-bg-alt text-heading border border-surface-muted">
                      {ticket.category}
                    </span>
                    <span className="text-xs text-body/70 flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-body/50" />
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-heading group-hover:text-primary transition-colors truncate">
                    {getSupportTicketDisplaySubject(ticket.subject)}
                  </h3>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-body font-medium hidden sm:inline">
                    {ticket._count.messages} message{ticket._count.messages === 1 ? "" : "s"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-body/50 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

