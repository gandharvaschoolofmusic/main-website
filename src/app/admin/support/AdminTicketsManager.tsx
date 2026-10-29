"use client";

import { useState } from "react";
import { TicketCategory, TicketStatus, Role } from "@prisma/client";
import Link from "next/link";
import {
  HelpCircle,
  Search,
  Clock,
  ChevronRight,
  MessageSquare,
  Shield,
  GraduationCap,
  User,
} from "lucide-react";

export interface AdminTicketItem {
  id: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  createdAt: string;
  userName: string;
  userEmail: string;
  userRole: Role;
  userCustomId?: string | null;
  messagesCount: number;
}

export function AdminTicketsManager({
  initialTickets,
}: {
  initialTickets: AdminTicketItem[];
}) {
  const [tickets] = useState<AdminTicketItem[]>(initialTickets);
  const [statusFilter, setStatusFilter] = useState<"ALL" | TicketStatus>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | TicketCategory>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  const statusColors: Record<TicketStatus, string> = {
    OPEN: "bg-amber-50 text-amber-700 border-amber-200",
    IN_PROGRESS: "bg-sky-50 text-sky-700 border-sky-200",
    RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
    CLOSED: "bg-neutral-100 text-neutral-600 border-neutral-200",
  };

  const filteredTickets = tickets.filter((t) => {
    const matchesStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchesCategory = categoryFilter === "ALL" || t.category === categoryFilter;
    const matchesSearch =
      t.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.userCustomId && t.userCustomId.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesStatus && matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-white border border-primary/10 shadow-xs flex-wrap">
          <button
            type="button"
            onClick={() => setStatusFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              statusFilter === "ALL"
                ? "bg-primary text-white shadow-xs"
                : "text-body hover:text-heading hover:bg-bg-alt/30"
            }`}
          >
            All ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(TicketStatus.OPEN)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              statusFilter === TicketStatus.OPEN
                ? "bg-primary text-white shadow-xs"
                : "text-body hover:text-heading hover:bg-bg-alt/30"
            }`}
          >
            Open ({tickets.filter((t) => t.status === TicketStatus.OPEN).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(TicketStatus.IN_PROGRESS)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              statusFilter === TicketStatus.IN_PROGRESS
                ? "bg-primary text-white shadow-xs"
                : "text-body hover:text-heading hover:bg-bg-alt/30"
            }`}
          >
            In Progress (
            {tickets.filter((t) => t.status === TicketStatus.IN_PROGRESS).length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter(TicketStatus.RESOLVED)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
              statusFilter === TicketStatus.RESOLVED
                ? "bg-primary text-white shadow-xs"
                : "text-body hover:text-heading hover:bg-bg-alt/30"
            }`}
          >
            Resolved ({tickets.filter((t) => t.status === TicketStatus.RESOLVED).length})
          </button>
        </div>

        {/* Category & Search */}
        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as "ALL" | TicketCategory)}
            className="rounded-xl bg-white border border-primary/15 px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
          >
            <option value="ALL">All Categories</option>
            <option value={TicketCategory.BILLING}>Billing</option>
            <option value={TicketCategory.LESSON}>Lesson / Scheduling</option>
            <option value={TicketCategory.TECHNICAL}>Technical</option>
            <option value={TicketCategory.COURSE}>Course</option>
            <option value={TicketCategory.OTHER}>Other</option>
          </select>

          <div className="relative w-48 sm:w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-body/60" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tickets..."
              className="w-full rounded-xl bg-white border border-primary/15 pl-8 pr-3 py-2 text-xs text-heading placeholder:text-body/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-xs"
            />
          </div>
        </div>
      </div>

      {/* Tickets List */}
      {filteredTickets.length === 0 ? (
        <div className="rounded-2xl border border-primary/10 bg-white p-12 text-center text-xs text-body shadow-xs">
          No support tickets matching current filter criteria.
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredTickets.map((t) => (
            <Link
              key={t.id}
              href={`/admin/support/${t.id}`}
              className="group p-4 rounded-xl border border-primary/10 bg-white hover:border-primary/30 hover:shadow-xs transition-all flex items-center justify-between gap-4 shadow-2xs active:scale-[0.99]"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                      statusColors[t.status] || ""
                    }`}
                  >
                    {t.status}
                  </span>

                  <span className="px-2 py-0.5 rounded-md bg-bg-alt/50 text-primary text-[10px] font-semibold border border-primary/10">
                    {t.category}
                  </span>

                  <span className="text-[11px] text-body flex items-center gap-1 font-numeric">
                    <Clock className="w-3 h-3 text-body/60" />
                    {new Date(t.createdAt).toLocaleDateString()}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-heading group-hover:text-primary transition-colors truncate">
                  {t.subject}
                </h3>

                <div className="flex items-center gap-2 text-xs text-body flex-wrap">
                  <span>From:</span>
                  <strong className="text-heading font-medium">{t.userName}</strong>
                  {t.userCustomId && (
                    <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-100 text-[#3C096C]">
                      {t.userCustomId}
                    </span>
                  )}
                  <span>({t.userEmail})</span>
                  <span className="text-[10px] uppercase font-bold text-accent-dark bg-accent/10 px-1.5 py-0.5 rounded border border-accent/20">
                    {t.userRole}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-body hidden sm:inline font-numeric">
                  {t.messagesCount} message{t.messagesCount === 1 ? "" : "s"}
                </span>
                <ChevronRight className="w-4 h-4 text-body/50 group-hover:text-primary transition-colors" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
