"use client";

import { DateTimePicker } from "@/components/ui/DateTimePicker";

import { useState, useTransition } from "react";
import { EventType } from "@prisma/client";
import {
  saveEventAdminAction,
  deleteEventAdminAction,
  assignTeacherToEventAdminAction,
} from "@/actions/admin";
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  Users,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  GraduationCap,
} from "lucide-react";

export interface AdminEventRegistrationItem {
  id: string;
  studentName: string;
  studentEmail: string;
  registeredAt: string;
}

export interface AdminTeacherOption {
  id: string;
  name: string;
  email: string;
  instruments: string[];
}

export interface AdminEventItem {
  id: string;
  title: string;
  description: string;
  type: EventType;
  startsAt: string; // ISO
  formattedDate: string;
  durationMinutes: number;
  capacity: number | null;
  isPublished: boolean;
  teacherId?: string | null;
  teacher?: {
    id: string;
    name: string;
    email: string;
    instruments: string[];
  } | null;
  registrations: AdminEventRegistrationItem[];
}

export function AdminEventsManager({
  initialEvents,
  availableTeachers = [],
}: {
  initialEvents: AdminEventItem[];
  availableTeachers?: AdminTeacherOption[];
}) {
  const [events, setEvents] = useState<AdminEventItem[]>(initialEvents);
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [selectedEventForRegistrations, setSelectedEventForRegistrations] =
    useState<AdminEventItem | null>(null);

  // Form State
  const [eventId, setEventId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<EventType>(EventType.WORKSHOP);
  const [startsAt, setStartsAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [capacity, setCapacity] = useState<string>("50");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");
  const [isPublished, setIsPublished] = useState(true);

  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const openCreateModal = () => {
    setModalMode("CREATE");
    setEventId(undefined);
    setTitle("");
    setDescription("");
    setType(EventType.WORKSHOP);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    nextWeek.setHours(15, 0, 0, 0);
    setStartsAt(nextWeek.toISOString().slice(0, 16));
    setDurationMinutes(90);
    setCapacity("50");
    setSelectedTeacherId("");
    setIsPublished(true);
    setFormError(null);
    setFormSuccess(false);
  };

  const openEditModal = (ev: AdminEventItem) => {
    setModalMode("EDIT");
    setEventId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description);
    setType(ev.type);
    setStartsAt(new Date(ev.startsAt).toISOString().slice(0, 16));
    setDurationMinutes(ev.durationMinutes);
    setCapacity(ev.capacity ? String(ev.capacity) : "");
    setSelectedTeacherId(ev.teacherId || "");
    setIsPublished(ev.isPublished);
    setFormError(null);
    setFormSuccess(false);
  };

  const handleInlineAssignTeacher = (targetEventId: string, newTeacherId: string) => {
    const matchedTeacher = availableTeachers.find((t) => t.id === newTeacherId);

    // Optimistically update
    setEvents((prev) =>
      prev.map((item) =>
        item.id === targetEventId
          ? {
              ...item,
              teacherId: newTeacherId || null,
              teacher: matchedTeacher
                ? {
                    id: matchedTeacher.id,
                    name: matchedTeacher.name,
                    email: matchedTeacher.email,
                    instruments: matchedTeacher.instruments,
                  }
                : null,
            }
          : item,
      ),
    );

    startTransition(async () => {
      const res = await assignTeacherToEventAdminAction({
        eventId: targetEventId,
        teacherId: newTeacherId || null,
      });
      if (!res.success) {
        alert(res.error || "Failed to update teacher allotment.");
      } else {
        setStatusMessage(
          matchedTeacher
            ? `Assigned ${matchedTeacher.name} to event.`
            : "Event faculty set to unassigned.",
        );
        setTimeout(() => setStatusMessage(null), 3000);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    startTransition(async () => {
      const parsedCapacity = capacity.trim() ? Number(capacity) : null;
      const matchedTeacher = availableTeachers.find((t) => t.id === selectedTeacherId);

      const res = await saveEventAdminAction({
        id: eventId,
        title,
        description,
        type,
        startsAt: new Date(startsAt).toISOString(),
        durationMinutes,
        capacity: parsedCapacity,
        teacherId: selectedTeacherId || null,
        isPublished,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to save event.");
      } else {
        setFormSuccess(true);
        const updatedTeacherData = matchedTeacher
          ? {
              id: matchedTeacher.id,
              name: matchedTeacher.name,
              email: matchedTeacher.email,
              instruments: matchedTeacher.instruments,
            }
          : null;

        if (modalMode === "CREATE") {
          setEvents((prev) => [
            {
              id: "temp-" + Date.now(),
              title,
              description,
              type,
              startsAt: new Date(startsAt).toISOString(),
              formattedDate: new Date(startsAt).toLocaleString(),
              durationMinutes,
              capacity: parsedCapacity,
              isPublished,
              teacherId: selectedTeacherId || null,
              teacher: updatedTeacherData,
              registrations: [],
            },
            ...prev,
          ]);
        } else {
          setEvents((prev) =>
            prev.map((item) =>
              item.id === eventId
                ? {
                    ...item,
                    title,
                    description,
                    type,
                    startsAt: new Date(startsAt).toISOString(),
                    formattedDate: new Date(startsAt).toLocaleString(),
                    durationMinutes,
                    capacity: parsedCapacity,
                    isPublished,
                    teacherId: selectedTeacherId || null,
                    teacher: updatedTeacherData,
                  }
                : item,
            ),
          );
        }
        setTimeout(() => {
          setModalMode(null);
          setFormSuccess(false);
        }, 1200);
      }
    });
  };

  const handleDelete = (ev: AdminEventItem) => {
    if (!confirm(`Delete event "${ev.title}"?`)) return;

    startTransition(async () => {
      const res = await deleteEventAdminAction(ev.id);
      if (!res.success) {
        alert(res.error || "Failed to delete event.");
      } else {
        setEvents((prev) => prev.filter((item) => item.id !== ev.id));
      }
    });
  };

  return (
    <div className="space-y-6">
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-semibold">{statusMessage}</span>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-xs text-body font-medium">
          Scheduled Workshops, Masterclasses, and Recitals ({events.length})
        </p>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-xs transition-all active:scale-95 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Schedule New Event
        </button>
      </div>

      {/* Events Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {events.map((ev) => (
          <div
            key={ev.id}
            className="rounded-2xl border border-primary/10 bg-white p-5 shadow-xs space-y-3 flex flex-col justify-between hover:shadow-sm transition-shadow"
          >
            <div className="space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent-dark border border-accent/25">
                  {ev.type}
                </span>

                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    ev.isPublished
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                  }`}
                >
                  {ev.isPublished ? "Live" : "Draft"}
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold font-serif text-heading">
                  {ev.title}
                </h3>
                <p className="text-xs text-body mt-0.5 line-clamp-2">
                  {ev.description}
                </p>
              </div>

              <div className="p-3 rounded-xl bg-bg-alt/25 border border-primary/10 space-y-1.5 text-xs text-body">
                <div className="flex items-center justify-between">
                  <span>Date & Time</span>
                  <span className="font-semibold text-heading font-numeric">{ev.formattedDate}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Duration</span>
                  <span className="font-numeric">{ev.durationMinutes} minutes</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span>Enrolled Capacity</span>
                  <span className="font-bold text-accent-dark font-numeric">
                    {ev.registrations.length} / {ev.capacity ? `${ev.capacity} seats` : "Unlimited"}
                  </span>
                </div>
              </div>

              {/* Faculty Mentor Allotment Widget */}
              <div className="p-3 rounded-xl bg-primary-subtle/40 border border-primary/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-accent-dark" />
                    Faculty Mentor
                  </span>
                  {ev.teacher ? (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-heading border border-primary/20 shadow-2xs">
                      Allotted
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                      Unassigned
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={ev.teacherId || ""}
                    onChange={(e) => handleInlineAssignTeacher(ev.id, e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-lg bg-white border border-primary/20 px-2.5 py-1.5 text-xs text-heading focus:outline-none focus:border-primary font-medium shadow-2xs transition-colors cursor-pointer"
                  >
                    <option value="">-- Assign Faculty Teacher --</option>
                    {availableTeachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} {t.instruments.length > 0 ? `(${t.instruments.join(", ")})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {ev.teacher && (
                  <div className="text-[11px] text-body-muted flex items-center justify-between pt-0.5">
                    <span className="truncate">{ev.teacher.email}</span>
                    {ev.teacher.instruments.length > 0 && (
                      <span className="text-accent-dark font-semibold shrink-0 ml-1">
                        {ev.teacher.instruments.slice(0, 2).join(", ")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 border-t border-primary/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedEventForRegistrations(ev)}
                className="text-xs font-semibold text-primary hover:text-cta flex items-center gap-1.5 transition-colors"
              >
                <Users className="w-3.5 h-3.5 text-accent-dark" />
                <span>View Registrations ({ev.registrations.length})</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEditModal(ev)}
                  className="px-3 py-1.5 rounded-lg bg-bg-alt/40 hover:bg-bg-alt text-xs font-semibold text-primary transition-all border border-primary/10 active:scale-95"
                  title="Edit Event"
                >
                  <Edit2 className="w-3.5 h-3.5 text-primary" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(ev)}
                  className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors active:scale-95"
                  title="Delete Event"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Registrations List Modal */}
      {selectedEventForRegistrations && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-heading/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-primary/15 bg-white p-6 shadow-xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-primary/10 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-dark">
                  Event Roster
                </span>
                <h3 className="font-serif text-lg font-bold text-heading">
                  {selectedEventForRegistrations.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEventForRegistrations(null)}
                className="p-1 text-body/60 hover:text-heading transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {selectedEventForRegistrations.registrations.length === 0 ? (
              <p className="text-xs text-body/60 italic py-6 text-center">
                No students have reserved seats for this event yet.
              </p>
            ) : (
              <div className="space-y-2">
                {selectedEventForRegistrations.registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="p-3 rounded-xl bg-bg-alt/25 border border-primary/10 flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-heading">{reg.studentName}</p>
                      <p className="text-[11px] text-body">{reg.studentEmail}</p>
                    </div>
                    <span className="text-[10px] text-body/60 font-numeric">
                      {new Date(reg.registeredAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-heading/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-primary/15 bg-white p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-primary/10 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-dark">
                  {modalMode === "CREATE" ? "New Workshop" : "Edit Workshop"}
                </span>
                <h3 className="font-serif text-lg font-bold text-heading">
                  {modalMode === "CREATE" ? "Schedule Academy Activity" : `Edit: ${title}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 text-body/60 hover:text-heading transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Event saved successfully!</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading">
                  Event Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Masterclass with Pandit Hariprasad Chaurasia"
                  className="w-full rounded-xl bg-white border border-primary/15 px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">
                    Activity Type
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as EventType)}
                    className="w-full rounded-xl bg-white border border-primary/15 px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                  >
                    <option value={EventType.WORKSHOP}>WORKSHOP</option>
                    <option value={EventType.MASTERCLASS}>MASTERCLASS</option>
                    <option value={EventType.RECITAL}>RECITAL</option>
                    <option value={EventType.EXAM_PREP}>EXAM PREP</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">
                    Seat Capacity
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    placeholder="Leave empty for unlimited"
                    className="w-full rounded-xl bg-white border border-primary/15 px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">
                    Date & Time
                  </label>
                  <DateTimePicker
                    value={startsAt}
                    onChange={setStartsAt}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min={15}
                    max={240}
                    required
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-primary/15 px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-accent-dark" />
                  Assigned Faculty Mentor
                </label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full rounded-xl bg-white border border-primary/15 px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
                >
                  <option value="">-- No Teacher Assigned (Unassigned) --</option>
                  {availableTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.instruments.length > 0 ? `(${t.instruments.join(", ")})` : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-body-muted">
                  The event will automatically be placed on the faculty member&apos;s studio calendar and in enrolled students&apos; calendars.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading">
                  Event Description
                </label>
                <textarea
                  required
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl bg-white border border-primary/15 p-3 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs text-heading cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span>Publish immediately to student portal</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-primary/10">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-body hover:text-heading transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-95"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Event</span>
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
