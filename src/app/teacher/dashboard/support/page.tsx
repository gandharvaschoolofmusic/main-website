import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role, TicketCategory, TicketStatus } from "@/types";
import Link from "next/link";
import {
  HelpCircle,
  MessageSquare,
  Clock,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";
import { TeacherSupportTicketForm } from "./TeacherSupportTicketForm";
import { TeacherFaqAccordion } from "./TeacherFaqAccordion";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "Teacher Support | Gandharva School of Music",
  description: "Get help with teacher compensation, scheduling, student concerns, or technical issues.",
};

export default async function TeacherSupportPage() {
  const user = await requireRole(Role.TEACHER);

  const tickets = await db.supportTicket.findMany({
    where: { userId: user.id },
    include: {
      _count: { select: { messages: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const statusColors: Record<TicketStatus, string> = {
    OPEN: "bg-amber-50 text-amber-800 border-amber-200",
    IN_PROGRESS: "bg-sky-50 text-sky-800 border-sky-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    CLOSED: "bg-neutral-100 text-body border-neutral-200",
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-accent font-sans">
          Teacher Assistance
        </span>
        <SplitHeading
          firstClause="Teacher Help &"
          accentClause="Support Desk"
          as="h1"
          size="lg"
        />
        <p className="text-xs text-body mt-1 max-w-2xl">
          Access teacher policies, check compensation FAQs, and communicate directly with academy administration.
        </p>
      </div>

      {/* Teacher FAQ Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold font-serif text-heading">
          Frequently Asked Teacher Questions
        </h2>
        <TeacherFaqAccordion />
      </div>

      {/* Ticket Submission Form */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold font-serif text-heading">
            Open a Support Request
          </h2>
        </div>
        <TeacherSupportTicketForm />
      </div>

      {/* Past Tickets List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border-default pb-2">
          <h2 className="text-sm font-bold font-serif text-heading flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" />
            <span>My Support Tickets</span>
          </h2>
          <span className="text-xs text-body font-numeric">
            {tickets.length} ticket{tickets.length === 1 ? "" : "s"}
          </span>
        </div>

        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-border-default bg-white p-8 text-center text-xs text-body shadow-xs">
            You haven't submitted any support requests yet.
          </div>
        ) : (
          <div className="space-y-2.5">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/teacher/dashboard/support/${ticket.id}`}
                className="group p-4 rounded-xl border border-border-default bg-white hover:border-primary/40 hover:shadow-xs transition-all flex items-center justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        statusColors[ticket.status] || ""
                      }`}
                    >
                      {ticket.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-bg-alt/30 text-heading text-[10px] font-semibold border border-border-default/60">
                      {ticket.category}
                    </span>
                    <span className="text-xs text-body flex items-center gap-1 font-numeric">
                      <Clock className="w-3 h-3 text-body/60" />
                      {new Date(ticket.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-heading group-hover:text-primary transition-colors truncate">
                    {ticket.subject}
                  </h3>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs text-body hidden sm:inline font-numeric">
                    {ticket._count.messages} message
                    {ticket._count.messages === 1 ? "" : "s"}
                  </span>
                  <ChevronRight className="w-4 h-4 text-body/40 group-hover:text-primary transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
