"use client";

import { DateTimePicker } from "@/components/ui/DateTimePicker";
import { formatToIST, toISTInputString, fromISTInputToUtc } from "@/lib/timezone";

import { useState, useTransition, useMemo, useRef } from "react";
import { Discipline, CourseLevel } from "@prisma/client";
import {
  saveCourseAdminAction,
  deleteCourseAdminAction,
  toggleCoursePublishAdminAction,
  saveCourseLessonAdminAction,
  deleteCourseLessonAdminAction,
  bulkGenerateCourseLessonsAdminAction,
  uploadCourseStructurePdfAction,
} from "@/actions/admin";
import {
  BookOpen,
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Award,
  Calendar,
  Users,
  Clock,
  Check,
  Sparkles,
  ArrowRight,
  GraduationCap,
    UserCheck,
  RotateCcw,
  Music,
  CreditCard,
  Mic,
  Globe,
  Eye,
  EyeOff,
  Percent,
  Tag,
  FileText,
  Upload,
  Download,
  ExternalLink,
} from "lucide-react";

export interface AdminCourseLessonItem {
  id: string;
  lessonNumber: number;
  title: string;
  description: string | null;
  durationMinutes: number;
  scheduledStartsAt: string | null;
  teacherId: string | null;
  teacherName: string | null;
}

export interface AdminCourseItem {
  id: string;
  title: string;
  slug: string;
  discipline: Discipline;
  instrument: string;
  level: CourseLevel;
  accreditation: string | null;
  description: string;
  syllabusSummary: string;
  priceMinorUnits: number;
  emiPrice3MinorUnits?: number | null;
  emiPrice6MinorUnits?: number | null;
  allowEmi?: boolean;
  sessionCount: number;
  durationWeeks: number;
  structurePdfUrl?: string | null;
  startDate: string | null;
  endDate: string | null;
  isPublished: boolean;
  enrollmentsCount: number;
  lessonsCount: number;
  allottedTeachers: Array<{
    id: string;
    name: string | null;
    email: string;
    instruments: string[];
  }>;
  lessons: AdminCourseLessonItem[];
}

export interface FacultyTeacherItem {
  id: string;
  name: string | null;
  email: string;
  instruments: string[];
}

export interface CoursePricingRates {
  INR: number;
  SA_UAE: number;
  USD: number;
  CAD: number;
  GBP: number;
  EUR: number;
  SGD: number;
}

export interface CoursePricingMetadata {
  discountPercent: number;
  rates: CoursePricingRates;
}

export function parseCoursePricing(
  description: string,
  fallbackMinorUnits: number,
  sessionCount: number,
  level: CourseLevel
): CoursePricingMetadata {
  const match = description?.match(/<!--\s*pricing:\s*([\s\S]*?)\s*-->/);
  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed.rates) {
        return {
          discountPercent: typeof parsed.discountPercent === "number" ? parsed.discountPercent : 0,
          rates: {
            INR: Number(parsed.rates.INR) || 800,
            SA_UAE: Number(parsed.rates.SA_UAE) || Number(parsed.rates.INR) || 800,
            USD: Number(parsed.rates.USD) || 16,
            CAD: Number(parsed.rates.CAD) || 22,
            GBP: Number(parsed.rates.GBP) || 12,
            EUR: Number(parsed.rates.EUR) || 15,
            SGD: Number(parsed.rates.SGD) || 21,
          },
        };
      }
    } catch {}
  }

  const approxINR = sessionCount > 0 ? Math.round(fallbackMinorUnits / 100 / sessionCount) : Math.round(fallbackMinorUnits / 100);
  const lvl = String(level).toUpperCase();
  if (lvl === "ADVANCED") {
    return {
      discountPercent: 0,
      rates: {
        INR: approxINR > 0 ? approxINR : 1250,
        SA_UAE: approxINR > 0 ? approxINR : 1250,
        USD: 28,
        CAD: 38,
        GBP: 21,
        EUR: 26,
        SGD: 37,
      },
    };
  } else if (lvl === "INTERMEDIATE") {
    return {
      discountPercent: 0,
      rates: {
        INR: approxINR > 0 ? approxINR : 1000,
        SA_UAE: approxINR > 0 ? approxINR : 1000,
        USD: 21,
        CAD: 28,
        GBP: 16,
        EUR: 19,
        SGD: 28,
      },
    };
  } else {
    return {
      discountPercent: 0,
      rates: {
        INR: approxINR > 0 ? approxINR : 800,
        SA_UAE: approxINR > 0 ? approxINR : 800,
        USD: 16,
        CAD: 22,
        GBP: 12,
        EUR: 15,
        SGD: 21,
      },
    };
  }
}

export function cleanCourseDescription(description: string): string {
  if (!description) return "";
  return description.replace(/\s*<!--\s*pricing:[\s\S]*?-->/g, "").trim();
}

export function AdminCoursesManager({
  initialCourses,
  facultyTeachers,
}: {
  initialCourses: AdminCourseItem[];
  facultyTeachers: FacultyTeacherItem[];
}) {
  const [courses, setCourses] = useState<AdminCourseItem[]>(initialCourses);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | null>(null);

  // Filter tab: ALL, INSTRUMENTS, or SINGING
  const [disciplineTab, setDisciplineTab] = useState<"ALL" | "INSTRUMENTS" | "SINGING">("ALL");
  const [levelFilter, setLevelFilter] = useState<"ALL" | CourseLevel>("ALL");
  const [publicationFilter, setPublicationFilter] = useState<"ALL" | "PUBLISHED" | "DRAFT">("ALL");
  const [togglingCourseId, setTogglingCourseId] = useState<string | null>(null);

  // Curriculum Management Drawer/Modal State
  const [curriculumCourse, setCurriculumCourse] = useState<AdminCourseItem | null>(null);

  // Course Form State
  const [courseId, setCourseId] = useState<string | undefined>(undefined);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [discipline, setDiscipline] = useState<Discipline>(Discipline.INSTRUMENT);
  const [instrument, setInstrument] = useState("");
  const [level, setLevel] = useState<CourseLevel>(CourseLevel.BEGINNER);
  const [accreditation, setAccreditation] = useState("");
  const [priceRupees, setPriceRupees] = useState<number>(14999);
  const [perSessionCost, setPerSessionCost] = useState<number>(Math.round(14999 / 24));
  const [sessionCount, setSessionCount] = useState<number>(24);
  const [durationWeeks, setDurationWeeks] = useState<number>(12);
  // Countrywise Pricing State
  const [sessionRateINR, setSessionRateINR] = useState<number>(800);
  const [sessionRateSaudiUAE, setSessionRateSaudiUAE] = useState<number>(800);
  const [sessionRateUSD, setSessionRateUSD] = useState<number>(16);
  const [sessionRateCAD, setSessionRateCAD] = useState<number>(22);
  const [sessionRateGBP, setSessionRateGBP] = useState<number>(12);
  const [sessionRateEUR, setSessionRateEUR] = useState<number>(15);
  const [sessionRateSGD, setSessionRateSGD] = useState<number>(21);
  const [discountPercent, setDiscountPercent] = useState<number | "">("");

  const calculateTierTotal = (perSessionRate: number) => {
    const base = Math.max(0, perSessionRate * (sessionCount || 1));
    const discounted = Math.max(0, Math.round(base * (1 - (Number(discountPercent) || 0) / 100)));
    return { base, discounted };
  };

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<string[]>([]);
  const [teacherSearchQuery, setTeacherSearchQuery] = useState("");
  const [teacherFilterCategory, setTeacherFilterCategory] = useState<"ALL" | "MATCHING_INSTRUMENT">("ALL");
  const [description, setDescription] = useState("");
  const [syllabusSummary, setSyllabusSummary] = useState("");
  const [isPublished, setIsPublished] = useState(true);

  // Course Structure PDF State
  const [structurePdfUrl, setStructurePdfUrl] = useState<string>("");
  const [structurePdfName, setStructurePdfName] = useState<string>("");
  const [isUploadingPdf, setIsUploadingPdf] = useState<boolean>(false);
  const [pdfUploadError, setPdfUploadError] = useState<string | null>(null);
  const [pdfSuccessMsg, setPdfSuccessMsg] = useState<string | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setPdfUploadError("Only PDF files (.pdf) are allowed.");
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setPdfUploadError("PDF file size cannot exceed 25MB.");
      if (pdfInputRef.current) pdfInputRef.current.value = "";
      return;
    }

    setPdfUploadError(null);
    setPdfSuccessMsg(null);
    setIsUploadingPdf(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      let uploadSuccess = false;
      let uploadResult: { url: string; fileName: string } | null = null;
      let uploadErrMsg: string | null = null;

      // 1. Direct API endpoint upload (handles up to 25MB without Server Action body limits)
      try {
        const response = await fetch("/api/courses/structure-pdf", {
          method: "POST",
          body: formData,
        });

        const json = await response.json().catch(() => null);

        if (response.ok && json?.success && json?.data) {
          uploadSuccess = true;
          uploadResult = json.data;
        } else if (json?.error) {
          uploadErrMsg = json.error;
        }
      } catch (fetchErr: any) {
        uploadErrMsg = fetchErr?.message || null;
      }

      // 2. Fallback to Server Action if direct API wasn't reached
      if (!uploadSuccess) {
        try {
          const res = await uploadCourseStructurePdfAction(formData);
          if (res.success && res.data) {
            uploadSuccess = true;
            uploadResult = res.data;
          } else if (res.error) {
            uploadErrMsg = res.error;
          }
        } catch (actionErr: any) {
          if (!uploadErrMsg) {
            uploadErrMsg = actionErr?.message || null;
          }
        }
      }

      if (uploadSuccess && uploadResult) {
        setStructurePdfUrl(uploadResult.url);
        setStructurePdfName(uploadResult.fileName || file.name);
        setPdfSuccessMsg("Course structure PDF uploaded successfully!");
        setTimeout(() => setPdfSuccessMsg(null), 3000);
      } else {
        setPdfUploadError(uploadErrMsg || "Failed to upload course structure PDF.");
      }
    } catch (err: any) {
      setPdfUploadError(
        err?.message || (typeof err === "string" ? err : "An unexpected error occurred while uploading the PDF.")
      );
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  };

  const handleRemovePdf = () => {
    setStructurePdfUrl("");
    setStructurePdfName("");
    setPdfUploadError(null);
    setPdfSuccessMsg(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  };

  // Lesson Edit State inside Curriculum Drawer
  const [editingLessonId, setEditingLessonId] = useState<string | "NEW" | null>(null);
  const [lessonNumber, setLessonNumber] = useState<number>(1);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonDescription, setLessonDescription] = useState("");
  const [lessonDuration, setLessonDuration] = useState<number>(60);
  const [lessonStartsAt, setLessonStartsAt] = useState<string>("");
  const [lessonTeacherId, setLessonTeacherId] = useState<string>("");

  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);
  const [lessonSuccessMsg, setLessonSuccessMsg] = useState<string | null>(null);

  // Fast filter for 700+ faculty teachers in create/edit modal
  const filteredTeachersForModal = useMemo(() => {
    const q = teacherSearchQuery.trim().toLowerCase();
    const currentInst = instrument.trim().toLowerCase();

    return facultyTeachers.filter((t) => {
      if (teacherFilterCategory === "MATCHING_INSTRUMENT" && currentInst) {
        const teachesInstrument = t.instruments.some((i) =>
          i.toLowerCase().includes(currentInst) || currentInst.includes(i.toLowerCase())
        );
        if (!teachesInstrument) return false;
      }

      if (!q) return true;

      const matchesName = t.name?.toLowerCase().includes(q);
      const matchesEmail = t.email.toLowerCase().includes(q);
      const matchesInst = t.instruments.some((i) => i.toLowerCase().includes(q));

      return matchesName || matchesEmail || matchesInst;
    });
  }, [facultyTeachers, teacherSearchQuery, teacherFilterCategory, instrument]);

  const handlePriceChange = (val: number) => {
    setPriceRupees(val);
    if (sessionCount > 0) {
      setPerSessionCost(Math.round(val / sessionCount));
    }
  };

  const handlePerSessionChange = (val: number) => {
    setPerSessionCost(val);
    setPriceRupees(val * (sessionCount || 1));
  };

  const openCreateModal = (
    defaultDiscipline?: Discipline,
    defaultInstrument?: string,
    defaultTitle?: string
  ) => {
    setModalMode("CREATE");
    setCourseId(undefined);
    setTitle(defaultTitle || "");
    setSlug(
      defaultTitle
        ? defaultTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)+/g, "")
        : ""
    );
    setDiscipline(defaultDiscipline || Discipline.INSTRUMENT);
    setInstrument(defaultInstrument || "");
    setLevel(CourseLevel.BEGINNER);
    setAccreditation("");
    setSessionCount(24);
    setSessionRateINR(800);
    setSessionRateSaudiUAE(800);
    setSessionRateUSD(16);
    setSessionRateCAD(22);
    setSessionRateGBP(12);
    setSessionRateEUR(15);
    setSessionRateSGD(21);
    setDiscountPercent("");
    setPriceRupees(19200);
    setPerSessionCost(800);
    setDurationWeeks(12);
    setStartDate("");
    setEndDate("");
    setSelectedTeacherIds([]);
    setTeacherSearchQuery("");
    setTeacherFilterCategory("ALL");
    setDescription(
      defaultInstrument
        ? `Comprehensive 1-to-1 ${defaultInstrument} curriculum focusing on foundational technique, notation, performance repertoire, and certification readiness.`
        : ""
    );
    setSyllabusSummary(
      defaultInstrument
        ? `Module 1: Foundations & Fingering/Posture · Module 2: Applied Repertoire & Ear Training · Module 3: Advanced Articulation & Concert Solo`
        : ""
    );
    setIsPublished(true);
    setStructurePdfUrl("");
    setStructurePdfName("");
    setPdfUploadError(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    setFormError(null);
    setFormSuccess(false);
  };

  const openEditModal = (c: AdminCourseItem) => {
    setModalMode("EDIT");
    setCourseId(c.id);
    setTitle(c.title);
    setSlug(c.slug);
    setDiscipline(c.discipline);
    setInstrument(c.instrument);
    setLevel(c.level);
    setAccreditation(c.accreditation || "");
    setStructurePdfUrl(c.structurePdfUrl || "");
    setStructurePdfName(
      c.structurePdfUrl
        ? decodeURIComponent(c.structurePdfUrl.split("/").pop() || "").replace(/^\d+_/, "") || "course-structure.pdf"
        : ""
    );
    setPdfUploadError(null);
    if (pdfInputRef.current) pdfInputRef.current.value = "";
    const pricing = parseCoursePricing(c.description, c.priceMinorUnits, c.sessionCount, c.level);
    setSessionRateINR(pricing.rates.INR);
    setSessionRateSaudiUAE(pricing.rates.SA_UAE);
    setSessionRateUSD(pricing.rates.USD);
    setSessionRateCAD(pricing.rates.CAD);
    setSessionRateGBP(pricing.rates.GBP);
    setSessionRateEUR(pricing.rates.EUR);
    setSessionRateSGD(pricing.rates.SGD);
    setDiscountPercent(pricing.discountPercent > 0 ? pricing.discountPercent : "");

    const baseINRTotal = pricing.rates.INR * (c.sessionCount || 1);
    const finalINRTotal = Math.round(baseINRTotal * (1 - pricing.discountPercent / 100));
    setPriceRupees(finalINRTotal);
    setPerSessionCost(pricing.rates.INR);
    setSessionCount(c.sessionCount);
    setDurationWeeks(c.durationWeeks);
    setStartDate(c.startDate ? c.startDate.slice(0, 10) : "");
    setEndDate(c.endDate ? c.endDate.slice(0, 10) : "");
    setSelectedTeacherIds(c.allottedTeachers.map((t) => t.id));
    setTeacherSearchQuery("");
    setTeacherFilterCategory("ALL");
    setDescription(cleanCourseDescription(c.description));
    setSyllabusSummary(c.syllabusSummary);
    setIsPublished(c.isPublished);
    setFormError(null);
    setFormSuccess(false);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (modalMode === "CREATE") {
      setSlug(
        val
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)+/g, ""),
      );
    }
  };

  const toggleTeacherSelection = (teacherId: string) => {
    setSelectedTeacherIds((prev) =>
      prev.includes(teacherId)
        ? prev.filter((id) => id !== teacherId)
        : [...prev, teacherId],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);

    

    const totalINRBeforeDiscount = sessionRateINR * (sessionCount || 1);
    const finalTotalINR = Math.max(0, Math.round(totalINRBeforeDiscount * (1 - (Number(discountPercent) || 0) / 100)));
    const calculatedPriceMinorUnits = finalTotalINR * 100;

    const pricingPayload: CoursePricingMetadata = {
      discountPercent: Number(discountPercent) || 0,
      rates: {
        INR: sessionRateINR,
        SA_UAE: sessionRateSaudiUAE,
        USD: sessionRateUSD,
        CAD: sessionRateCAD,
        GBP: sessionRateGBP,
        EUR: sessionRateEUR,
        SGD: sessionRateSGD,
      },
    };
    const serializedPricing = "<!-- pricing: " + JSON.stringify(pricingPayload) + " -->";
    const cleanDesc = cleanCourseDescription(description);
    const finalDescription = cleanDesc ? (cleanDesc + "\n\n" + serializedPricing) : serializedPricing;

    startTransition(async () => {
      const res = await saveCourseAdminAction({
        id: courseId,
        title,
        slug,
        discipline,
        instrument,
        level,
        accreditation: accreditation.trim() ? accreditation.trim() : null,
        description: finalDescription,
        syllabusSummary,
        priceMinorUnits: calculatedPriceMinorUnits,
        emiPrice3MinorUnits: null,
        emiPrice6MinorUnits: null,
        allowEmi: false,
        sessionCount,
        durationWeeks,
        structurePdfUrl: structurePdfUrl.trim() || null,
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        teacherIds: selectedTeacherIds,
        isPublished,
      });

      if (!res.success) {
        setFormError(res.error || "Failed to save course.");
      } else {
        setFormSuccess(true);
        const savedId = (res.data as { id?: string })?.id || courseId || "temp-" + Date.now();
        const savedTeachers = facultyTeachers.filter((t) => selectedTeacherIds.includes(t.id));

        if (modalMode === "CREATE") {
          const newCourse: AdminCourseItem = {
            id: savedId,
            title,
            slug,
            discipline,
            instrument,
            level,
            accreditation: accreditation.trim() || null,
            description: finalDescription,
            syllabusSummary,
            priceMinorUnits: calculatedPriceMinorUnits,
            emiPrice3MinorUnits: null,
            emiPrice6MinorUnits: null,
            allowEmi: false,
            sessionCount,
            durationWeeks,
            structurePdfUrl: structurePdfUrl.trim() || null,
            startDate: startDate ? new Date(startDate).toISOString() : null,
            endDate: endDate ? new Date(endDate).toISOString() : null,
            isPublished,
            enrollmentsCount: 0,
            lessonsCount: 0,
            allottedTeachers: savedTeachers,
            lessons: [],
          };
          setCourses((prev) => [newCourse, ...prev]);
        } else if (modalMode === "EDIT") {
          setCourses((prev) =>
            prev.map((item) =>
              item.id === courseId
                ? {
                    ...item,
                    title,
                    slug,
                    discipline,
                    instrument,
                    level,
                    accreditation: accreditation.trim() || null,
                    description: finalDescription,
                    syllabusSummary,
                    priceMinorUnits: calculatedPriceMinorUnits,
                    emiPrice3MinorUnits: null,
                    emiPrice6MinorUnits: null,
                    allowEmi: false,
                    sessionCount,
                    durationWeeks,
                    structurePdfUrl: structurePdfUrl.trim() || null,
                    startDate: startDate ? new Date(startDate).toISOString() : null,
                    endDate: endDate ? new Date(endDate).toISOString() : null,
                    isPublished,
                    allottedTeachers: savedTeachers,
                  }
                : item,
            ),
          );
        }
        setTimeout(() => {
          setModalMode(null);
          setFormSuccess(false);
        }, 1000);
      }
    });
  };

  const handleDelete = (c: AdminCourseItem) => {
    let force = false;
    if (c.enrollmentsCount > 0) {
      const confirmed = confirm(
        `Warning: Course "${c.title}" currently has ${c.enrollmentsCount} active student enrollment(s).\n\nDeleting this course will permanently remove the course and its enrollment records.\n\nDo you want to proceed and permanently delete this course?`
      );
      if (!confirmed) return;
      force = true;
    } else {
      if (!confirm(`Are you sure you want to delete course "${c.title}"?`)) return;
    }

    startTransition(async () => {
      const res = await deleteCourseAdminAction(c.id, { force });
      if (!res.success) {
        alert(res.error || "Failed to delete course.");
      } else {
        setCourses((prev) => prev.filter((item) => item.id !== c.id));
        if (curriculumCourse?.id === c.id) {
          setCurriculumCourse(null);
        }
      }
    });
  };

  const handleTogglePublish = async (c: AdminCourseItem) => {
    if (togglingCourseId) return;
    const nextPublishedState = !c.isPublished;
    setTogglingCourseId(c.id);

    // Optimistically update local state immediately
    setCourses((prev) =>
      prev.map((item) =>
        item.id === c.id ? { ...item, isPublished: nextPublishedState } : item
      )
    );

    try {
      const res = await toggleCoursePublishAdminAction({
        courseId: c.id,
        isPublished: nextPublishedState,
      });

      if (!res.success) {
        // Revert on failure
        setCourses((prev) =>
          prev.map((item) =>
            item.id === c.id ? { ...item, isPublished: c.isPublished } : item
          )
        );
        alert(res.error || "Failed to update course publication status.");
      }
    } catch {
      // Revert on network exception
      setCourses((prev) =>
        prev.map((item) =>
          item.id === c.id ? { ...item, isPublished: c.isPublished } : item
        )
      );
      alert("Network error updating course publication status.");
    } finally {
      setTogglingCourseId(null);
    }
  };

  // ── Curriculum & Lesson Actions ───────────────────────────────────────────

  const openCurriculumDrawer = (course: AdminCourseItem) => {
    setCurriculumCourse(course);
    setEditingLessonId(null);
    setLessonSuccessMsg(null);
  };

  const startAddLesson = () => {
    if (!curriculumCourse) return;
    setEditingLessonId("NEW");
    setLessonNumber(curriculumCourse.lessons.length + 1);
    setLessonTitle(`Lesson ${curriculumCourse.lessons.length + 1}: Core Technique & Analysis`);
    setLessonDescription("Focused instruction, technical drills, and active repertoire review.");
    setLessonDuration(60);
    const lastLesson = curriculumCourse.lessons[curriculumCourse.lessons.length - 1];
    let initialDate = new Date();
    if (lastLesson?.scheduledStartsAt) {
      initialDate = new Date(new Date(lastLesson.scheduledStartsAt).getTime() + 7 * 86400000);
    } else if (curriculumCourse.startDate) {
      initialDate = new Date(curriculumCourse.startDate);
    } else {
      initialDate.setDate(initialDate.getDate() + 3);
    }
    initialDate.setHours(10, 0, 0, 0);
    setLessonStartsAt(toISTInputString(initialDate));
    setLessonTeacherId(curriculumCourse.allottedTeachers[0]?.id || facultyTeachers[0]?.id || "");
  };

  const startEditLesson = (lesson: AdminCourseLessonItem) => {
    setEditingLessonId(lesson.id);
    setLessonNumber(lesson.lessonNumber);
    setLessonTitle(lesson.title);
    setLessonDescription(lesson.description || "");
    setLessonDuration(lesson.durationMinutes);
    setLessonStartsAt(
      lesson.scheduledStartsAt
        ? toISTInputString(lesson.scheduledStartsAt)
        : "",
    );
    setLessonTeacherId(lesson.teacherId || "");
  };

  const handleSaveLesson = () => {
    if (!curriculumCourse) return;

    startTransition(async () => {
      const res = await saveCourseLessonAdminAction({
        id: editingLessonId === "NEW" ? undefined : editingLessonId || undefined,
        courseId: curriculumCourse.id,
        lessonNumber,
        title: lessonTitle,
        description: lessonDescription,
        durationMinutes: lessonDuration,
        scheduledStartsAt: lessonStartsAt ? fromISTInputToUtc(lessonStartsAt).toISOString() : null,
        teacherId: lessonTeacherId || null,
      });

      if (!res.success) {
        alert(res.error || "Failed to save lesson.");
      } else {
        const savedId = (res.data as { id?: string })?.id || "temp-" + Date.now();
        const teacherName =
          facultyTeachers.find((t) => t.id === lessonTeacherId)?.name || null;

        const updatedLessons = [...curriculumCourse.lessons];
        const existingIdx = updatedLessons.findIndex(
          (l) => l.id === (editingLessonId === "NEW" ? "" : editingLessonId),
        );

        const newLessonItem: AdminCourseLessonItem = {
          id: savedId,
          lessonNumber,
          title: lessonTitle,
          description: lessonDescription || null,
          durationMinutes: lessonDuration,
          scheduledStartsAt: lessonStartsAt ? fromISTInputToUtc(lessonStartsAt).toISOString() : null,
          teacherId: lessonTeacherId || null,
          teacherName,
        };

        if (existingIdx >= 0) {
          updatedLessons[existingIdx] = newLessonItem;
        } else {
          updatedLessons.push(newLessonItem);
        }
        updatedLessons.sort((a, b) => a.lessonNumber - b.lessonNumber);

        const updatedCourse = {
          ...curriculumCourse,
          lessons: updatedLessons,
          lessonsCount: updatedLessons.length,
        };

        setCurriculumCourse(updatedCourse);
        setCourses((prev) =>
          prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)),
        );
        setEditingLessonId(null);
        setLessonSuccessMsg("Lesson schedule & faculty allotment updated!");
        setTimeout(() => setLessonSuccessMsg(null), 2500);
      }
    });
  };

  const handleDeleteLesson = (lessonId: string) => {
    if (!curriculumCourse) return;
    if (!confirm("Are you sure you want to remove this lesson from the curriculum?")) return;

    startTransition(async () => {
      const res = await deleteCourseLessonAdminAction({
        lessonId,
        courseId: curriculumCourse.id,
      });

      if (!res.success) {
        alert(res.error || "Failed to delete lesson.");
      } else {
        const updatedLessons = curriculumCourse.lessons.filter((l) => l.id !== lessonId);
        const updatedCourse = {
          ...curriculumCourse,
          lessons: updatedLessons,
          lessonsCount: updatedLessons.length,
        };
        setCurriculumCourse(updatedCourse);
        setCourses((prev) =>
          prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)),
        );
      }
    });
  };

  const handleBulkGenerateLessons = () => {
    if (!curriculumCourse) return;
    if (
      !confirm(
        `Auto-generate ${curriculumCourse.sessionCount} lessons spaced weekly starting from ${curriculumCourse.startDate ? new Date(curriculumCourse.startDate).toLocaleDateString() : "next week"}?`,
      )
    )
      return;

    startTransition(async () => {
      const defaultTeacher = curriculumCourse.allottedTeachers[0]?.id || facultyTeachers[0]?.id;
      const res = await bulkGenerateCourseLessonsAdminAction({
        courseId: curriculumCourse.id,
        defaultTeacherId: defaultTeacher,
        startDate: curriculumCourse.startDate,
        sessionCount: curriculumCourse.sessionCount,
        dayInterval: 7,
      });

      if (!res.success) {
        alert(res.error || "Failed to generate lessons.");
      } else {
        const total = curriculumCourse.sessionCount;
        const baseDate = curriculumCourse.startDate
          ? new Date(curriculumCourse.startDate)
          : new Date(Date.now() + 86400000 * 2);
        baseDate.setHours(10, 0, 0, 0);

        const newLessons: AdminCourseLessonItem[] = [];
        const teacherName =
          facultyTeachers.find((t) => t.id === defaultTeacher)?.name || null;

        for (let i = 1; i <= total; i++) {
          const lDate = new Date(baseDate.getTime() + (i - 1) * 7 * 86400000);
          newLessons.push({
            id: `gen-${i}-${Date.now()}`,
            lessonNumber: i,
            title: `Lesson ${i}: Masterclass & Applied Repertoire`,
            description: `Comprehensive 1-to-1 session covering fundamentals, technical repertoire, and personalized musical guidance.`,
            durationMinutes: 60,
            scheduledStartsAt: lDate.toISOString(),
            teacherId: defaultTeacher || null,
            teacherName,
          });
        }

        const updatedCourse = {
          ...curriculumCourse,
          lessons: newLessons,
          lessonsCount: newLessons.length,
        };
        setCurriculumCourse(updatedCourse);
        setCourses((prev) =>
          prev.map((c) => (c.id === updatedCourse.id ? updatedCourse : c)),
        );
        setLessonSuccessMsg("Curriculum lessons generated with faculty allotments!");
        setTimeout(() => setLessonSuccessMsg(null), 3000);
      }
    });
  };

  const filteredCourses = useMemo(() => {
    return courses.filter((c) => {
      if (disciplineTab === "INSTRUMENTS" && c.discipline !== Discipline.INSTRUMENT) {
        return false;
      }
      if (disciplineTab === "SINGING" && c.discipline !== Discipline.VOCALS) {
        return false;
      }

      if (levelFilter !== "ALL" && String(c.level).toUpperCase() !== levelFilter) {
        return false;
      }

      if (publicationFilter === "PUBLISHED" && !c.isPublished) {
        return false;
      }
      if (publicationFilter === "DRAFT" && c.isPublished) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesInstrument = c.instrument.toLowerCase().includes(q);
        const matchesGuru = c.allottedTeachers.some(
          (t) => (t.name && t.name.toLowerCase().includes(q)) || t.email.toLowerCase().includes(q)
        );
        if (!matchesTitle && !matchesInstrument && !matchesGuru) return false;
      }

      return true;
    });
  }, [courses, disciplineTab, levelFilter, publicationFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* ── COURSE CATALOG FILTER & ACTIONS BAR ── */}
      <div className="flex flex-col gap-3 p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs">
        {/* Top Controls Row: Discipline Filters, Search, Create Button */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Filter Pills: All, Instruments, Singing */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setDisciplineTab("ALL")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98] ${
                disciplineTab === "ALL"
                  ? "bg-[#3C096C] text-white shadow-xs"
                  : "text-gray-600 hover:text-black hover:bg-slate-100"
              }`}
            >
              <span>All</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  disciplineTab === "ALL" ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
                }`}
              >
                {courses.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDisciplineTab("INSTRUMENTS")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98] ${
                disciplineTab === "INSTRUMENTS"
                  ? "bg-[#3C096C] text-white shadow-xs"
                  : "text-gray-600 hover:text-black hover:bg-slate-100"
              }`}
            >
              <Music className="w-3.5 h-3.5" />
              <span>Instruments</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  disciplineTab === "INSTRUMENTS"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {courses.filter((c) => c.discipline === Discipline.INSTRUMENT).length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setDisciplineTab("SINGING")}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98] ${
                disciplineTab === "SINGING"
                  ? "bg-[#3C096C] text-white shadow-xs"
                  : "text-gray-600 hover:text-black hover:bg-slate-100"
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Singing</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                  disciplineTab === "SINGING"
                    ? "bg-white/20 text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {courses.filter((c) => c.discipline === Discipline.VOCALS).length}
              </span>
            </button>
          </div>

          {/* Right side: Search bar & Create Course button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
            <div className="relative flex-1 lg:w-64">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses by title or guru..."
                className="w-full pl-8 pr-7 py-2 text-xs rounded-xl bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 text-heading placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 sm:py-2 rounded-xl bg-[#3C096C] hover:bg-[#2D0752] text-white text-xs font-bold shadow-xs transition-all shrink-0 active:scale-[0.98] cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create Course Curriculum</span>
            </button>
          </div>
        </div>

        {/* Level Filters & Publication Status Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs">
          {/* Level Filters: All Levels, Foundation, Beginner, Intermediate, Advanced */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-body-muted shrink-0">
              Proficiency Level:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 sm:flex-wrap">
              {(["ALL", "FOUNDATION", "BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map((lvl) => {
                const count = lvl === "ALL"
                  ? courses.filter((c) => {
                      if (disciplineTab === "INSTRUMENTS" && c.discipline !== Discipline.INSTRUMENT) return false;
                      if (disciplineTab === "SINGING" && c.discipline !== Discipline.VOCALS) return false;
                      return true;
                    }).length
                  : courses.filter((c) => {
                      if (disciplineTab === "INSTRUMENTS" && c.discipline !== Discipline.INSTRUMENT) return false;
                      if (disciplineTab === "SINGING" && c.discipline !== Discipline.VOCALS) return false;
                      return String(c.level).toUpperCase() === lvl;
                    }).length;
                const label = lvl === "ALL" ? "All Levels" : lvl.charAt(0) + lvl.slice(1).toLowerCase();
                const isActive = levelFilter === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevelFilter(lvl as any)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98] ${
                      isActive
                        ? "bg-accent text-white shadow-xs"
                        : "text-body hover:text-heading hover:bg-bg-alt/50 border border-slate-200/80 bg-white"
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status Filters: All Statuses, Published, Draft */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-body-muted shrink-0">
              Catalog Status:
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 sm:flex-wrap">
              {(["ALL", "PUBLISHED", "DRAFT"] as const).map((st) => {
                const count = st === "ALL"
                  ? courses.length
                  : st === "PUBLISHED"
                  ? courses.filter((c) => c.isPublished).length
                  : courses.filter((c) => !c.isPublished).length;
                const label = st === "ALL" ? "All" : st === "PUBLISHED" ? "Published" : "Draft";
                const isActive = publicationFilter === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setPublicationFilter(st)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 active:scale-[0.98] ${
                      isActive
                        ? st === "PUBLISHED"
                          ? "bg-emerald-600 text-white shadow-xs"
                          : st === "DRAFT"
                          ? "bg-amber-600 text-white shadow-xs"
                          : "bg-[#3C096C] text-white shadow-xs"
                        : "text-body hover:text-heading hover:bg-bg-alt/50 border border-slate-200/80 bg-white"
                    }`}
                  >
                    {st === "PUBLISHED" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    )}
                    {st === "DRAFT" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
                    )}
                    <span>{label}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── COURSES LIST OR EMPTY STATE ── */}
      {filteredCourses.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border-default bg-white p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 mx-auto flex items-center justify-center">
            <BookOpen className="w-6 h-6" />
          </div>
          <h4 className="font-serif text-base font-bold text-heading">
            No courses found matching your criteria
          </h4>
          <p className="text-xs text-body-muted max-w-md mx-auto">
            {disciplineTab !== "ALL"
              ? `No ${disciplineTab === "INSTRUMENTS" ? "instrument" : "singing"} courses match "${searchQuery || 'current filters'}".`
              : "Try clearing your search query or reset filters."}
          </p>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setDisciplineTab("ALL");
                setLevelFilter("ALL");
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 transition-colors cursor-pointer active:scale-[0.98]"
            >
              Clear All Filters
            </button>
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#3C096C] text-white text-xs font-bold shadow-xs hover:bg-[#2D0752] transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Course</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredCourses.map((c) => {
            const formattedStartDate = c.startDate
              ? new Date(c.startDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;
            const formattedEndDate = c.endDate
              ? new Date(c.endDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })
              : null;

            return (
              <div
                key={c.id}
                className="rounded-3xl border border-border-default bg-white p-6 shadow-sm space-y-4 hover:border-primary/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Discipline, Level, Accreditation, Live Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-bg-alt/70 text-accent-dark border border-accent/20">
                        {c.discipline}
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                          String(c.level).toUpperCase() === "FOUNDATION"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : String(c.level).toUpperCase() === "BEGINNER"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : String(c.level).toUpperCase() === "INTERMEDIATE"
                            ? "bg-sky-50 text-sky-700 border-sky-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {c.level}
                      </span>
                      {c.accreditation && (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 max-w-[260px] sm:max-w-xs"
                          title={c.accreditation}
                        >
                          <Award className="w-3 h-3 text-amber-600 shrink-0" />
                          <span className="truncate">{c.accreditation}</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleTogglePublish(c)}
                      disabled={togglingCourseId === c.id}
                      title={
                        c.isPublished
                          ? "Click to unpublish course (hide from student catalog)"
                          : "Click to publish course (make live for students)"
                      }
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95 disabled:opacity-50 disabled:pointer-events-none ${
                        c.isPublished
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                          : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                      }`}
                    >
                      {togglingCourseId === c.id ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin text-current" />
                      ) : (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            c.isPublished ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                          }`}
                        />
                      )}
                      <span>{c.isPublished ? "Published" : "Draft"}</span>
                    </button>
                  </div>

                  {/* Course Title & Description */}
                  <div>
                    <h3 className="text-lg font-bold font-serif text-heading leading-snug">
                      {c.title}
                    </h3>
                    <p className="text-xs text-body mt-1 line-clamp-2 leading-relaxed">
                      {cleanCourseDescription(c.description)}
                    </p>
                  </div>

                  {/* Course Schedule Banner */}
                  <div className="p-2.5 rounded-xl bg-bg-alt/40 border border-border-default/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-heading">
                      <Calendar className="w-4 h-4 text-accent-dark shrink-0" />
                      {formattedStartDate && formattedEndDate ? (
                        <span>
                          <strong>{formattedStartDate}</strong> – <strong>{formattedEndDate}</strong>
                        </span>
                      ) : formattedStartDate ? (
                        <span>
                          Starts: <strong>{formattedStartDate}</strong>
                        </span>
                      ) : (
                        <span className="text-body-muted font-medium">
                          Flexible Schedule · {c.sessionCount} Sessions
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-medium text-body-muted">
                      {c.durationWeeks} Weeks
                    </span>
                  </div>

                  {/* Allotted Faculty Strip */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-heading flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-primary" />
                        <span>Allotted Faculty Teachers:</span>
                      </span>
                      <span className="text-body-muted">
                        {c.allottedTeachers.length} assigned
                      </span>
                    </div>
                    {c.allottedTeachers.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {c.allottedTeachers.map((t) => (
                          <span
                            key={t.id}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary-subtle border border-primary/20 text-xs font-semibold text-primary"
                          >
                            <UserCheck className="w-3 h-3 text-primary" />
                            <span>{t.name || t.email}</span>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/60 inline-block">
                        Faculty gurus allotted per student enrollment.
                      </p>
                    )}
                  </div>

                  {/* Metrics: Tuition, Session Count, Lessons Planned */}
                  <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-bg-alt/25 border border-border-default/60 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-body block">Total Tuition</span>
                      <span className="font-bold text-emerald-700 font-numeric text-sm">
                        ₹{(c.priceMinorUnits / 100).toLocaleString("en-IN")}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-body block">Target Sessions</span>
                      <span className="font-bold text-heading font-numeric text-sm">
                        {c.sessionCount} classes
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-body block">Enrollments</span>
                      <span className="font-bold text-heading font-numeric text-sm">
                        {c.enrollmentsCount} {c.enrollmentsCount === 1 ? "student" : "students"}
                      </span>
                    </div>
                  </div>

                  {/* Flat Tuition & Per-Session Breakdown */}
                  <div className="mt-2.5 px-3.5 py-2.5 rounded-xl bg-purple-50/70 border border-purple-200/60 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-purple-900 font-semibold">
                        <CreditCard className="w-3.5 h-3.5 text-primary" />
                        <span>Tuition Cost</span>
                      </div>
                      <div className="flex items-center gap-2 font-numeric text-xs font-bold text-heading">
                        <span className="text-emerald-700">₹{(c.priceMinorUnits / 100).toLocaleString("en-IN")} total</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-primary font-bold">
                          ₹{Math.round(c.priceMinorUnits / 100 / (c.sessionCount || 1)).toLocaleString("en-IN")}/session
                        </span>
                      </div>
                    </div>
                    {/* Abroad converted rates */}
                    <div className="flex items-center justify-between pt-1 border-t border-purple-200/40 text-[10px] text-body-muted">
                      <span>Abroad Pricing:</span>
                      <span className="font-semibold text-accent-dark font-numeric">
                        {(() => {
                          const p = parseCoursePricing(c.description, c.priceMinorUnits, c.sessionCount, c.level);
                          return "$" + p.rates.USD + " USD · CA$" + p.rates.CAD + " · £" + p.rates.GBP + " GBP · €" + p.rates.EUR + " EUR / session";
                        })()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions Bar */}
                <div className="pt-4 border-t border-border-default/70 flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-[11px] text-body/70 font-mono truncate max-w-[140px]">
                    /{c.slug}
                  </span>

                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Direct 1-Click Publish / Unpublish Button */}
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(c)}
                      disabled={togglingCourseId === c.id}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs active:scale-[0.98] cursor-pointer disabled:opacity-50 ${
                        c.isPublished
                          ? "border border-amber-300/80 bg-amber-50 hover:bg-amber-100/90 text-amber-900"
                          : "border border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                      }`}
                      title={
                        c.isPublished
                          ? "Unpublish course (hide from student catalog)"
                          : "Publish course (make live on student catalog)"
                      }
                    >
                      {togglingCourseId === c.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-current" />
                      ) : c.isPublished ? (
                        <EyeOff className="w-3.5 h-3.5 text-amber-700" />
                      ) : (
                        <Globe className="w-3.5 h-3.5 text-white" />
                      )}
                      <span>{c.isPublished ? "Unpublish" : "Publish"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => openCurriculumDrawer(c)}
                      className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100/80 text-purple-800 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs active:scale-[0.98] cursor-pointer"
                      title="Manage syllabus modules and lessons"
                    >
                      <BookOpen className="w-3.5 h-3.5 text-purple-700" />
                      <span>Curriculum ({c.lessonsCount})</span>
                    </button>

                    {c.structurePdfUrl && (
                      <a
                        href={`/api/courses/structure-pdf?slug=${encodeURIComponent(c.slug)}`}
                        download
                        className="px-2.5 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-[#3C096C] text-xs font-semibold flex items-center gap-1.5 transition-all border border-purple-200/80 shadow-2xs cursor-pointer"
                        title="Download Course Structure PDF"
                      >
                        <FileText className="w-3.5 h-3.5 text-[#3C096C]" />
                        <span>Structure PDF</span>
                        <Download className="w-3 h-3 text-[#3C096C]/70" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => openEditModal(c)}
                      className="px-3 py-1.5 rounded-xl border border-border-default bg-white hover:bg-neutral-50 text-heading text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                      title="Edit course details"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-body" />
                      <span>Edit Course</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDelete(c)}
                      className="p-1.5 rounded-xl text-body/50 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                      title="Delete course"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── CREATE / EDIT COURSE MODAL ─────────────────────────────────────── */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-2xl rounded-2xl border border-border-default bg-white p-5 sm:p-6 shadow-2xl space-y-3.5 max-h-[88vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start justify-between border-b border-border-default pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-dark">
                  {modalMode === "CREATE" ? "Curriculum Creation" : "Edit Course"}
                </span>
                <h3 className="font-serif text-xl font-bold text-heading">
                  {modalMode === "CREATE" ? "Create Academy Course" : `Edit: ${title}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1.5 text-body/50 hover:text-heading transition-colors rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && (
                <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-medium">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <span>Course saved successfully!</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">Course Title</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="e.g. Western Classical Piano - Grade 1"
                    className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">URL Slug</label>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value.toLowerCase())}
                    className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading font-mono focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                  />
                </div>
              </div>

              

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">Discipline</label>
                  <select
                    value={discipline}
                    onChange={(e) => setDiscipline(e.target.value as Discipline)}
                    className="w-full rounded-xl bg-white border border-border-default px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                  >
                    <option value={Discipline.INSTRUMENT}>INSTRUMENT</option>
                    <option value={Discipline.VOCALS}>VOCALS</option>
                    <option value={Discipline.DANCE}>DANCE</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">Instrument / Focus</label>
                  <input
                    type="text"
                    required
                    value={instrument}
                    onChange={(e) => setInstrument(e.target.value)}
                    placeholder="e.g. Piano, Tabla, Kathak"
                    className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">Level</label>
                  <select
                    value={level}
                    onChange={(e) => {
                      const newLvl = e.target.value as CourseLevel;
                      setLevel(newLvl);
                      if (modalMode === "CREATE") {
                        let rINR = 800;
                        let rUSD = 16;
                        let rCAD = 22;
                        let rGBP = 12;
                        let rEUR = 15;
                        let rSGD = 21;
                        let count = 24;
                        if (newLvl === CourseLevel.INTERMEDIATE) {
                          rINR = 1000;
                          rUSD = 21;
                          rCAD = 28;
                          rGBP = 16;
                          rEUR = 19;
                          rSGD = 28;
                          count = 30;
                        } else if (newLvl === CourseLevel.ADVANCED) {
                          rINR = 1250;
                          rUSD = 28;
                          rCAD = 38;
                          rGBP = 21;
                          rEUR = 26;
                          rSGD = 37;
                          count = 36;
                        }
                        setSessionCount(count);
                        setSessionRateINR(rINR);
                        setSessionRateSaudiUAE(rINR);
                        setSessionRateUSD(rUSD);
                        setSessionRateCAD(rCAD);
                        setSessionRateGBP(rGBP);
                        setSessionRateEUR(rEUR);
                        setSessionRateSGD(rSGD);
                        const total = Math.round(rINR * count * (1 - (Number(discountPercent) || 0) / 100));
                        setPriceRupees(total);
                        setPerSessionCost(rINR);
                      }
                    }}
                    className="w-full rounded-xl bg-white border border-border-default px-3 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                  >
                    <option value={CourseLevel.FOUNDATION}>FOUNDATION</option>
                    <option value={CourseLevel.BEGINNER}>BEGINNER</option>
                    <option value={CourseLevel.INTERMEDIATE}>INTERMEDIATE</option>
                    <option value={CourseLevel.ADVANCED}>ADVANCED</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">Session Count</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    required
                    value={sessionCount || ""}
                    onChange={(e) => setSessionCount(e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs font-numeric"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">Duration (Weeks)</label>
                  <input
                    type="number"
                    min={1}
                    max={52}
                    required
                    value={durationWeeks || ""}
                    onChange={(e) => setDurationWeeks(e.target.value === "" ? 0 : Number(e.target.value))}
                    className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs font-numeric"
                  />
                </div>
              </div>

                                          {/* ── Course Tuition & Session Pricing (Compact Countrywise & Discount) ── */}
              <div className="rounded-2xl border border-purple-200/80 bg-white p-3.5 space-y-3 shadow-2xs">
                {/* Header & Inline Discount Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 border border-purple-100 flex items-center justify-center text-primary shrink-0">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-heading flex items-center gap-1.5">
                        Countrywise Session Pricing
                      </h4>
                      <p className="text-[10px] text-body-muted">
                        Per-session fee × {sessionCount} sessions {(Number(discountPercent) || 0) > 0 ? `(-${discountPercent}% OFF)` : ""}
                      </p>
                    </div>
                  </div>

                  {/* Inline Discount Control */}
                  <div className="flex items-center gap-1.5 bg-purple-50/80 px-2 py-1 rounded-xl border border-purple-200/70">
                    <span className="text-[10px] font-bold text-purple-900 flex items-center gap-1">
                      <Percent className="w-3 h-3 text-purple-600" />
                      Discount:
                    </span>
                    <div className="relative w-14">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={discountPercent}
                        onChange={(e) => {
                          const raw = e.target.value; const val = raw === "" ? "" : Math.min(90, Math.max(0, Number(raw)));
                          setDiscountPercent(val);
                          const total = Math.round(sessionRateINR * sessionCount * (1 - (Number(val) || 0) / 100));
                          setPriceRupees(total);
                        }}
                        className="w-full pl-1.5 pr-4 py-0.5 text-xs font-bold text-purple-950 bg-white border border-purple-300 rounded-md text-right focus:outline-none focus:border-purple-600 font-numeric"
                      />
                      <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-purple-700 pointer-events-none">%</span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {[0, 10, 15, 20, 25].map((pct) => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setDiscountPercent(pct === 0 ? "" : pct);
                            const total = Math.round(sessionRateINR * sessionCount * (1 - pct / 100));
                            setPriceRupees(total);
                          }}
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all ${
                            (discountPercent === pct || (pct === 0 && (discountPercent === "" || discountPercent === 0)))
                              ? "bg-purple-700 text-white"
                              : "bg-white text-purple-900 border border-purple-200 hover:bg-purple-100"
                          }`}
                        >
                          {pct === 0 ? "0%" : `${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Compact 2-Column Grid of 8 Country Tiers */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* 1. India */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-purple-200/80 bg-purple-50/20 hover:border-purple-300 transition-colors">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🇮🇳</span>
                        <span className="text-xs font-bold text-heading">India</span>
                        <span className="text-[9px] font-bold text-purple-700 bg-purple-100/70 px-1.5 py-0.2 rounded border border-purple-200">₹ INR</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">₹{calculateTierTotal(sessionRateINR).base.toLocaleString("en-IN")}</span>
                            <strong className="text-emerald-700 font-bold">₹{calculateTierTotal(sessionRateINR).discounted.toLocaleString("en-IN")}</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">₹{calculateTierTotal(sessionRateINR).base.toLocaleString("en-IN")}</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-body/70 pointer-events-none">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={sessionRateINR || ""}
                          onChange={(e) => {
                            const val = e.target.value === "" ? 0 : Number(e.target.value);
                            setSessionRateINR(val);
                            setPerSessionCost(val);
                            const total = Math.round(val * sessionCount * (1 - (Number(discountPercent) || 0) / 100));
                            setPriceRupees(total);
                          }}
                          className="w-20 pl-5 pr-2 py-1 text-xs font-bold font-numeric text-heading bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>

                  {/* 2. USA */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:border-slate-300 transition-colors">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🇺🇸</span>
                        <span className="text-xs font-bold text-heading">USA</span>
                        <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">$ USD</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">${calculateTierTotal(sessionRateUSD).base.toLocaleString()}</span>
                            <strong className="text-emerald-700 font-bold">${calculateTierTotal(sessionRateUSD).discounted.toLocaleString()}</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">${calculateTierTotal(sessionRateUSD).base.toLocaleString()}</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-body/70 pointer-events-none">$</span>
                        <input
                          type="number"
                          min={0}
                          value={sessionRateUSD || ""}
                          onChange={(e) => setSessionRateUSD(e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-20 pl-5 pr-2 py-1 text-xs font-bold font-numeric text-heading bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>

                  {/* 3. Canada */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:border-slate-300 transition-colors">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🇨🇦</span>
                        <span className="text-xs font-bold text-heading">Canada</span>
                        <span className="text-[9px] font-bold text-red-700 bg-red-50 px-1.5 py-0.2 rounded border border-red-200">CA$ CAD</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">CA${calculateTierTotal(sessionRateCAD).base.toLocaleString()}</span>
                            <strong className="text-emerald-700 font-bold">CA${calculateTierTotal(sessionRateCAD).discounted.toLocaleString()}</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">CA${calculateTierTotal(sessionRateCAD).base.toLocaleString()}</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-body/70 pointer-events-none">CA$</span>
                        <input
                          type="number"
                          min={0}
                          value={sessionRateCAD || ""}
                          onChange={(e) => setSessionRateCAD(e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-22 pl-7 pr-2 py-1 text-xs font-bold font-numeric text-heading bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>

                  {/* 4. UK */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:border-slate-300 transition-colors">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🇬🇧</span>
                        <span className="text-xs font-bold text-heading">UK</span>
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">£ GBP</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">£{calculateTierTotal(sessionRateGBP).base.toLocaleString()}</span>
                            <strong className="text-emerald-700 font-bold">£{calculateTierTotal(sessionRateGBP).discounted.toLocaleString()}</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">£{calculateTierTotal(sessionRateGBP).base.toLocaleString()}</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-body/70 pointer-events-none">£</span>
                        <input
                          type="number"
                          min={0}
                          value={sessionRateGBP || ""}
                          onChange={(e) => setSessionRateGBP(e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-20 pl-5 pr-2 py-1 text-xs font-bold font-numeric text-heading bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>

                  {/* 5. Rest European Countries (ire, ger, etc.) */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:border-slate-300 transition-colors">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🇪🇺</span>
                        <span className="text-xs font-bold text-heading">Europe <span className="text-[10px] font-normal text-body-muted">(ire, ger)</span></span>
                        <span className="text-[9px] font-bold text-blue-800 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">€ EUR</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">€{calculateTierTotal(sessionRateEUR).base.toLocaleString()}</span>
                            <strong className="text-emerald-700 font-bold">€{calculateTierTotal(sessionRateEUR).discounted.toLocaleString()}</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">€{calculateTierTotal(sessionRateEUR).base.toLocaleString()}</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-body/70 pointer-events-none">€</span>
                        <input
                          type="number"
                          min={0}
                          value={sessionRateEUR || ""}
                          onChange={(e) => setSessionRateEUR(e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-20 pl-5 pr-2 py-1 text-xs font-bold font-numeric text-heading bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>

                  {/* 6. Singapore */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200/80 bg-slate-50/30 hover:border-slate-300 transition-colors">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🇸🇬</span>
                        <span className="text-xs font-bold text-heading">Singapore</span>
                        <span className="text-[9px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">SGD</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">{calculateTierTotal(sessionRateSGD).base.toLocaleString()} SGD</span>
                            <strong className="text-emerald-700 font-bold">{calculateTierTotal(sessionRateSGD).discounted.toLocaleString()} SGD</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">{calculateTierTotal(sessionRateSGD).base.toLocaleString()} SGD</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-body/70 pointer-events-none">SGD</span>
                        <input
                          type="number"
                          min={0}
                          value={sessionRateSGD || ""}
                          onChange={(e) => setSessionRateSGD(e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-24 pl-8 pr-2 py-1 text-xs font-bold font-numeric text-heading bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>

                  {/* 7. Saudi, UAE */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-emerald-200/80 bg-emerald-50/20 hover:border-emerald-300 transition-colors">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🇸🇦 🇦🇪</span>
                        <span className="text-xs font-bold text-heading">Saudi, UAE</span>
                        <span className="text-[9px] font-bold text-emerald-800 bg-emerald-100/70 px-1.5 py-0.2 rounded border border-emerald-200">₹ INR</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">₹{calculateTierTotal(sessionRateSaudiUAE).base.toLocaleString("en-IN")}</span>
                            <strong className="text-emerald-700 font-bold">₹{calculateTierTotal(sessionRateSaudiUAE).discounted.toLocaleString("en-IN")}</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">₹{calculateTierTotal(sessionRateSaudiUAE).base.toLocaleString("en-IN")}</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-body/70 pointer-events-none">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={sessionRateSaudiUAE || ""}
                          onChange={(e) => setSessionRateSaudiUAE(e.target.value === "" ? 0 : Number(e.target.value))}
                          className="w-20 pl-5 pr-2 py-1 text-xs font-bold font-numeric text-heading bg-white border border-slate-200 rounded-lg text-right focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>

                  {/* 8. Remaining countries */}
                  <div className="flex items-center justify-between p-2 rounded-xl border border-dashed border-indigo-200 bg-indigo-50/20">
                    <div className="min-w-0 pr-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">🌐</span>
                        <span className="text-xs font-bold text-heading">Remaining</span>
                        <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100/70 px-1.5 py-0.2 rounded border border-indigo-200">$ USD</span>
                        <span className="text-[9px] font-medium text-indigo-600 bg-indigo-50 px-1 py-0.2 rounded">Auto</span>
                      </div>
                      <div className="text-[10px] text-body-muted font-numeric mt-0.5">
                        Total: {Number(discountPercent) > 0 ? (
                          <span className="space-x-1">
                            <span className="line-through text-slate-400">${calculateTierTotal(sessionRateUSD).base.toLocaleString()}</span>
                            <strong className="text-emerald-700 font-bold">${calculateTierTotal(sessionRateUSD).discounted.toLocaleString()}</strong>
                          </span>
                        ) : (
                          <strong className="text-heading font-bold">${calculateTierTotal(sessionRateUSD).base.toLocaleString()}</strong>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-bold text-body/50 pointer-events-none">$</span>
                        <input
                          type="number"
                          disabled
                          value={sessionRateUSD || ""}
                          className="w-20 pl-5 pr-2 py-1 text-xs font-bold font-numeric text-heading/70 bg-slate-100/80 border border-slate-200/80 rounded-lg text-right cursor-not-allowed"
                        />
                      </div>
                      <span className="text-[10px] text-body-muted font-medium">/sess</span>
                    </div>
                  </div>
                </div>

                {/* Sleek Summary Strip */}
                <div className="px-3 py-2 rounded-xl bg-purple-50/70 border border-purple-200/60 flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-numeric text-[#1E1A4D]">
                  <div className="flex items-center gap-1.5 font-sans font-bold text-xs text-purple-900">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span>Summary ({sessionCount} sessions):</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                    <span>🇮🇳 <strong>₹{calculateTierTotal(sessionRateINR).discounted.toLocaleString("en-IN")}</strong></span>
                    <span>🇺🇸 <strong>${calculateTierTotal(sessionRateUSD).discounted.toLocaleString()}</strong></span>
                    <span>🇬🇧 <strong>£{calculateTierTotal(sessionRateGBP).discounted.toLocaleString()}</strong></span>
                    <span>🇪🇺 <strong>€{calculateTierTotal(sessionRateEUR).discounted.toLocaleString()}</strong></span>
                    <span>🇨🇦 <strong>CA${calculateTierTotal(sessionRateCAD).discounted.toLocaleString()}</strong></span>
                    <span>🇸🇬 <strong>{calculateTierTotal(sessionRateSGD).discounted.toLocaleString()} SGD</strong></span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading">
                  Accreditation Board (Optional)
                </label>
                <input
                  type="text"
                  value={accreditation}
                  onChange={(e) => setAccreditation(e.target.value)}
                  placeholder="e.g. Trinity College London Grade 1, ABRSM Grade 2"
                  className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading">Course Description</label>
                <textarea
                  required
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl bg-white border border-border-default p-3 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed shadow-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading">
                  Syllabus Breakdown Summary
                </label>
                <textarea
                  required
                  rows={2}
                  value={syllabusSummary}
                  onChange={(e) => setSyllabusSummary(e.target.value)}
                  placeholder="Lesson 1-4: Posture & Scales • Lesson 5-10: Repertoire • Lesson 11-20: Performance..."
                  className="w-full rounded-xl bg-white border border-border-default p-3 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed shadow-xs"
                />
              </div>

              {/* Course Structure PDF Upload Section */}
              <div className="space-y-2 p-3.5 rounded-2xl bg-neutral-50/80 border border-neutral-200/80">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-heading flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#3C096C]" />
                    <span>Course Structure PDF (Optional)</span>
                  </label>
                  <span className="text-[10px] font-semibold text-body/60 font-numeric">
                    PDF up to 25MB
                  </span>
                </div>

                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handlePdfUpload}
                  className="hidden"
                />

                {pdfUploadError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{pdfUploadError}</span>
                  </div>
                )}

                {pdfSuccessMsg && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2 animate-fade-in">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{pdfSuccessMsg}</span>
                  </div>
                )}

                {structurePdfUrl ? (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white border border-purple-200 shadow-2xs gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 font-bold text-[10px] border border-rose-200">
                        PDF
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-heading truncate">
                          {structurePdfName || "Course Structure PDF"}
                        </p>
                        <a
                          href={
                            courseId
                              ? `/api/courses/structure-pdf?courseId=${courseId}&view=preview`
                              : slug
                              ? `/api/courses/structure-pdf?slug=${encodeURIComponent(slug)}&view=preview`
                              : structurePdfUrl
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-[#3C096C] hover:underline flex items-center gap-1 font-medium"
                        >
                          <span>Preview / View File</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={isUploadingPdf}
                        className="px-2.5 py-1.5 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-[11px] font-semibold text-heading transition-colors cursor-pointer"
                        title="Upload a new PDF to replace this one"
                      >
                        {isUploadingPdf ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "Replace"
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={handleRemovePdf}
                        className="p-1.5 rounded-lg text-body/50 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                        title="Remove attached PDF"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => !isUploadingPdf && pdfInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-4 text-center transition-all cursor-pointer ${
                      isUploadingPdf
                        ? "border-purple-300 bg-purple-50/50"
                        : "border-neutral-300 hover:border-[#3C096C] bg-white hover:bg-purple-50/20"
                    }`}
                  >
                    {isUploadingPdf ? (
                      <div className="flex items-center justify-center gap-2 text-xs font-semibold text-[#3C096C]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Uploading Course Structure PDF to Cloud Storage...</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2 text-xs text-body/80">
                        <Upload className="w-4 h-4 text-[#3C096C]" />
                        <span className="font-semibold text-heading">Click to upload Course Structure PDF</span>
                        <span className="text-[11px] text-body/50">(Students can download this from catalog)</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-heading cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 accent-primary rounded cursor-pointer"
                  />
                  <span>Publish course immediately to student catalog</span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-default">
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
                  className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 active:scale-[0.98] cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Course</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CURRICULUM & LESSON ALLOTMENT DRAWER / MODAL ───────────────────── */}
      {curriculumCourse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
          <div className="w-full max-w-3xl rounded-3xl border border-border-default bg-white p-6 sm:p-7 shadow-2xl space-y-5 max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border-default pb-3 flex-shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-accent-dark flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-accent-dark" />
                  <span>Curriculum & Faculty Allotment Builder</span>
                </span>
                <h3 className="font-serif text-xl font-bold text-heading mt-0.5">
                  {curriculumCourse.title}
                </h3>
                <p className="text-xs text-body-muted mt-0.5">
                  Allot which teacher takes each individual lesson, and set scheduled dates. When a student purchases this course, these lessons automatically sync to both student & faculty calendars!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCurriculumCourse(null)}
                className="p-1.5 text-body/50 hover:text-heading transition-colors rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Banner */}
            {lessonSuccessMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium flex-shrink-0 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{lessonSuccessMsg}</span>
              </div>
            )}

            {/* Quick Action Strip */}
            <div className="p-3.5 rounded-2xl bg-bg-alt/30 border border-border-default/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
              <div className="flex items-center gap-3 text-xs">
                <div>
                  <span className="text-[10px] text-body block">Total Required</span>
                  <span className="font-bold text-heading font-numeric">
                    {curriculumCourse.sessionCount} lessons
                  </span>
                </div>
                <div className="h-6 w-px bg-border-default" />
                <div>
                  <span className="text-[10px] text-body block">Allotted</span>
                  <span className="font-bold text-accent-dark font-numeric">
                    {curriculumCourse.lessons.length} scheduled
                  </span>
                </div>
                <div className="h-6 w-px bg-border-default" />
                <div>
                  <span className="text-[10px] text-body block">Course Start Date</span>
                  <span className="font-bold text-heading">
                    {curriculumCourse.startDate
                      ? new Date(curriculumCourse.startDate).toLocaleDateString()
                      : "Open / Not Set"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleBulkGenerateLessons}
                  disabled={isPending}
                  className="px-3 py-1.5 rounded-xl bg-accent-subtle hover:bg-accent-subtle/80 border border-accent/30 text-accent-dark text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                  title="Generate all missing lesson slots evenly spaced with default faculty"
                >
                  <Sparkles className="w-3.5 h-3.5 text-accent-dark" />
                  <span>Auto-Generate Lessons</span>
                </button>

                <button
                  type="button"
                  onClick={startAddLesson}
                  className="px-3 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs active:scale-[0.98] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Lesson</span>
                </button>
              </div>
            </div>

            {/* Inline Add / Edit Lesson Box */}
            {editingLessonId !== null && (
              <div className="p-4 rounded-2xl bg-primary-subtle/40 border border-primary/25 space-y-3 flex-shrink-0 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                    <Edit2 className="w-3.5 h-3.5 text-primary" />
                    <span>
                      {editingLessonId === "NEW"
                        ? `Add Lesson #${lessonNumber}`
                        : `Edit Lesson #${lessonNumber}`}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditingLessonId(null)}
                    className="text-xs text-body hover:text-heading"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                  <div className="sm:col-span-2 space-y-1">
                    <label className="text-[11px] font-semibold text-heading"># Order</label>
                    <input
                      type="number"
                      min={1}
                      value={lessonNumber}
                      onChange={(e) => setLessonNumber(Number(e.target.value))}
                      className="w-full rounded-xl bg-white border border-border-default px-2.5 py-1.5 text-xs text-heading font-numeric"
                    />
                  </div>

                  <div className="sm:col-span-6 space-y-1">
                    <label className="text-[11px] font-semibold text-heading">Lesson Title</label>
                    <input
                      type="text"
                      required
                      value={lessonTitle}
                      onChange={(e) => setLessonTitle(e.target.value)}
                      placeholder="e.g. Lesson 1: Finger Technique & Scales"
                      className="w-full rounded-xl bg-white border border-border-default px-3 py-1.5 text-xs text-heading"
                    />
                  </div>

                  <div className="sm:col-span-4 space-y-1">
                    <label className="text-[11px] font-semibold text-heading">
                      Duration (Mins)
                    </label>
                    <input
                      type="number"
                      min={15}
                      step={15}
                      value={lessonDuration}
                      onChange={(e) => setLessonDuration(Number(e.target.value))}
                      className="w-full rounded-xl bg-white border border-border-default px-3 py-1.5 text-xs text-heading font-numeric"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-heading flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-accent-dark" />
                      <span>Scheduled Date & Time</span>
                    </label>
                    <DateTimePicker
                      value={lessonStartsAt}
                      onChange={setLessonStartsAt}
                    />
                    <span className="text-[10px] text-body-muted block">
                      Syncs automatically to student & teacher calendar upon course purchase
                    </span>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-heading flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-primary" />
                      <span>Allotted Faculty Teacher</span>
                    </label>
                    <select
                      value={lessonTeacherId}
                      onChange={(e) => setLessonTeacherId(e.target.value)}
                      className="w-full rounded-xl bg-white border border-border-default px-3 py-1.5 text-xs text-heading font-medium cursor-pointer"
                    >
                      <option value="">-- Auto-Assign Course Teacher --</option>
                      {curriculumCourse.allottedTeachers.length > 0 && (
                        <optgroup label="Course Assigned Faculty">
                          {curriculumCourse.allottedTeachers.map((t) => (
                            <option key={t.id} value={t.id}>
                              ★ {t.name || t.email} ({t.instruments.join(", ")})
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label="Other Academy Faculty">
                        {facultyTeachers
                          .filter(
                            (t) =>
                              !curriculumCourse.allottedTeachers.some((ct) => ct.id === t.id),
                          )
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name || t.email} ({t.instruments.join(", ")})
                            </option>
                          ))}
                      </optgroup>
                    </select>
                    <span className="text-[10px] text-body-muted block">
                      Teacher whose upcoming lessons & calendar will receive this class
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-heading">
                    Syllabus Notes / Focus Area
                  </label>
                  <input
                    type="text"
                    value={lessonDescription}
                    onChange={(e) => setLessonDescription(e.target.value)}
                    placeholder="Brief description of skills, exercises, or exam pieces covered"
                    className="w-full rounded-xl bg-white border border-border-default px-3 py-1.5 text-xs text-heading"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingLessonId(null)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold text-body hover:text-heading"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveLesson}
                    disabled={isPending}
                    className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    <span>Save Lesson Slot</span>
                  </button>
                </div>
              </div>
            )}

            {/* Lessons List View */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
              {curriculumCourse.lessons.length === 0 ? (
                <div className="p-8 text-center rounded-2xl bg-bg-alt/20 border border-dashed border-border-default space-y-3">
                  <GraduationCap className="w-10 h-10 text-primary/40 mx-auto" />
                  <div>
                    <h4 className="font-serif font-bold text-heading text-sm">
                      No Lessons Added to Curriculum Yet
                    </h4>
                    <p className="text-xs text-body-muted max-w-md mx-auto mt-1 leading-relaxed">
                      Click <strong>&quot;Auto-Generate Lessons&quot;</strong> to automatically generate {curriculumCourse.sessionCount} scheduled lesson slots, or click <strong>&quot;Add Lesson&quot;</strong> to configure them individually.
                    </p>
                  </div>
                </div>
              ) : (
                curriculumCourse.lessons.map((lesson) => {
                  const teacher = facultyTeachers.find((t) => t.id === lesson.teacherId);
                  const formattedTime = lesson.scheduledStartsAt
                    ? formatToIST(lesson.scheduledStartsAt, "EEE, MMM d, yyyy 'at' h:mm a 'IST'")
                    : "Flexible schedule (Relative to enrollment date)";

                  return (
                    <div
                      key={lesson.id}
                      className="p-3.5 rounded-2xl border border-border-default bg-white hover:border-primary/40 hover:shadow-xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-xl bg-primary/10 text-primary font-bold text-xs flex items-center justify-center shrink-0 font-numeric">
                          #{lesson.lessonNumber}
                        </span>

                        <div className="space-y-1">
                          <h5 className="font-bold text-heading text-xs sm:text-sm">
                            {lesson.title}
                          </h5>
                          {lesson.description && (
                            <p className="text-[11px] text-body-muted line-clamp-1">
                              {lesson.description}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px]">
                            <span className="flex items-center gap-1 text-heading font-medium">
                              <Calendar className="w-3 h-3 text-accent-dark" />
                              <span>{formattedTime}</span>
                            </span>

                            <span className="text-border-default">•</span>

                            <span className="flex items-center gap-1 text-primary font-semibold">
                              <UserCheck className="w-3 h-3 text-primary" />
                              <span>
                                {teacher?.name
                                  ? `Faculty: ${teacher.name}`
                                  : lesson.teacherName
                                  ? `Faculty: ${lesson.teacherName}`
                                  : "Auto-Assigned Course Teacher"}
                              </span>
                            </span>

                            <span className="text-border-default">•</span>

                            <span className="text-body-muted flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{lesson.durationMinutes} min</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => startEditLesson(lesson)}
                          className="px-2.5 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-heading text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3 h-3 text-body" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLesson(lesson.id)}
                          className="p-1 rounded-lg text-body/40 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete lesson"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="pt-3 border-t border-border-default flex items-center justify-between text-xs flex-shrink-0">
              <span className="text-body-muted">
                Tip: Lessons with scheduled times will instantly appear in the student & teacher video classroom list upon enrollment.
              </span>
              <button
                type="button"
                onClick={() => setCurriculumCourse(null)}
                className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-bold cursor-pointer transition-all active:scale-[0.98]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
