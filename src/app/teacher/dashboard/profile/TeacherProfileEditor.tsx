"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  updateTeacherProfileAction,
  updateTeacherPaymentDetailsAction,
} from "@/actions/teacher";
import {
  updateProfileAction,
  changePasswordAction,
  requestEmailUpdateAction,
  verifyEmailUpdateAction,
} from "@/actions/profile";
import { POPULAR_TIMEZONES, formatDeterministicDate } from "@/lib/timezone";
import { INSTRUMENTS, LANGUAGES, TEACHER_SKILL_CATEGORIES } from "@/types";
import {
  User,
  Lock,
  Check,
  Loader2,
  ShieldCheck,
  Music,
  Globe,
  Briefcase,
  AlertCircle,
  Sparkles,
  BookOpen,
  ArrowRightLeft,
  X,
  Plus,
  CreditCard,
  Clock,
  CheckCircle2,
  Mic,
  Mail,
  Edit3,
  Send,
  RefreshCw,
} from "lucide-react";
import { AvatarUpload } from "@/components/profile/AvatarUpload";

interface TeacherProfileEditorProps {
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    image?: string | null;
  };
  profile: {
    bio: string;
    instruments: string[];
    expertInstruments?: string[];
    moderateInstruments?: string[];
    languages: string[];
    yearsTeaching: number;
    hourlyRate: number;
    payoutPerSession: number;
    upiId?: string;
    isPublished: boolean;
    approvalStatus?: "PENDING" | "APPROVED" | "REJECTED";
    approvedAt?: string | null;
    rejectionReason?: string | null;
  } | null;
}

export function TeacherProfileEditor({
  user,
  profile,
}: TeacherProfileEditorProps) {
  const router = useRouter();
  const [currentEmail, setCurrentEmail] = useState(user.email);

  // Email Update Modal State
  const [isUpdateEmailOpen, setIsUpdateEmailOpen] = useState(false);
  const [emailStep, setEmailStep] = useState<"REQUEST" | "VERIFY">("REQUEST");
  const [newEmailInput, setNewEmailInput] = useState("");
  const [emailOtpInput, setEmailOtpInput] = useState("");
  const [isSendingEmailOtp, startSendingEmailOtpTransition] = useTransition();
  const [isVerifyingEmailOtp, startVerifyingEmailOtpTransition] = useTransition();
  const [emailModalError, setEmailModalError] = useState<string | null>(null);
  const [emailModalSuccess, setEmailModalSuccess] = useState<string | null>(null);
  const [emailResendCooldown, setEmailResendCooldown] = useState(0);

  useEffect(() => {
    if (emailResendCooldown <= 0) return;
    const timer = setInterval(() => {
      setEmailResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [emailResendCooldown]);

  const handleRequestEmailUpdate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setEmailModalError(null);
    setEmailModalSuccess(null);

    const targetEmail = newEmailInput.trim().toLowerCase();
    if (!targetEmail) {
      setEmailModalError("Please enter your new email address.");
      return;
    }

    startSendingEmailOtpTransition(async () => {
      const res = await requestEmailUpdateAction({ newEmail: targetEmail });
      if (!res.success) {
        setEmailModalError(res.error || "Failed to dispatch verification code.");
      } else {
        setEmailStep("VERIFY");
        setEmailOtpInput("");
        setEmailResendCooldown(60);
        setEmailModalSuccess(res.message || `Verification code sent to ${targetEmail}`);
      }
    });
  };

  const handleVerifyEmailUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    setEmailModalError(null);
    setEmailModalSuccess(null);

    const targetEmail = newEmailInput.trim().toLowerCase();
    const cleanOtp = emailOtpInput.trim().replace(/\D/g, "");

    if (!cleanOtp || cleanOtp.length !== 6) {
      setEmailModalError("Please enter the complete 6-digit verification code.");
      return;
    }

    startVerifyingEmailOtpTransition(async () => {
      const res = await verifyEmailUpdateAction({
        newEmail: targetEmail,
        otpCode: cleanOtp,
      });

      if (!res.success) {
        setEmailModalError(res.error || "Invalid verification code.");
      } else {
        const updated = res.email || targetEmail;
        setCurrentEmail(updated);
        setEmailModalSuccess(res.message || "Email address updated successfully!");
        setTimeout(() => {
          setIsUpdateEmailOpen(false);
          setEmailStep("REQUEST");
          setNewEmailInput("");
          setEmailOtpInput("");
          setEmailModalError(null);
          setEmailModalSuccess(null);
          router.refresh();
        }, 1200);
      }
    });
  };

  // Account fields
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone || "UTC");

  // Profile fields
  const [bio, setBio] = useState(profile?.bio || "");

  // Initialize expert and moderate instruments
  const initialModerate = profile?.moderateInstruments || [];
  const initialExpert =
    profile?.expertInstruments && profile.expertInstruments.length > 0
      ? profile.expertInstruments
      : (profile?.instruments || ["Piano"]).filter((i) => !initialModerate.includes(i));

  const [expertInstruments, setExpertInstruments] = useState<string[]>(
    initialExpert.length > 0 ? initialExpert : ["Piano"],
  );
  const [moderateInstruments, setModerateInstruments] = useState<string[]>(
    initialModerate,
  );

  const [skillCategoryTab, setSkillCategoryTab] = useState<
    "ALL" | "INSTRUMENTS" | "SINGING" | "DANCING"
  >("ALL");

  const displayedSkillGroups = (
    skillCategoryTab === "ALL"
      ? [
          {
            name: "Instruments",
            icon: Music,
            items: TEACHER_SKILL_CATEGORIES.INSTRUMENTS as readonly string[],
          },
          {
            name: "Singing",
            icon: Mic,
            items: TEACHER_SKILL_CATEGORIES.SINGING as readonly string[],
          },
          {
            name: "Dancing",
            icon: Sparkles,
            items: TEACHER_SKILL_CATEGORIES.DANCING as readonly string[],
          },
          {
            name: "Theory & Other",
            icon: BookOpen,
            items: ["Music Theory", "Composition"] as readonly string[],
          },
        ]
      : skillCategoryTab === "INSTRUMENTS"
      ? [
          {
            name: "Instruments",
            icon: Music,
            items: TEACHER_SKILL_CATEGORIES.INSTRUMENTS as readonly string[],
          },
        ]
      : skillCategoryTab === "SINGING"
      ? [
          {
            name: "Singing",
            icon: Mic,
            items: TEACHER_SKILL_CATEGORIES.SINGING as readonly string[],
          },
        ]
      : [
          {
            name: "Dancing",
            icon: Sparkles,
            items: TEACHER_SKILL_CATEGORIES.DANCING as readonly string[],
          },
        ]
  );

  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(
    profile?.languages || ["English"],
  );
  const [yearsTeaching, setYearsTeaching] = useState<number>(
    profile?.yearsTeaching || 5,
  );

  const [isPendingProfile, startProfileTransition] = useTransition();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Payment credentials fields (UPI ID only)
  const [upiId, setUpiId] = useState(profile?.upiId || "");
  const [isPendingPayment, startPaymentTransition] = useTransition();
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPendingPassword, startPasswordTransition] = useTransition();
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleSavePaymentDetails = (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError(null);
    setPaymentSuccess(false);

    startPaymentTransition(async () => {
      const res = await updateTeacherPaymentDetailsAction({ upiId });
      if (!res.success) {
        setPaymentError(res.error || "Failed to update UPI ID.");
      } else {
        setPaymentSuccess(true);
        setTimeout(() => setPaymentSuccess(false), 3500);
      }
    });
  };

  const toggleExpert = (inst: string) => {
    setExpertInstruments((prev) => {
      if (prev.includes(inst)) {
        if (prev.length === 1 && moderateInstruments.length === 0) return prev;
        return prev.filter((i) => i !== inst);
      }
      return [...prev, inst];
    });
    setModerateInstruments((prev) => prev.filter((i) => i !== inst));
  };

  const toggleModerate = (inst: string) => {
    setModerateInstruments((prev) => {
      if (prev.includes(inst)) {
        if (prev.length === 1 && expertInstruments.length === 0) return prev;
        return prev.filter((i) => i !== inst);
      }
      return [...prev, inst];
    });
    setExpertInstruments((prev) => prev.filter((i) => i !== inst));
  };

  const moveToModerate = (inst: string) => {
    setExpertInstruments((prev) => prev.filter((i) => i !== inst));
    setModerateInstruments((prev) => (prev.includes(inst) ? prev : [...prev, inst]));
  };

  const moveToExpert = (inst: string) => {
    setModerateInstruments((prev) => prev.filter((i) => i !== inst));
    setExpertInstruments((prev) => (prev.includes(inst) ? prev : [...prev, inst]));
  };

  const removeInstrument = (inst: string) => {
    const totalCount = expertInstruments.length + moderateInstruments.length;
    if (totalCount <= 1) return;
    setExpertInstruments((prev) => prev.filter((i) => i !== inst));
    setModerateInstruments((prev) => prev.filter((i) => i !== inst));
  };

  const toggleLanguage = (lang: string) => {
    setSelectedLanguages((curr) =>
      curr.includes(lang)
        ? curr.length > 1
          ? curr.filter((l) => l !== lang)
          : curr
        : [...curr, lang],
    );
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    if (bio.trim().length < 20) {
      setProfileError("Bio must be at least 20 characters.");
      return;
    }

    if (expertInstruments.length === 0 && moderateInstruments.length === 0) {
      setProfileError("Please select at least one instrument or discipline taught.");
      return;
    }

    startProfileTransition(async () => {
      // 1. Update user name and timezone
      const userRes = await updateProfileAction({ name, timezone });
      if (!userRes.success) {
        setProfileError(userRes.error || "Failed to update profile name/timezone.");
        return;
      }

      // 2. Update teacher profile data
      const formData = new FormData();
      formData.set("bio", bio.trim());
      formData.set("yearsTeaching", String(yearsTeaching));
      formData.set("hourlyRate", String(Math.max(10, Math.round((profile?.hourlyRate || 5000) / 100))));
      
      const allInstruments = Array.from(new Set([...expertInstruments, ...moderateInstruments]));
      allInstruments.forEach((inst) => formData.append("instruments", inst));
      expertInstruments.forEach((inst) => formData.append("expertInstruments", inst));
      moderateInstruments.forEach((inst) => formData.append("moderateInstruments", inst));
      selectedLanguages.forEach((lang) => formData.append("languages", lang));
      if (upiId.trim()) {
        formData.set("upiId", upiId.trim());
      }

      const teacherRes = await updateTeacherProfileAction(null, formData);
      if (!teacherRes.success) {
        const err =
          teacherRes.error ||
          (teacherRes.fieldErrors
            ? Object.values(teacherRes.fieldErrors)[0]?.[0]
            : null) ||
          "Failed to update teacher studio details.";
        setProfileError(err);
        return;
      }

      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 3000);
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(false);

    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters long.");
      return;
    }

    startPasswordTransition(async () => {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
      });

      if (!res.success) {
        setPasswordError(res.error || "Failed to update password.");
      } else {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(false), 3000);
      }
    });
  };

  return (
    <div className="space-y-8">
      {/* Studio & Faculty Info Form */}
      <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs space-y-6">
        <div className="border-b border-border-default pb-4">
          <h2 className="font-serif text-lg font-bold text-heading flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <span>Faculty Profile & Studio Credentials</span>
          </h2>
          <p className="text-xs text-body mt-0.5">
            Update your teaching bio, instrument specialties, languages, and time preferences.
          </p>
        </div>

        {/* Accreditation Status Banner */}
        {profile?.approvalStatus === "APPROVED" ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-emerald-950">
                  Accredited & Verified Faculty Member
                </p>
                <p className="text-emerald-800 text-[11px]">
                  Your credentials have been approved by the Gandharva Academic Board.
                  {profile.approvedAt ? ` Approved on ${formatDeterministicDate(profile.approvedAt)}.` : ""}
                </p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider shrink-0">
              Active Faculty
            </span>
          </div>
        ) : profile?.approvalStatus === "REJECTED" ? (
          <div className="rounded-2xl border border-rose-300 bg-rose-50/90 p-4 space-y-1.5 text-xs text-rose-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="font-bold text-rose-950">Application Status: Revision Required</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-rose-700 text-white text-[10px] font-bold uppercase tracking-wider">
                Action Required
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              {profile.rejectionReason
                ? `Note from Academic Board: "${profile.rejectionReason}"`
                : "Your faculty application requires additional information or updated instruments before accreditation can be completed."}
            </p>
            <p className="text-[10px] text-rose-800/80">
              Please update your details below and click Save. Our academic team will automatically review your revised credentials.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-4 space-y-1.5 text-xs text-amber-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-600 animate-pulse shrink-0" />
                <span className="font-bold text-amber-950">Application Status: Pending Academic Board Review</span>
              </div>
              <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold uppercase tracking-wider">
                Under Review
              </span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Your instructor registration has been submitted and is in the review queue. You can refine your bio, instruments, hourly rates, and schedule below. Profile publishing will unlock once approved.
            </p>
          </div>
        )}

        {/* Profile Avatar Upload Section */}
        <div className="pb-2 border-b border-border-default/60">
          <AvatarUpload currentImage={user.image} userName={name} />
        </div>

        <form onSubmit={handleUpdateProfile} className="space-y-5">
          {profileError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{profileError}</span>
            </div>
          )}

          {profileSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Profile credentials saved successfully!</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                  <span>Email Address</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsUpdateEmailOpen(true);
                    setEmailStep("REQUEST");
                    setNewEmailInput("");
                    setEmailOtpInput("");
                    setEmailModalError(null);
                    setEmailModalSuccess(null);
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary-dark transition-colors cursor-pointer hover:underline"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Update Email</span>
                </button>
              </div>
              <div className="relative">
                <input
                  type="email"
                  disabled
                  value={currentEmail}
                  className="w-full rounded-xl bg-neutral-100/90 border border-neutral-200 px-3.5 py-2 text-xs text-heading font-medium cursor-not-allowed pr-28 shadow-xs"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200/80 flex items-center gap-1 shadow-xs">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>Verified</span>
                </span>
              </div>
              <p className="text-[11px] text-body-muted">
                Your sign-in email & notification inbox. Click <strong>Update Email</strong> to change it with verification.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-heading">
                Teaching Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs font-numeric"
              >
                {POPULAR_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-body">
                All availability rules and lesson rooms are scheduled relative to this timezone.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-heading">
                Years Teaching Experience
              </label>
              <input
                type="number"
                min={0}
                max={60}
                required
                value={yearsTeaching}
                onChange={(e) => setYearsTeaching(Number(e.target.value))}
                className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs font-numeric"
              />
            </div>
          </div>

          {/* Bio */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-heading">
              Instructor Biography & Musical Philosophy
            </label>
            <textarea
              required
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Describe your musical training, pedagogical approach, repertoire expertise, and performance background..."
              className="w-full rounded-xl bg-white border border-border-default p-3.5 text-xs text-heading placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 leading-relaxed shadow-xs"
            />
            <p className="text-[11px] text-body">
              Must be at least 20 characters. Shown on your faculty profile to prospective students.
            </p>
          </div>

          {/* Instruments & Disciplines Taught (Divided into 1. Expertise and 2. Moderate) */}
          <div className="space-y-4 rounded-2xl bg-bg-alt/20 border border-border-default/80 p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-1">
              <div>
                <label className="text-sm font-bold text-heading flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  <span>Instruments & Disciplines Taught</span>
                </label>
                <p className="text-xs text-body mt-0.5">
                  Divide the subjects you teach into two pedagogical tiers: <strong>1. Expertise</strong> (mastery & concert level) and <strong>2. Moderate</strong> (intermediate & foundational level).
                </p>
              </div>
              <div className="text-[11px] font-medium text-body-muted shrink-0">
                Total: <span className="font-bold text-heading">{expertInstruments.length + moderateInstruments.length}</span> disciplines
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-white border border-border-subtle shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-body-muted pl-1">
                  Category:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {(
                    [
                      { id: "ALL", label: "All Disciplines", icon: Sparkles, count: INSTRUMENTS.length },
                      { id: "INSTRUMENTS", label: "Instruments", icon: Music, count: TEACHER_SKILL_CATEGORIES.INSTRUMENTS.length },
                      { id: "SINGING", label: "Singing", icon: Mic, count: TEACHER_SKILL_CATEGORIES.SINGING.length },
                      { id: "DANCING", label: "Dancing", icon: Sparkles, count: TEACHER_SKILL_CATEGORIES.DANCING.length },
                    ] as const
                  ).map((cat) => {
                    const Icon = cat.icon;
                    const isActive = skillCategoryTab === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSkillCategoryTab(cat.id)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? "bg-heading text-white shadow-xs font-bold"
                            : "bg-bg-alt/60 hover:bg-bg-alt text-heading border border-border-subtle"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                            isActive ? "bg-white/20 text-white" : "bg-white text-body-muted border border-border-subtle"
                          }`}
                        >
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Two Tier Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* TIER 1: EXPERTISE */}
              <div className="rounded-xl bg-white border-2 border-primary/30 p-4 space-y-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-primary/15 text-primary flex items-center justify-center font-bold text-xs">
                        1
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-heading uppercase tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-accent" />
                          <span>Expertise</span>
                        </h4>
                        <p className="text-[11px] text-body-muted">
                          Mastery, concert & advanced technique
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
                      {expertInstruments.length} Active
                    </span>
                  </div>

                  {/* Selected in Expertise */}
                  <div className="min-h-[52px] p-2.5 rounded-lg bg-bg-alt/40 border border-border-subtle flex flex-wrap gap-1.5 items-center">
                    {expertInstruments.length === 0 ? (
                      <span className="text-[11px] text-body-muted italic p-1">
                        No expertise instruments selected yet. Pick from the list below.
                      </span>
                    ) : (
                      expertInstruments.map((inst) => (
                        <div
                          key={inst}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-primary text-white text-xs font-semibold shadow-xs animate-in fade-in duration-150"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                          <span>{inst}</span>
                          <button
                            type="button"
                            onClick={() => moveToModerate(inst)}
                            title="Move to Moderate tier"
                            className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeInstrument(inst)}
                            title="Remove instrument"
                            disabled={expertInstruments.length + moderateInstruments.length <= 1}
                            className="p-1 rounded hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Add to Expertise */}
                <div className="space-y-1.5 pt-2 border-t border-border-subtle/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-body-muted">
                    + Add / Toggle Expertise
                  </span>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto p-2.5 rounded-lg bg-bg-alt/20 border border-border-subtle/80">
                    {displayedSkillGroups.map((group) => (
                      <div key={group.name} className="space-y-1">
                        {skillCategoryTab === "ALL" && (
                          <div className="flex items-center gap-1.5 pt-0.5 px-0.5 text-[10px] font-bold uppercase tracking-wider text-body-muted">
                            <group.icon className="w-3 h-3 text-primary" />
                            <span>{group.name}</span>
                            <span className="text-[9px] text-body-muted/70">({group.items.length})</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {group.items.map((inst) => {
                            const isExpert = expertInstruments.includes(inst);
                            const isModerate = moderateInstruments.includes(inst);
                            return (
                              <button
                                key={inst}
                                type="button"
                                onClick={() => toggleExpert(inst)}
                                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                  isExpert
                                    ? "bg-primary text-white shadow-xs font-bold"
                                    : isModerate
                                    ? "bg-bg-alt border border-border-subtle text-body-muted opacity-60 hover:opacity-100"
                                    : "bg-white border border-border-subtle text-body hover:text-heading hover:border-primary/50"
                                }`}
                              >
                                {isExpert ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                <span>{inst}</span>
                                {isModerate && <span className="text-[9px] text-accent font-bold">(In Moderate)</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* TIER 2: MODERATE */}
              <div className="rounded-xl bg-white border border-border-default p-4 space-y-3 shadow-xs relative overflow-hidden flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-accent/15 text-accent-dark flex items-center justify-center font-bold text-xs">
                        2
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-heading uppercase tracking-wider flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-primary" />
                          <span>Moderate</span>
                        </h4>
                        <p className="text-[11px] text-body-muted">
                          Intermediate instruction & foundation
                        </p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-bg-alt text-heading">
                      {moderateInstruments.length} Active
                    </span>
                  </div>

                  {/* Selected in Moderate */}
                  <div className="min-h-[52px] p-2.5 rounded-lg bg-bg-alt/40 border border-border-subtle flex flex-wrap gap-1.5 items-center">
                    {moderateInstruments.length === 0 ? (
                      <span className="text-[11px] text-body-muted italic p-1">
                        No moderate instruments selected yet. Pick from the list below.
                      </span>
                    ) : (
                      moderateInstruments.map((inst) => (
                        <div
                          key={inst}
                          className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-border-strong text-heading text-xs font-semibold shadow-xs animate-in fade-in duration-150"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                          <span>{inst}</span>
                          <button
                            type="button"
                            onClick={() => moveToExpert(inst)}
                            title="Promote to Expertise tier"
                            className="p-1 rounded hover:bg-primary/10 text-primary transition-colors cursor-pointer"
                          >
                            <ArrowRightLeft className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeInstrument(inst)}
                            title="Remove instrument"
                            disabled={expertInstruments.length + moderateInstruments.length <= 1}
                            className="p-1 rounded hover:bg-rose-50 text-body hover:text-rose-600 transition-colors cursor-pointer disabled:opacity-40"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Add to Moderate */}
                <div className="space-y-1.5 pt-2 border-t border-border-subtle/50">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-body-muted">
                    + Add / Toggle Moderate
                  </span>
                  <div className="space-y-2.5 max-h-48 overflow-y-auto p-2.5 rounded-lg bg-bg-alt/20 border border-border-subtle/80">
                    {displayedSkillGroups.map((group) => (
                      <div key={group.name} className="space-y-1">
                        {skillCategoryTab === "ALL" && (
                          <div className="flex items-center gap-1.5 pt-0.5 px-0.5 text-[10px] font-bold uppercase tracking-wider text-body-muted">
                            <group.icon className="w-3 h-3 text-accent" />
                            <span>{group.name}</span>
                            <span className="text-[9px] text-body-muted/70">({group.items.length})</span>
                          </div>
                        )}
                        <div className="flex flex-wrap gap-1">
                          {group.items.map((inst) => {
                            const isModerate = moderateInstruments.includes(inst);
                            const isExpert = expertInstruments.includes(inst);
                            return (
                              <button
                                key={inst}
                                type="button"
                                onClick={() => toggleModerate(inst)}
                                className={`px-2 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1 ${
                                  isModerate
                                    ? "bg-heading text-white shadow-xs font-bold"
                                    : isExpert
                                    ? "bg-bg-alt border border-border-subtle text-body-muted opacity-60 hover:opacity-100"
                                    : "bg-white border border-border-subtle text-body hover:text-heading hover:border-accent/50"
                                }`}
                              >
                                {isModerate ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                <span>{inst}</span>
                                {isExpert && <span className="text-[9px] text-primary font-bold">(In Expertise)</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Languages Spoken Multi-Select */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-primary" />
              <span>Languages of Instruction</span>
            </label>
            <div className="flex flex-wrap gap-2 p-3.5 rounded-xl bg-bg-alt/30 border border-border-default/60">
              {LANGUAGES.map((lang) => {
                const selected = selectedLanguages.includes(lang);
                return (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => toggleLanguage(lang)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      selected
                        ? "bg-accent text-white shadow-xs"
                        : "bg-white border border-border-default text-body hover:text-heading"
                    }`}
                  >
                    {selected ? "✓ " : "+ "}
                    {lang}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPendingProfile}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold shadow-xs transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isPendingProfile ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Profile...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Studio Profile</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      {/* ── Institutional Payout & Remuneration Details (UPI ID Only) ── */}
      <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs space-y-6">
        <div className="border-b border-border-default pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-serif text-lg font-bold text-heading flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-accent" />
              <span>Payout & Banking Details (UPI ID)</span>
            </h2>
            <p className="text-xs text-body mt-0.5 max-w-xl">
              Enter your UPI ID (VPA). Gandharva administration uses this verified UPI ID to disburse your 1:1 session remuneration directly to your bank account.
            </p>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent-subtle/60 border border-accent/20 text-accent-dark text-xs font-semibold self-start sm:self-auto shrink-0 font-numeric">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span>Remuneration Rate: ₹{((profile?.payoutPerSession || 80000) / 100).toLocaleString("en-IN")}/session</span>
          </div>
        </div>

        <form onSubmit={handleSavePaymentDetails} className="space-y-4 max-w-lg">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-heading flex items-center justify-between">
              <span>Direct UPI ID</span>
              <span className="text-[10px] text-body font-normal font-sans">
                e.g. name@okhdfcbank, 9876543210@paytm, user@ybl
              </span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                placeholder="yourname@okbank or 9876543210@upi"
                className="w-full rounded-xl bg-white border border-border-default pl-3.5 pr-10 py-2.5 text-xs text-heading font-mono placeholder:font-sans placeholder-body/50 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-body/50 pointer-events-none">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[11px] text-body">
              Remuneration is directly credited to the bank account linked with this VPA via Google Pay, PhonePe, Paytm, BHIM, or any UPI app.
            </p>
          </div>

          {paymentError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
              <span>{paymentError}</span>
            </div>
          )}

          {paymentSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
              <Check className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>UPI ID updated successfully!</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isPendingPayment || !upiId.trim()}
            className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-bold transition-all shadow-xs disabled:opacity-40 cursor-pointer active:scale-[0.98] inline-flex items-center gap-2 btn-tactile"
          >
            {isPendingPayment ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving UPI ID...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save UPI ID</span>
              </>
            )}
          </button>
        </form>
      </div>

      {/* Security & Password Form */}
      <div className="rounded-2xl border border-border-default bg-white p-6 shadow-xs space-y-6">
        <div className="border-b border-border-default pb-4">
          <h2 className="font-serif text-lg font-bold text-heading flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" />
            <span>Security & Authentication</span>
          </h2>
          <p className="text-xs text-body mt-0.5">
            Manage your account password and security credentials.
          </p>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
          {passwordError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center gap-2 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{passwordError}</span>
            </div>
          )}

          {passwordSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2 font-medium">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>Password updated successfully!</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-heading">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-heading">
              New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
            <p className="text-[11px] text-body">
              Minimum 8 characters.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-heading">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isPendingPassword}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border-default bg-white hover:bg-neutral-50 text-heading text-xs font-bold transition-all shadow-xs active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              {isPendingPassword ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span>Change Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    

      {/* Update Email Verification Modal */}
      {isUpdateEmailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl bg-white border border-border-default p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border-default/60 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-serif text-base font-bold text-heading">
                    {emailStep === "REQUEST" ? "Update Email Address" : "Verify New Email"}
                  </h3>
                  <p className="text-xs text-body-muted">
                    {emailStep === "REQUEST"
                      ? "A 6-digit code will be dispatched to confirm ownership."
                      : `Enter the 6-digit code dispatched to ${newEmailInput}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUpdateEmailOpen(false)}
                className="p-1 rounded-lg text-body-muted hover:text-heading hover:bg-bg-alt transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Alerts */}
            {emailModalError && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-start gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{emailModalError}</span>
              </div>
            )}
            {emailModalSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2 animate-in fade-in">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{emailModalSuccess}</span>
              </div>
            )}

            {emailStep === "REQUEST" ? (
              <form onSubmit={handleRequestEmailUpdate} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-body-muted">
                    Current Email Address
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentEmail}
                    className="w-full rounded-xl bg-bg-alt/70 border border-border-subtle px-3.5 py-2 text-xs text-body-muted cursor-not-allowed font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-heading">
                    New Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="e.g. maestro@gandharva.org"
                    value={newEmailInput}
                    onChange={(e) => setNewEmailInput(e.target.value)}
                    className="w-full rounded-xl bg-white border border-border-default px-3.5 py-2.5 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-xs"
                  />
                  <p className="text-[11px] text-body-muted">
                    Must be an active email address. We will dispatch a 6-digit confirmation code.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsUpdateEmailOpen(false)}
                    className="px-4 py-2 rounded-xl border border-border-default bg-white text-xs font-semibold text-heading hover:bg-bg-alt transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingEmailOtp || !newEmailInput.trim()}
                    className="px-5 py-2 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                  >
                    {isSendingEmailOtp ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Verification Code</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyEmailUpdate} className="space-y-4">
                <div className="p-3 rounded-xl bg-bg-alt/60 border border-border-subtle flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="text-body-muted">Verifying: </span>
                    <strong className="text-heading font-mono">{newEmailInput}</strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmailStep("REQUEST");
                      setEmailOtpInput("");
                      setEmailModalError(null);
                    }}
                    className="text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                  >
                    Change
                  </button>
                </div>

                <div className="space-y-1.5 text-center">
                  <label className="text-xs font-semibold text-heading block">
                    Enter 6-Digit Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    autoFocus
                    placeholder="••••••"
                    value={emailOtpInput}
                    onChange={(e) => setEmailOtpInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className="w-48 mx-auto text-center font-mono text-2xl font-bold tracking-[0.4em] rounded-xl bg-white border-2 border-primary/40 focus:border-primary px-3 py-2 text-heading focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-xs"
                  />
                  <p className="text-[11px] text-body-muted">
                    Code expires in 15 minutes. Check spam folder if not in inbox.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                  <button
                    type="button"
                    onClick={() => handleRequestEmailUpdate()}
                    disabled={isSendingEmailOtp || emailResendCooldown > 0}
                    className="text-xs font-semibold text-primary hover:text-primary-dark disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isSendingEmailOtp ? "animate-spin" : ""}`} />
                    <span>
                      {emailResendCooldown > 0
                        ? `Resend in ${emailResendCooldown}s`
                        : "Resend Code"}
                    </span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsUpdateEmailOpen(false)}
                      className="px-3.5 py-1.5 rounded-xl border border-border-default bg-white text-xs font-semibold text-heading hover:bg-bg-alt transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifyingEmailOtp || emailOtpInput.length !== 6}
                      className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-dark text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                    >
                      {isVerifyingEmailOtp ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Verifying...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Verify & Update</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
