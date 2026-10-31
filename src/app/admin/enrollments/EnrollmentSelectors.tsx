"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import {
  Search,
  X,
  ChevronDown,
  ChevronsUpDown,
  Check,
  Sparkles,
  Clock,
  CheckCircle2,
  GraduationCap,
  Music,
  BookOpen,
  User,
  Filter,
} from "lucide-react";
import {
  StudentOption,
  FacultyOption,
  CourseCatalogOption,
  EnrollmentRecord,
  AdminCourseEnrollmentRequestItem,
} from "./AdminEnrollmentsManager";

// ═══════════════════════════════════════════════════════════════════════════
// 1. SEARCHABLE STUDENT SELECTOR (Handles hundreds of enrolled/lead students)
// ═══════════════════════════════════════════════════════════════════════════

interface SearchableStudentSelectorProps {
  students: StudentOption[];
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
  enrollments: EnrollmentRecord[];
  courseRequests: AdminCourseEnrollmentRequestItem[];
}

export function SearchableStudentSelector({
  students,
  selectedStudentId,
  onSelectStudent,
  enrollments,
  courseRequests,
}: SearchableStudentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "PENDING" | "ENROLLED" | "LEADS">("ALL");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      setFilterTab("ALL");
    }
  }, [isOpen]);

  // Aggregate metadata per student
  const studentMetaMap = useMemo(() => {
    const map = new Map<
      string,
      {
        pendingCount: number;
        enrolledCount: number;
        activeCourseNames: string[];
      }
    >();

    students.forEach((s) => {
      const pending = courseRequests.filter((r) => r.studentId === s.id && r.status === "PENDING").length;
      const enrolled = enrollments.filter((e) => e.studentId === s.id);
      map.set(s.id, {
        pendingCount: pending,
        enrolledCount: enrolled.length,
        activeCourseNames: enrolled.map((e) => e.courseTitle),
      });
    });

    return map;
  }, [students, courseRequests, enrollments]);

  // Counts for filter pills
  const totalPendingStudents = useMemo(() => {
    return students.filter((s) => (studentMetaMap.get(s.id)?.pendingCount || 0) > 0).length;
  }, [students, studentMetaMap]);

  const totalEnrolledStudents = useMemo(() => {
    return students.filter((s) => (studentMetaMap.get(s.id)?.enrolledCount || 0) > 0).length;
  }, [students, studentMetaMap]);

  const totalLeads = useMemo(() => {
    return students.filter((s) => {
      const meta = studentMetaMap.get(s.id);
      return (meta?.pendingCount || 0) === 0 && (meta?.enrolledCount || 0) === 0;
    }).length;
  }, [students, studentMetaMap]);

  // Filtered students
  const filteredStudents = useMemo(() => {
    let result = students;

    // Apply tab filter
    if (filterTab === "PENDING") {
      result = result.filter((s) => (studentMetaMap.get(s.id)?.pendingCount || 0) > 0);
    } else if (filterTab === "ENROLLED") {
      result = result.filter((s) => (studentMetaMap.get(s.id)?.enrolledCount || 0) > 0);
    } else if (filterTab === "LEADS") {
      result = result.filter((s) => {
        const meta = studentMetaMap.get(s.id);
        return (meta?.pendingCount || 0) === 0 && (meta?.enrolledCount || 0) === 0;
      });
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((s) => {
        const studentCode = (s.customId || `S${s.id.slice(-4)}`).toLowerCase();
        return (
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          studentCode.includes(q) ||
          (s.phone && s.phone.includes(q))
        );
      });
    }

    return result;
  }, [students, filterTab, searchQuery, studentMetaMap]);

  const selectedStudent = useMemo(() => {
    if (!selectedStudentId) return null;
    return students.find((s) => s.id === selectedStudentId) || null;
  }, [students, selectedStudentId]);

  const selectedMeta = selectedStudent ? studentMetaMap.get(selectedStudent.id) : null;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* ── SELECTED STUDENT DISPLAY CARD & TRIGGER BUTTON ── */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="group p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 hover:border-[#3C096C]/60 shadow-2xs hover:shadow-xs transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Avatar with luxury gradient */}
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#3C096C] to-[#7B2CBF] text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ring-2 ring-purple-100">
            {selectedStudent ? (
              (selectedStudent.name || "S")[0].toUpperCase()
            ) : (
              <GraduationCap className="w-5 h-5 text-white/90" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-xs sm:text-sm text-heading truncate">
                {selectedStudent?.name || "Choose a Student..."}
              </span>
              {selectedStudent ? (
                <span className="px-2 py-0.5 rounded-md bg-purple-50 text-[#3C096C] font-mono text-[10px] font-bold border border-purple-200/80">
                  {selectedStudent.customId || `S${selectedStudent.id.slice(-4).toUpperCase()}`}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 text-[10px] font-bold border border-amber-200">
                  Select Required
                </span>
              )}
            </div>

            {selectedStudent && (
              <div className="text-[11px] text-body-muted truncate mt-0.5 flex items-center gap-2">
                <span className="truncate">{selectedStudent.email}</span>
                {selectedStudent.timezone && (
                  <span className="hidden sm:inline text-body/50">· {selectedStudent.timezone}</span>
                )}
                {selectedStudent.phone && (
                  <span className="hidden md:inline text-body/50">· {selectedStudent.phone}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right side: Status Tag & Trigger Action */}
        <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto justify-between sm:justify-end">
          {selectedMeta && selectedMeta.pendingCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-900 border border-amber-200 shadow-2xs">
              <Clock className="w-3 h-3 text-amber-600 animate-pulse" />
              <span>{selectedMeta.pendingCount} Course Request(s) Awaiting</span>
            </span>
          ) : selectedMeta && selectedMeta.enrolledCount > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>{selectedMeta.enrolledCount} Active Course(s)</span>
            </span>
          ) : selectedStudent ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-[#3C096C] border border-purple-200">
              <Sparkles className="w-3 h-3 text-[#3C096C]" />
              <span>Converted Lead</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-neutral-100 text-body/70 border border-neutral-200">
              <span>No student selected</span>
            </span>
          )}

          <div className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-purple-50 group-hover:bg-purple-100 text-[#3C096C] text-xs font-bold transition-colors">
            <span className="hidden xs:inline">{selectedStudent ? "Change" : "Select Student"}</span>
            <ChevronsUpDown className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>

      {/* ── DROPDOWN POPOVER PANEL ── */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Header & Search Bar */}
          <div className="p-3 bg-neutral-50/70 border-b border-slate-100 space-y-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${students.length} students by name, email, or student ID (e.g. S0001)...`}
                className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-heading placeholder:text-gray-400 focus:outline-none focus:border-[#3C096C] focus:ring-2 focus:ring-[#3C096C]/15 shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Filter Segment Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5 text-[11px]">
              <button
                type="button"
                onClick={() => setFilterTab("ALL")}
                className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterTab === "ALL"
                    ? "bg-[#3C096C] text-white shadow-2xs"
                    : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                }`}
              >
                All ({students.length})
              </button>

              {totalPendingStudents > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTab("PENDING")}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    filterTab === "PENDING"
                      ? "bg-amber-600 text-white shadow-2xs"
                      : "bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>Awaiting ({totalPendingStudents})</span>
                </button>
              )}

              {totalEnrolledStudents > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTab("ENROLLED")}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1 ${
                    filterTab === "ENROLLED"
                      ? "bg-emerald-700 text-white shadow-2xs"
                      : "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200"
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Enrolled ({totalEnrolledStudents})</span>
                </button>
              )}

              {totalLeads > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterTab("LEADS")}
                  className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    filterTab === "LEADS"
                      ? "bg-purple-800 text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  Leads ({totalLeads})
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Students List */}
          <div className="max-h-72 overflow-y-auto custom-scrollbar divide-y divide-slate-100 pr-1">
            {filteredStudents.length === 0 ? (
              <div className="p-8 text-center text-xs text-body-muted space-y-2">
                <GraduationCap className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-heading">No students match your search</p>
                <p className="text-[11px]">Try adjusting the search terms or clearing the filter.</p>
                {(searchQuery || filterTab !== "ALL") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setFilterTab("ALL");
                    }}
                    className="mt-1 text-xs text-[#3C096C] font-bold hover:underline cursor-pointer"
                  >
                    Reset Filter & Search
                  </button>
                )}
              </div>
            ) : (
              filteredStudents.map((s) => {
                const isSelected = s.id === selectedStudentId;
                const meta = studentMetaMap.get(s.id);
                const hasPending = (meta?.pendingCount || 0) > 0;
                const hasEnrolled = (meta?.enrolledCount || 0) > 0;

                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      onSelectStudent(s.id);
                      setIsOpen(false);
                    }}
                    className={`p-3 pl-3.5 pr-4 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer select-none ${
                      isSelected
                        ? "bg-purple-50/80 hover:bg-purple-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Avatar */}
                      <span
                        className={`w-8 h-8 rounded-xl text-xs font-bold flex items-center justify-center shrink-0 border transition-all ${
                          isSelected
                            ? "bg-[#3C096C] text-white border-[#3C096C] shadow-2xs"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {(s.name || "S")[0].toUpperCase()}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-bold text-heading truncate leading-tight">
                            {s.name}
                          </p>
                          <span className="text-[10px] font-mono font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/60">
                            {s.customId || `S${s.id.slice(-4).toUpperCase()}`}
                          </span>
                        </div>

                        <p className="text-[11px] text-body-muted truncate mt-0.5">
                          {s.email} {s.phone ? `· ${s.phone}` : ""}
                        </p>
                      </div>
                    </div>

                    {/* Right status badge + Check */}
                    <div className="flex items-center gap-2 shrink-0">
                      {hasPending ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-amber-600" />
                          <span>{meta?.pendingCount} Request</span>
                        </span>
                      ) : hasEnrolled ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {meta?.enrolledCount} Active
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
                          Lead
                        </span>
                      )}

                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-[#3C096C] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer count summary */}
          <div className="p-2.5 bg-neutral-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-body-muted px-4">
            <span>
              Showing {filteredStudents.length} of {students.length} students
            </span>
            <span className="text-[10px] font-medium text-slate-500">
              Press Esc to close
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. SEARCHABLE FACULTY MENTOR SELECTOR (Scalable for 700+ Faculty Teachers)
// ═══════════════════════════════════════════════════════════════════════════

interface SearchableFacultySelectorProps {
  teachers: FacultyOption[];
  selectedTeacherId: string;
  onSelectTeacher: (teacherId: string) => void;
  targetInstrument?: string;
  label?: string;
  compact?: boolean;
}

export function SearchableFacultySelector({
  teachers,
  selectedTeacherId,
  onSelectTeacher,
  targetInstrument,
  label = "Assign Faculty Mentor",
  compact = false,
}: SearchableFacultySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "MATCHING">(() => {
    return targetInstrument ? "MATCHING" : "ALL";
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
      if (targetInstrument) {
        setFilterMode("MATCHING");
      }
    }
  }, [isOpen, targetInstrument]);

  // Teachers matching course instrument
  const matchingTeachersCount = useMemo(() => {
    if (!targetInstrument) return 0;
    const norm = targetInstrument.toLowerCase();
    return teachers.filter((t) =>
      t.instruments.some((inst) => inst.toLowerCase().includes(norm) || norm.includes(inst.toLowerCase()))
    ).length;
  }, [teachers, targetInstrument]);

  // Filtered teachers list with high efficiency (sliced for max UI performance)
  const filteredTeachers = useMemo(() => {
    let result = teachers;

    // Filter by matching instrument tab
    if (filterMode === "MATCHING" && targetInstrument) {
      const norm = targetInstrument.toLowerCase();
      result = result.filter((t) =>
        t.instruments.some((inst) => inst.toLowerCase().includes(norm) || norm.includes(inst.toLowerCase()))
      );
    }

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.instruments.some((inst) => inst.toLowerCase().includes(q))
      );
    }

    return result;
  }, [teachers, filterMode, targetInstrument, searchQuery]);

  const selectedTeacher = useMemo(() => {
    return teachers.find((t) => t.id === selectedTeacherId) || teachers[0] || null;
  }, [teachers, selectedTeacherId]);

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="text-[11px] font-semibold text-heading block mb-1">
          {label}
        </label>
      )}

      {/* ── SELECTOR TRIGGER BUTTON ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 shadow-2xs ${
          isOpen
            ? "border-[#3C096C] ring-2 ring-[#3C096C]/15 bg-white"
            : "border-neutral-300 hover:border-purple-300 bg-white"
        } ${compact ? "px-3 py-2 text-xs" : "px-3.5 py-2.5 text-xs"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-6 h-6 rounded-full bg-gradient-to-br from-[#3C096C] to-[#7B2CBF] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {(selectedTeacher?.name || "T")[0].toUpperCase()}
          </span>

          <div className="min-w-0">
            <div className="font-bold text-heading truncate leading-tight flex items-center gap-1.5">
              <span className="truncate">{selectedTeacher?.name || "Select Mentor"}</span>
              {selectedTeacher?.instruments[0] && (
                <span className="px-1.5 py-0.2 rounded bg-purple-50 text-[#3C096C] text-[10px] font-semibold hidden xs:inline border border-purple-200/60">
                  {selectedTeacher.instruments[0]}
                </span>
              )}
            </div>
            <div className="text-[10px] text-body-muted truncate mt-0.5 font-numeric">
              ₹{selectedTeacher?.payoutRupees || 800}/cls
              {selectedTeacher?.instruments.length && selectedTeacher.instruments.length > 1 ? (
                <span className="hidden sm:inline"> · {selectedTeacher.instruments.slice(1).join(", ")}</span>
              ) : null}
            </div>
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-body-muted transition-transform shrink-0 ${
            isOpen ? "rotate-180 text-[#3C096C]" : ""
          }`}
        />
      </button>

      {/* ── SEARCH & FACULTY LIST DROPDOWN ── */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[280px]">
          {/* Search Header */}
          <div className="p-2.5 bg-neutral-50/80 border-b border-slate-100 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${teachers.length} faculty by name or instrument...`}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-heading placeholder:text-gray-400 focus:outline-none focus:border-[#3C096C] focus:ring-2 focus:ring-[#3C096C]/15 shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Smart Instrument Filter Pills */}
            {targetInstrument && matchingTeachersCount > 0 && (
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => setFilterMode("MATCHING")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    filterMode === "MATCHING"
                      ? "bg-[#3C096C] text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  <span>★ Gurus for {targetInstrument}</span>
                  <span className="opacity-80">({matchingTeachersCount})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterMode("ALL")}
                  className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterMode === "ALL"
                      ? "bg-[#3C096C] text-white shadow-2xs"
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
                  }`}
                >
                  All Faculty ({teachers.length})
                </button>
              </div>
            )}
          </div>

          {/* List of Teachers (Fast rendered) */}
          <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100 pr-1">
            {filteredTeachers.length === 0 ? (
              <div className="p-6 text-center text-xs text-body-muted space-y-1.5">
                <Music className="w-6 h-6 text-slate-300 mx-auto" />
                <p className="font-semibold text-heading">No instructors found</p>
                <p className="text-[11px]">No faculty match &quot;{searchQuery}&quot;</p>
                {filterMode === "MATCHING" && (
                  <button
                    type="button"
                    onClick={() => setFilterMode("ALL")}
                    className="mt-1 text-xs text-[#3C096C] font-bold hover:underline cursor-pointer"
                  >
                    View All {teachers.length} Faculty
                  </button>
                )}
              </div>
            ) : (
              filteredTeachers.slice(0, 45).map((teacher) => {
                const isSelected = teacher.id === selectedTeacherId;
                const matchesCourse =
                  targetInstrument &&
                  teacher.instruments.some((i) =>
                    i.toLowerCase().includes(targetInstrument.toLowerCase())
                  );

                return (
                  <div
                    key={teacher.id}
                    onClick={() => {
                      onSelectTeacher(teacher.id);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 pl-3 pr-3 flex items-center justify-between gap-2.5 text-xs transition-colors cursor-pointer select-none ${
                      isSelected
                        ? "bg-purple-50/80 hover:bg-purple-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? "bg-[#3C096C] text-white border-[#3C096C]"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {(teacher.name || "T")[0].toUpperCase()}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-bold text-heading truncate leading-tight">
                            {teacher.name}
                          </p>
                          {matchesCourse && (
                            <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/60">
                              ★ Matches Course
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-body-muted truncate mt-0.5">
                          {teacher.instruments.length > 0
                            ? teacher.instruments.join(" · ")
                            : teacher.email}
                        </p>
                      </div>
                    </div>

                    {/* Rate & Check */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-numeric font-bold text-heading bg-neutral-100 px-2 py-0.5 rounded-md">
                        ₹{teacher.payoutRupees}/cls
                      </span>

                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-[#3C096C] text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-2 bg-neutral-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-body-muted px-3">
            <span>
              Showing {Math.min(filteredTeachers.length, 45)} of {filteredTeachers.length} teachers
            </span>
            <span className="text-slate-400">Esc to close</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. SEARCHABLE COURSE SELECTOR (For Manual Allotment)
// ═══════════════════════════════════════════════════════════════════════════

interface SearchableCourseSelectorProps {
  courses: CourseCatalogOption[];
  selectedCourseId: string;
  onSelectCourse: (courseId: string) => void;
  label?: string;
}

export function SearchableCourseSelector({
  courses,
  selectedCourseId,
  onSelectCourse,
  label = "Select Course from Catalog *",
}: SearchableCourseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery("");
    }
  }, [isOpen]);

  const filteredCourses = useMemo(() => {
    if (!searchQuery.trim()) return courses;
    const q = searchQuery.toLowerCase().trim();
    return courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.instrument.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q)
    );
  }, [courses, searchQuery]);

  const selectedCourse = useMemo(() => {
    return courses.find((c) => c.id === selectedCourseId) || courses[0] || null;
  }, [courses, selectedCourseId]);

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="text-[11px] font-semibold text-heading block mb-1">
          {label}
        </label>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full text-left rounded-xl border px-3.5 py-2.5 transition-all cursor-pointer flex items-center justify-between gap-2.5 shadow-2xs ${
          isOpen
            ? "border-[#3C096C] ring-2 ring-[#3C096C]/15 bg-white"
            : "border-neutral-300 hover:border-purple-300 bg-white"
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-lg bg-purple-50 text-[#3C096C] flex items-center justify-center shrink-0">
            <BookOpen className="w-3.5 h-3.5" />
          </div>

          <div className="min-w-0">
            <div className="font-bold text-xs text-heading truncate">
              {selectedCourse?.title || "Choose a Course"}
            </div>
            <div className="text-[10px] text-body-muted truncate mt-0.5 font-numeric">
              {selectedCourse?.level} · {selectedCourse?.sessionCount} sessions · ₹
              {Math.round((selectedCourse?.priceMinorUnits || 0) / 100).toLocaleString("en-IN")}
            </div>
          </div>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-body-muted transition-transform shrink-0 ${
            isOpen ? "rotate-180 text-[#3C096C]" : ""
          }`}
        />
      </button>

      {/* Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl bg-white border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2.5 bg-neutral-50 border-b border-slate-100">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses by title, instrument, or level..."
                className="w-full pl-8 pr-7 py-1.5 rounded-xl border border-slate-200 bg-white text-xs text-heading placeholder:text-gray-400 focus:outline-none focus:border-[#3C096C] focus:ring-2 focus:ring-[#3C096C]/15 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto custom-scrollbar divide-y divide-slate-100 pr-1">
            {filteredCourses.length === 0 ? (
              <div className="p-6 text-center text-xs text-body-muted">
                No courses match your query.
              </div>
            ) : (
              filteredCourses.map((c) => {
                const isSelected = c.id === selectedCourseId;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      onSelectCourse(c.id);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 pl-3 pr-3 flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer select-none ${
                      isSelected
                        ? "bg-purple-50/80 hover:bg-purple-50"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-heading truncate">{c.title}</p>
                      <p className="text-[10px] text-body-muted truncate mt-0.5">
                        {c.instrument} · {c.level} · {c.sessionCount} sessions
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[11px] font-bold text-purple-900 bg-purple-50 px-2 py-0.5 rounded-md font-numeric">
                        ₹{Math.round(c.priceMinorUnits / 100).toLocaleString("en-IN")}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-[#3C096C] text-white flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
