import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Role, TicketStatus } from "@/types";
import { ArrowLeft, Clock, User, ShieldCheck } from "lucide-react";
import { TicketThreadReplyForm } from "./TicketThreadReplyForm";
import { getSupportTicketDisplaySubject } from "@/lib/support-ticket-display";

export default async function StudentTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(Role.STUDENT);
  const { id } = await params;

  const ticket = await db.supportTicket.findUnique({
    where: { id },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!ticket || ticket.userId !== user.id) {
    notFound();
  }

  const statusColors: Record<TicketStatus, string> = {
    OPEN: "bg-accent-subtle text-accent-dark border-accent/30 font-bold",
    IN_PROGRESS: "bg-info-muted text-info border-info/30 font-bold",
    RESOLVED: "bg-success-muted text-success border-success/30 font-bold",
    CLOSED: "bg-bg-alt text-body-muted border-border-default font-bold",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/student/dashboard/support"
        className="inline-flex items-center gap-2 text-xs font-semibold text-body hover:text-primary transition-colors btn-tactile"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Support Tickets
      </Link>

      <div className="bg-white border border-border-default rounded-3xl p-6 space-y-6 shadow-sm">
        {/* Ticket Meta Header */}
        <div className="space-y-2 border-b border-border-subtle pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`px-2.5 py-0.5 rounded-full text-xs border ${
                statusColors[ticket.status]
              }`}
            >
              {ticket.status.replace("_", " ")}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-bg-alt text-heading border border-border-default">
              {ticket.category}
            </span>
            <span className="text-xs text-body-muted flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Created {new Date(ticket.createdAt).toLocaleDateString()}
            </span>
          </div>

          <h1 className="font-serif text-2xl font-bold text-heading">
            {getSupportTicketDisplaySubject(ticket.subject)}
          </h1>
        </div>

        {/* Thread Messages */}
        <div className="space-y-4">
          {ticket.messages.map((msg) => {
            const isStudent = msg.senderRole === Role.STUDENT;

            return (
              <div
                key={msg.id}
                className={`p-4 rounded-2xl border ${
                  isStudent
                    ? "bg-bg-alt/40 border-border-subtle ml-4 sm:ml-8"
                    : "bg-primary-subtle border-primary/20 mr-4 sm:mr-8"
                } space-y-2`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    {isStudent ? (
                      <div className="flex items-center gap-1.5 font-bold text-heading">
                        <User className="w-3.5 h-3.5 text-accent-dark" /> You
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 font-bold text-primary">
                        <ShieldCheck className="w-3.5 h-3.5 text-primary" /> Gandharva Administration
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-body-muted">
                    {new Date(msg.createdAt).toLocaleString()}
                  </span>
                </div>

                <p className="text-xs text-body leading-relaxed whitespace-pre-wrap">
                  {msg.body}
                </p>
              </div>
            );
          })}
        </div>

        {/* Reply Box */}
        {ticket.status !== TicketStatus.CLOSED ? (
          <TicketThreadReplyForm ticketId={ticket.id} />
        ) : (
          <div className="p-3 text-center text-xs text-body-muted border-t border-border-subtle">
            This support ticket has been closed. Please open a new ticket if you have further inquiries.
          </div>
        )}
      </div>
    </div>
  );
}
