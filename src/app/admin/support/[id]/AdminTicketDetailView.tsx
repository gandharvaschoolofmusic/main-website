"use client";

import { useState, useTransition } from "react";
import { TicketStatus, Role } from "@prisma/client";
import { updateTicketStatusAdminAction } from "@/actions/admin";
import { replyToTicketAction } from "@/actions/support";
import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  User,
  ShieldCheck,
  Send,
  Loader2,
  CheckCircle2,
} from "lucide-react";

export interface AdminMessageItem {
  id: string;
  senderId: string;
  senderRole: Role;
  body: string;
  createdAt: string;
}

export function AdminTicketDetailView({
  ticket,
  messages,
}: {
  ticket: {
    id: string;
    subject: string;
    category: string;
    status: TicketStatus;
    createdAt: string;
    userName: string;
    userEmail: string;
    userRole: Role;
    userCustomId?: string | null;
  };
  messages: AdminMessageItem[];
}) {
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [replyMessage, setReplyMessage] = useState("");
  const [isPendingReply, startReplyTransition] = useTransition();
  const [isPendingStatus, startStatusTransition] = useTransition();
  const [statusSaved, setStatusSaved] = useState(false);

  const handleStatusChange = (newStatus: TicketStatus) => {
    setStatus(newStatus);
    setStatusSaved(false);

    startStatusTransition(async () => {
      const res = await updateTicketStatusAdminAction({
        ticketId: ticket.id,
        status: newStatus,
      });
      if (res.success) {
        setStatusSaved(true);
        setTimeout(() => setStatusSaved(false), 2000);
      }
    });
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyMessage.trim()) return;

    startReplyTransition(async () => {
      await replyToTicketAction({
        ticketId: ticket.id,
        message: replyMessage.trim(),
      });
      setReplyMessage("");
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-2 text-xs font-semibold text-body hover:text-primary transition-colors active:scale-95"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to Support Queue
      </Link>

      <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-xs space-y-6">
        {/* Ticket Header & Status Selector */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-primary/10 pb-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-bg-alt/50 text-primary text-[10px] font-semibold border border-primary/10">
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

            <div className="flex items-center gap-2 text-xs text-body flex-wrap">
              <span>From:</span>
              <strong className="text-heading font-medium">{ticket.userName}</strong>
              {ticket.userCustomId && (
                <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-[#3C096C]">
                  {ticket.userCustomId}
                </span>
              )}
              <span>({ticket.userEmail})</span>
              <span>• Role:</span>
              <span className="text-accent-dark font-bold uppercase text-[10px] bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                {ticket.userRole}
              </span>
            </div>
          </div>

          {/* Status Dropdown */}
          <div className="space-y-1 shrink-0">
            <label className="text-[10px] font-bold uppercase tracking-wider text-body block">
              Ticket Status
            </label>
            <div className="flex items-center gap-2">
              <select
                value={status}
                disabled={isPendingStatus}
                onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                className="rounded-xl bg-white border border-primary/15 px-3 py-1.5 text-xs text-heading focus:outline-none focus:border-primary shadow-2xs"
              >
                <option value={TicketStatus.OPEN}>OPEN</option>
                <option value={TicketStatus.IN_PROGRESS}>IN PROGRESS</option>
                <option value={TicketStatus.RESOLVED}>RESOLVED</option>
                <option value={TicketStatus.CLOSED}>CLOSED</option>
              </select>

              {statusSaved && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 animate-fade-in" />
              )}
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="space-y-4">
          {messages.map((msg) => {
            const isAdmin = msg.senderRole === Role.ADMIN;

            return (
              <div
                key={msg.id}
                className={`p-4 rounded-xl space-y-2 ${
                  isAdmin
                    ? "bg-primary/5 border border-primary/15 ml-4 sm:ml-8"
                    : "bg-bg-alt/25 border border-primary/10 mr-4 sm:mr-8"
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 font-bold">
                    {isAdmin ? (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5 text-accent-dark" />
                        <span className="text-primary font-bold">Academy Staff (Admin)</span>
                      </>
                    ) : (
                      <>
                        <User className="w-3.5 h-3.5 text-primary" />
                        <span className="text-heading font-bold">
                          {ticket.userName} ({msg.senderRole})
                        </span>
                      </>
                    )}
                  </div>
                  <span className="text-[11px] text-body/60 font-numeric">
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

        {/* Reply Form */}
        <form onSubmit={handleReplySubmit} className="space-y-3 pt-4 border-t border-primary/10">
          <div className="relative">
            <textarea
              rows={3}
              value={replyMessage}
              onChange={(e) => setReplyMessage(e.target.value)}
              placeholder="Send official administrative response..."
              className="w-full p-3 pr-24 rounded-xl bg-white border border-primary/15 text-xs text-heading placeholder:text-body/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none shadow-2xs"
            />
            <button
              type="submit"
              disabled={isPendingReply || !replyMessage.trim()}
              className="absolute right-2.5 bottom-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-white text-xs font-bold transition-all disabled:opacity-40 active:scale-95 shadow-xs"
            >
              {isPendingReply ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
