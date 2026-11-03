"use client";

import { useState, useEffect } from "react";
import {
  Users,
  Search,
  BookOpen,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  X,
  Save,
} from "lucide-react";

export interface StudentItem {
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentTimezone: string;
  courseTitle: string;
  type: "COURSE" | "TRIAL";
  sessionsCompleted: number;
  sessionsTotal: number;
  nextLessonFormatted: string | null;
  instrument: string;
}

interface TeacherStudentsListProps {
  students: StudentItem[];
  teacherId: string;
}

export function TeacherStudentsList({
  students,
  teacherId,
}: TeacherStudentsListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStudentForNotes, setActiveStudentForNotes] =
    useState<StudentItem | null>(null);
  const [notesText, setNotesText] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // When a student is selected for notes, load notes from localStorage
  useEffect(() => {
    if (activeStudentForNotes) {
      const storageKey = `gsm_note_${teacherId}_${activeStudentForNotes.studentId}`;
      const saved = localStorage.getItem(storageKey) || "";
      setNotesText(saved);
      setSaveSuccess(false);
    }
  }, [activeStudentForNotes, teacherId]);

  const handleSaveNotes = () => {
    if (!activeStudentForNotes) return;
    const storageKey = `gsm_note_${teacherId}_${activeStudentForNotes.studentId}`;
    localStorage.setItem(storageKey, notesText);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const filteredStudents = students.filter(
    (s) =>
      s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.studentEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.courseTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.instrument.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-body/50" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, course, or instrument..."
            className="w-full rounded-xl bg-white border border-border-default pl-10 pr-4 py-2.5 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-body bg-white border border-border-default px-3 py-2 rounded-xl shadow-xs">
          <Users className="w-4 h-4 text-primary" />
          <span>
            Showing <strong className="text-heading font-numeric">{filteredStudents.length}</strong> of{" "}
            <span className="font-numeric">{students.length}</span> students
          </span>
        </div>
      </div>

      {/* Student Cards Grid */}
      {filteredStudents.length === 0 ? (
        <div className="rounded-2xl border border-border-default bg-white p-12 text-center shadow-xs">
          <Users className="w-8 h-8 text-body/40 mx-auto mb-3" />
          <h3 className="font-serif text-base font-bold text-heading">
            No students found
          </h3>
          <p className="text-xs text-body mt-1">
            {searchQuery
              ? "Try adjusting your search criteria."
              : "Students assigned to your studio or booked for trials will appear here."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredStudents.map((s) => {
            const initials = s.studentName
              .split(" ")
              .map((w) => w[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            const progressPct = Math.min(
              100,
              Math.round((s.sessionsCompleted / s.sessionsTotal) * 100),
            );

            return (
              <div
                key={`${s.studentId}-${s.courseTitle}`}
                className="rounded-2xl border border-border-default bg-white p-5 shadow-xs hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3.5">
                  {/* Top row: Avatar + Name + Type Tag */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-primary to-accent flex items-center justify-center font-bold text-xs text-white shadow-xs">
                        {initials}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-heading">
                          {s.studentName}
                        </h4>
                        <p className="text-[11px] text-body">
                          {s.studentEmail} &bull; {s.studentTimezone}
                        </p>
                      </div>
                    </div>

                    {s.type === "TRIAL" ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent-subtle text-accent-dark border border-accent/30">
                        Trial Student
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary-subtle text-primary border border-primary/30">
                        Enrolled
                      </span>
                    )}
                  </div>

                  {/* Course / Instrument info */}
                  <div className="p-3.5 rounded-xl bg-bg-alt/30 border border-border-default/60 space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-heading font-bold truncate">
                        {s.courseTitle}
                      </span>
                      <span className="text-accent-dark font-bold shrink-0 text-[11px] px-2 py-0.5 rounded-md bg-white border border-accent/20">
                        {s.instrument}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-body">
                        <span>Sessions Completed</span>
                        <span className="font-bold text-heading font-numeric">
                          {s.sessionsCompleted} / {s.sessionsTotal} ({progressPct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-neutral-200/80 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent to-cta rounded-full transition-all"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Next Lesson Date */}
                  <div className="flex items-center gap-2 text-xs text-body bg-neutral-50 px-3 py-2 rounded-lg border border-border-default/50">
                    <Calendar className="w-3.5 h-3.5 text-primary" />
                    <span>Next Scheduled:</span>
                    <strong className="text-heading font-semibold">
                      {s.nextLessonFormatted || "None booked yet"}
                    </strong>
                  </div>
                </div>

                {/* Footer: Notes Button */}
                <div className="pt-3 border-t border-border-default/60 flex items-center justify-between">
                  <span className="text-[11px] text-body font-medium">
                    Teacher Private Log
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveStudentForNotes(s)}
                    className="px-3.5 py-1.5 rounded-xl bg-primary-subtle hover:bg-primary text-primary hover:text-white text-xs font-semibold flex items-center gap-1.5 border border-primary/20 transition-all active:scale-[0.98] shadow-xs cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Student Notes</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Private Teacher Notes Modal */}
      {activeStudentForNotes && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-border-default bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                  Private Instructor Notes
                </span>
                <h3 className="font-serif text-lg font-bold text-heading">
                  {activeStudentForNotes.studentName}
                </h3>
                <p className="text-xs text-body">
                  {activeStudentForNotes.courseTitle} ({activeStudentForNotes.instrument})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveStudentForNotes(null)}
                className="p-1 rounded-lg text-body hover:text-heading hover:bg-neutral-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-heading block">
                Lesson observations, technical progress & practice assignments:
              </label>
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={6}
                placeholder="e.g. Focus on finger positioning for C major scale. Student practiced metronome exercises at 80 bpm. Next lesson will introduce chord inversions."
                className="w-full rounded-xl bg-white border border-border-default p-3.5 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed shadow-xs"
              />
              <p className="text-[11px] text-body">
                These notes are confidential and stored privately on this device for your studio reference.
              </p>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-border-default">
              <div>
                {saveSuccess && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1 font-semibold">
                    <CheckCircle2 className="w-4 h-4" /> Notes saved securely!
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveStudentForNotes(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-border-default bg-neutral-100 text-body text-xs font-semibold hover:bg-neutral-200 hover:text-heading transition-colors active:scale-[0.98]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleSaveNotes}
                  className="px-4 py-1.5 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98]"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Notes</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
