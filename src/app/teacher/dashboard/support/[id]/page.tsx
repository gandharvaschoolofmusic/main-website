import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Role, TicketStatus } from "@/types";
import { ArrowLeft, Clock, User, ShieldCheck } from "lucide-react";
import { TicketThreadReplyForm } from "@/app/student/dashboard/support/[id]/TicketThreadReplyForm";

export default async function TeacherTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole(Role.TEACHER);
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
    OPEN: "bg-amber-50 text-amber-800 border-amber-200",
    IN_PROGRESS: "bg-sky-50 text-sky-800 border-sky-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 border-emerald-200",
    CLOSED: "bg-neutral-100 text-body border-neutral-200",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/teacher/dashboard/support"
        className="inline-flex items-center gap-2 text-xs font-semibold text-body hover:text-primary transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Teacher Support
      </Link>

      <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs space-y-6">
        {/* Ticket Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-default pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
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

            <h1 className="font-serif text-xl font-bold text-heading mt-1">
              {ticket.subject}
            </h1>
          </div>
        </div>

        {/* Messages Thread */}
        <div className="space-y-4">
          {ticket.messages.map((msg) => {
            const isMe = msg.senderId === user.id;
            const isAdmin = msg.senderRole === Role.ADMIN;

            return (
              <div
                key={msg.id}
                className={`p-4 rounded-xl space-y-2 ${
                  isMe
                    ? "bg-primary-subtle/30 border border-primary/20 ml-4 sm:ml-8"
                    : "bg-accent-subtle/20 border border-accent/20 mr-4 sm:mr-8"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    {isAdmin ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-accent-dark" />
                        <span className="text-accent-dark">Academy Administration</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span className="text-primary">You (Teacher)</span>
                      </>
                    )}
                  </div>
                  <span className="text-[11px] text-body font-numeric">
                    {new Date(msg.createdAt).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                <p className="text-xs text-heading leading-relaxed whitespace-pre-wrap">
                  {msg.body}
                </p>
              </div>
            );
          })}
        </div>

        {/* Thread Reply Form */}
        <TicketThreadReplyForm ticketId={ticket.id} />
      </div>
    </div>
  );
}
