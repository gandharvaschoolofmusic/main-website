"use client";

import { useState, useTransition } from "react";
import { Role, TeacherApprovalStatus } from "@prisma/client";
import { updateUserAdminAction } from "@/actions/admin";
import {
  Users,
  Search,
  Shield,
  GraduationCap,
  User,
  Settings,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Coins,
  Ticket,
  Smartphone,
  CreditCard,
  Copy,
  Check,
  Clock,
} from "lucide-react";

export interface AdminUserData {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  phoneVerified?: string | null;
  role: Role;
  isActive: boolean;
  timezone: string;
  createdAt: string;
  trialStatus?: {
    lessonsGranted: number;
    lessonsUsed: number;
  } | null;
  teacherProfile?: {
    payoutPerSession: number; // paise
    instruments: string[];
    isPublished: boolean;
    upiId?: string | null;
    approvalStatus: TeacherApprovalStatus;
    approvedAt?: string | null;
    rejectionReason?: string | null;
  } | null;
}

export function AdminUsersManager({
  initialUsers,
}: {
  initialUsers: AdminUserData[];
}) {
  const [users, setUsers] = useState<AdminUserData[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"ALL" | Role>("ALL");

  // Selected user for edit modal
  const [selectedUser, setSelectedUser] = useState<AdminUserData | null>(null);
  const [editRole, setEditRole] = useState<Role>(Role.STUDENT);
  const [editIsActive, setEditIsActive] = useState<boolean>(true);
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editTrialCount, setEditTrialCount] = useState<number>(2);
  const [editPayoutRupees, setEditPayoutRupees] = useState<number>(500);
  const [editApprovalStatus, setEditApprovalStatus] = useState<TeacherApprovalStatus>(
    TeacherApprovalStatus.PENDING,
  );
  const [editRejectionReason, setEditRejectionReason] = useState("");

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState(false);

  const openEditModal = (u: AdminUserData) => {
    setSelectedUser(u);
    setEditRole(u.role);
    setEditIsActive(u.isActive);
    setEditPhone(u.phone || "");
    setEditPassword("");
    setEditTrialCount(u.trialStatus?.lessonsGranted ?? 2);
    setEditPayoutRupees(
      u.teacherProfile?.payoutPerSession
        ? u.teacherProfile.payoutPerSession / 100
        : 500,
    );
    setEditApprovalStatus(
      u.teacherProfile?.approvalStatus || TeacherApprovalStatus.PENDING,
    );
    setEditRejectionReason(u.teacherProfile?.rejectionReason || "");
    setActionError(null);
    setActionSuccess(false);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    setActionError(null);
    setActionSuccess(false);

    startTransition(async () => {
      const trimmedPhone = editPhone.trim() ? editPhone.trim() : null;
      const res = await updateUserAdminAction({
        userId: selectedUser.id,
        phone: trimmedPhone,
        role: editRole,
        isActive: editIsActive,
        newPassword: editPassword.trim() ? editPassword.trim() : undefined,
        trialCount: editRole === Role.STUDENT ? editTrialCount : undefined,
        payoutPerSession:
          editRole === Role.TEACHER ? editPayoutRupees * 100 : undefined,
        teacherApprovalStatus:
          editRole === Role.TEACHER ? editApprovalStatus : undefined,
        rejectionReason:
          editRole === Role.TEACHER && editApprovalStatus === TeacherApprovalStatus.REJECTED
            ? editRejectionReason
            : undefined,
      });

      if (!res.success) {
        setActionError(res.error || "Failed to update user.");
      } else {
        setActionSuccess(true);
        // Update local state
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === selectedUser.id) {
              return {
                ...u,
                phone: trimmedPhone,
                phoneVerified: trimmedPhone
                  ? u.phone === trimmedPhone
                    ? u.phoneVerified
                    : new Date().toISOString()
                  : null,
                role: editRole,
                isActive: editIsActive,
                trialStatus:
                  editRole === Role.STUDENT
                    ? {
                        lessonsGranted: editTrialCount,
                        lessonsUsed: u.trialStatus?.lessonsUsed || 0,
                      }
                    : u.trialStatus,
                teacherProfile:
                  editRole === Role.TEACHER
                    ? {
                        payoutPerSession: editPayoutRupees * 100,
                        instruments: u.teacherProfile?.instruments || [],
                        isPublished:
                          editApprovalStatus === TeacherApprovalStatus.APPROVED
                            ? (u.teacherProfile?.isPublished || false)
                            : false,
                        upiId: u.teacherProfile?.upiId || null,
                        approvalStatus: editApprovalStatus,
                        approvedAt:
                          editApprovalStatus === TeacherApprovalStatus.APPROVED
                            ? new Date().toISOString()
                            : null,
                        rejectionReason:
                          editApprovalStatus === TeacherApprovalStatus.REJECTED
                            ? editRejectionReason
                            : null,
                      }
                    : u.teacherProfile,
              };
            }
            return u;
          }),
        );
        setTimeout(() => {
          setSelectedUser(null);
          setActionSuccess(false);
        }, 1200);
      }
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchesSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (u.phone ? u.phone.toLowerCase().includes(searchQuery.toLowerCase()) : false);
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Search and Role Filter Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white border border-border-default shadow-xs self-start overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setRoleFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === "ALL"
                ? "bg-primary text-white shadow-xs font-bold"
                : "text-body hover:text-heading font-medium"
            }`}
          >
            All Users ({users.length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter(Role.STUDENT)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === Role.STUDENT
                ? "bg-primary text-white shadow-xs font-bold"
                : "text-body hover:text-heading font-medium"
            }`}
          >
            Students ({users.filter((u) => u.role === Role.STUDENT).length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter(Role.TEACHER)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === Role.TEACHER
                ? "bg-primary text-white shadow-xs font-bold"
                : "text-body hover:text-heading font-medium"
            }`}
          >
            Teachers ({users.filter((u) => u.role === Role.TEACHER).length})
          </button>
          <button
            type="button"
            onClick={() => setRoleFilter(Role.ADMIN)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer whitespace-nowrap ${
              roleFilter === Role.ADMIN
                ? "bg-primary text-white shadow-xs font-bold"
                : "text-body hover:text-heading font-medium"
            }`}
          >
            Admins ({users.filter((u) => u.role === Role.ADMIN).length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-body/40" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-xl bg-white border border-border-default pl-9 pr-3 py-2 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="rounded-2xl border border-border-default bg-white overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border-default bg-neutral-50/70 text-body font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Account Status</th>
                <th className="py-3.5 px-4">Role Context</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default/60">
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  className="hover:bg-neutral-50/50 transition-colors"
                >
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs">
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-heading truncate">{u.name}</p>
                        <p className="text-[11px] text-body truncate">
                          {u.email}
                        </p>
                        {u.phone ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[11px] font-mono text-heading">{u.phone}</span>
                            {u.phoneVerified ? (
                              <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-1.5 py-0.5 rounded-md">
                                <CheckCircle2 className="w-2.5 h-2.5" />
                                <span>OTP Verified</span>
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md">
                                Unverified
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-[10px] text-body/40 italic mt-0.5">No phone linked</p>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === Role.ADMIN
                          ? "bg-primary-subtle text-primary border border-primary/30"
                          : u.role === Role.TEACHER
                          ? "bg-accent-subtle text-accent-dark border border-accent/30"
                          : "bg-sky-50 text-sky-800 border border-sky-200"
                      }`}
                    >
                      {u.role === Role.ADMIN ? (
                        <Shield className="w-3 h-3" />
                      ) : u.role === Role.TEACHER ? (
                        <GraduationCap className="w-3 h-3" />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      <span>{u.role}</span>
                    </span>
                  </td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        u.isActive
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "bg-rose-50 text-rose-700 border border-rose-200"
                      }`}
                    >
                      {u.isActive ? "Active" : "Suspended"}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-body">
                    {u.role === Role.STUDENT ? (
                      <span className="text-[11px]">
                        Trials:{" "}
                        <strong className="text-accent-dark font-bold font-numeric">
                          {u.trialStatus?.lessonsGranted ?? 2} granted
                        </strong>{" "}
                        (<span className="font-numeric">{u.trialStatus?.lessonsUsed ?? 0}</span> used)
                      </span>
                    ) : u.role === Role.TEACHER ? (
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          {u.teacherProfile?.approvalStatus === "APPROVED" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 border border-emerald-300">
                              <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                              <span>Approved</span>
                            </span>
                          ) : u.teacherProfile?.approvalStatus === "REJECTED" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 border border-rose-300">
                              <AlertCircle className="w-2.5 h-2.5 text-rose-600" />
                              <span>Rejected</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                              <Clock className="w-2.5 h-2.5 text-amber-600 animate-pulse" />
                              <span>Pending Review</span>
                            </span>
                          )}
                          <span className="text-[10px] text-body-muted">
                            {u.teacherProfile?.isPublished ? "• Live" : "• Draft"}
                          </span>
                        </div>
                        <span className="text-[11px] block">
                          Payout:{" "}
                          <strong className="text-emerald-700 font-bold font-numeric">
                            ₹{(((u.teacherProfile?.payoutPerSession ?? 50000) / 100)).toFixed(0)}
                          </strong>
                        </span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-body/60">Full System Access</span>
                    )}
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => openEditModal(u)}
                      className="px-3 py-1.5 rounded-xl border border-border-default bg-white hover:bg-neutral-50 text-xs font-semibold text-heading transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                    >
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  User Permissions & Settings
                </span>
                <h3 className="font-serif text-lg font-bold text-heading">
                  {selectedUser.name}
                </h3>
                <p className="text-xs text-body">{selectedUser.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                className="p-1 text-body/50 hover:text-heading transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="space-y-4">
              {actionError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{actionError}</span>
                </div>
              )}

              {actionSuccess && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>User settings updated successfully!</span>
                </div>
              )}

              {/* Role */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading">
                  Account Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as Role)}
                  className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                >
                  <option value={Role.STUDENT}>STUDENT (Bookings & Learning)</option>
                  <option value={Role.TEACHER}>TEACHER (Studio & Lessons)</option>
                  <option value={Role.ADMIN}>ADMIN (Full Control Center)</option>
                </select>
              </div>

              {/* Active Toggle */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading">
                  Account Status
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs text-heading cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={editIsActive}
                      onChange={() => setEditIsActive(true)}
                      className="accent-primary"
                    />
                    <span>Active (Permit Login)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-heading cursor-pointer">
                    <input
                      type="radio"
                      name="isActive"
                      checked={!editIsActive}
                      onChange={() => setEditIsActive(false)}
                      className="accent-primary"
                    />
                    <span>Suspended (Block Access)</span>
                  </label>
                </div>
              </div>

              {/* Mobile Phone Number */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-primary" />
                  <span>Mobile Phone Number</span>
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                />
                <p className="text-[10px] text-body">
                  Used for OTP sign in and verification. Include country code (e.g. +91). Leave empty to unlink phone.
                </p>
              </div>

              {/* Student Trial Allocation */}
              {editRole === Role.STUDENT && (
                <div className="p-3.5 rounded-xl bg-bg-alt/30 border border-border-default/60 space-y-1.5">
                  <label className="text-xs font-semibold text-accent-dark flex items-center gap-1.5">
                    <Ticket className="w-3.5 h-3.5" />
                    <span>Free Trial Lessons Granted</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={editTrialCount}
                    onChange={(e) => setEditTrialCount(Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-border-default px-3 py-1.5 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs font-numeric"
                  />
                  <p className="text-[11px] text-body font-numeric">
                    Currently used: {selectedUser.trialStatus?.lessonsUsed || 0} trial lesson(s).
                  </p>
                </div>
              )}

              {/* Teacher Payout per Session & Coordinates */}
              {editRole === Role.TEACHER && (
                <div className="space-y-3">
                  {/* Teacher Approval Status & Accreditation */}
                  <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/90 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-heading flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5 text-amber-600" />
                        <span>Faculty Accreditation Status</span>
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${
                          editApprovalStatus === "APPROVED"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : editApprovalStatus === "REJECTED"
                              ? "bg-rose-100 text-rose-800 border-rose-300"
                              : "bg-amber-100 text-amber-800 border-amber-300"
                        }`}
                      >
                        {editApprovalStatus}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditApprovalStatus(TeacherApprovalStatus.APPROVED)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border active:scale-[0.98] ${
                          editApprovalStatus === TeacherApprovalStatus.APPROVED
                            ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                            : "bg-white text-body border-border-default hover:border-emerald-400"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                        <span>Approved</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditApprovalStatus(TeacherApprovalStatus.PENDING)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border active:scale-[0.98] ${
                          editApprovalStatus === TeacherApprovalStatus.PENDING
                            ? "bg-amber-600 text-white border-amber-600 shadow-xs"
                            : "bg-white text-body border-border-default hover:border-amber-400"
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>Pending</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setEditApprovalStatus(TeacherApprovalStatus.REJECTED)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 border active:scale-[0.98] ${
                          editApprovalStatus === TeacherApprovalStatus.REJECTED
                            ? "bg-rose-600 text-white border-rose-600 shadow-xs"
                            : "bg-white text-body border-border-default hover:border-rose-400"
                        }`}
                      >
                        <X className="w-3 h-3" />
                        <span>Rejected</span>
                      </button>
                    </div>

                    {editApprovalStatus === TeacherApprovalStatus.REJECTED && (
                      <div className="space-y-1 pt-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
                          Rejection Reason / Guidance for Instructor
                        </label>
                        <input
                          type="text"
                          value={editRejectionReason}
                          onChange={(e) => setEditRejectionReason(e.target.value)}
                          placeholder="e.g. Please update your instruments or bio with classical certification"
                          className="w-full rounded-lg bg-white border border-rose-300 p-2 text-xs text-heading shadow-xs focus:border-rose-500 focus:outline-hidden"
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 rounded-xl bg-bg-alt/30 border border-border-default/60 space-y-1.5">
                    <label className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5">
                      <Coins className="w-3.5 h-3.5" />
                      <span>Fixed Session Payout Rate (₹)</span>
                    </label>
                    <input
                      type="number"
                      min={100}
                      max={10000}
                      step={50}
                      value={editPayoutRupees}
                      onChange={(e) => setEditPayoutRupees(Number(e.target.value))}
                      className="w-full rounded-xl bg-white border border-border-default px-3 py-1.5 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs font-numeric"
                    />
                    <p className="text-[11px] text-body">
                      Flat rate credited per 60m delivered session (stored in paise).
                    </p>
                  </div>

                  {/* Teacher's Payout Coordinates (UPI ID) */}
                  <div className="p-3.5 rounded-xl bg-neutral-50/70 border border-border-default/70 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-heading flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-accent" />
                        <span>Teacher Remuneration Coordinates</span>
                      </span>
                      {selectedUser.teacherProfile?.upiId ? (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Active VPA
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          UPI Not Set
                        </span>
                      )}
                    </div>

                    <div className="space-y-2 text-xs">
                      <div>
                        <span className="text-[10px] text-body font-semibold uppercase tracking-wider block">
                          UPI ID
                        </span>
                        {selectedUser.teacherProfile?.upiId ? (
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono font-bold text-heading bg-white px-2 py-1 rounded border border-border-default">
                              {selectedUser.teacherProfile.upiId}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(selectedUser.teacherProfile?.upiId || "")}
                              className="p-1 rounded text-body/60 hover:text-heading cursor-pointer"
                              title="Copy UPI ID"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <p className="text-body/60 italic text-[11px]">
                            Teacher has not configured their UPI ID yet.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Reset Password */}
              <div className="space-y-1.5 pt-2 border-t border-border-default">
                <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-body" />
                  <span>Reset User Password (Optional)</span>
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Leave blank to preserve current password"
                  className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-border-default bg-neutral-100 text-xs font-semibold text-body hover:text-heading transition-colors active:scale-[0.98]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-5 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save User Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
