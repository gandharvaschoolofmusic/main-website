"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createTicketAction } from "@/actions/support";
import { TicketCategory } from "@/types";
import { Plus, X, Send, Loader2 } from "lucide-react";

export function TeacherSupportTicketForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState<TicketCategory>(TicketCategory.LESSON);
  const [message, setMessage] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    startTransition(async () => {
      const res = await createTicketAction({
        subject,
        category,
        message,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to create support ticket.");
      } else if (res.ticketId) {
        setSubject("");
        setMessage("");
        setIsOpen(false);
        router.push(`/teacher/dashboard/support/${res.ticketId}`);
      }
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all shadow-xs active:scale-[0.98] cursor-pointer"
      >
        <Plus className="w-4 h-4" /> Open Teacher Support Ticket
      </button>
    );
  }

  return (
    <div className="p-6 rounded-2xl border border-border-default bg-white shadow-md space-y-4">
      <div className="flex items-center justify-between border-b border-border-default pb-3">
        <h3 className="text-sm font-bold text-heading font-serif">Create Teacher Support Ticket</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 text-body/60 hover:text-heading transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
            {errorMsg}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-heading">Subject</label>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Student reschedule request for Friday session"
            className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-heading">Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as TicketCategory)}
            className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
          >
            <option value={TicketCategory.BILLING}>Teacher Payouts & Compensation</option>
            <option value={TicketCategory.LESSON}>Student Issues & Rescheduling</option>
            <option value={TicketCategory.TECHNICAL}>LiveKit Video & Audio Engine</option>
            <option value={TicketCategory.COURSE}>Curriculum & Accreditation</option>
            <option value={TicketCategory.OTHER}>General / Academy Policy</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-heading">Details</label>
          <textarea
            required
            rows={4}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Describe the issue in detail..."
            className="w-full rounded-xl bg-white border border-border-default p-3 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed shadow-xs"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-body hover:text-heading transition-colors active:scale-[0.98]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Submit Ticket</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
