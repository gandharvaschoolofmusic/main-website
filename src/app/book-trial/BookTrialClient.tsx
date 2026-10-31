"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import Link from "next/link";
import { BookingSummary } from "@/components/auth/BookingSummary";
import {
  CheckCircle2,
  ArrowRight,
  Loader2,
  Info,
  Clock,
  Eye,
  EyeOff,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Search,
  Check,
  Music,
  Mic,
  X,
  Sparkles,
  Piano, Guitar, Drum, ArrowLeft, ChevronDown,
} from "lucide-react";
import { formatInternationalE164 } from "@/lib/phone-utils";
import { createTrialRequestAction } from "@/actions/trial";
import { sendPhoneOtpAction, verifyPhoneOtpForSignupAction } from "@/actions/auth";
import type { ConfirmationResult } from "firebase/auth";
import {
  isFirebaseConfigured,
  createRecaptchaVerifier,
  sendFirebaseOtp,
  confirmFirebaseOtp,
} from "@/lib/firebase";
import "@/components/auth/form-ui.css";
import "./trial-ui.css";
import { SplitHeading } from "@/components/ui/SplitHeading";
import {
  CountryCodeSelector,
  SUPPORTED_COUNTRIES,
  CountryOption,
} from "@/components/ui/CountryCodeSelector";

export interface BookTrialClientProps {
  currentUser?: {
    id: string;
    name: string | null;
    email?: string | null;
    phone?: string | null;
    phoneVerified?: boolean;
    timezone: string;
  } | null;
  isConvertedStudent?: boolean;
}

export interface CatalogItem {
  id: string;
  name: string;
  category: "Instruments" | "Singing";
  subtitle: string;
  tags?: string[];
  iconType:
    | "piano"
    | "acousticGuitar"
    | "electricGuitar"
    | "electronicKeyboard"
    | "flute"
    | "violin"
    | "ukulele"
    | "tabla"
    | "westernVocals"
    | "hindustani"
    | "carnatic"
    | "bollywood"
    | "regionalFilm";
  iconBoxBg?: string;
  defaultIconBg?: string;
  iconColor?: string;
}

export const CATALOG_ITEMS: CatalogItem[] = [
  // ─── INSTRUMENTS ──────────────────────────────────────
  {
    id: "Piano",
    name: "Piano",
    category: "Instruments",
    subtitle: "Beginner friendly",
    tags: ["1-on-1"],
    iconType: "piano",
  },
  {
    id: "Acoustic Guitar",
    name: "Acoustic Guitar",
    category: "Instruments",
    subtitle: "Beginner friendly",
    iconType: "acousticGuitar",
  },
  {
    id: "Electric Guitar",
    name: "Electric Guitar",
    category: "Instruments",
    subtitle: "Beginner friendly",
    iconType: "electricGuitar",
  },
  {
    id: "Electronic Keyboard",
    name: "Electronic Keyboard",
    category: "Instruments",
    subtitle: "1-on-1",
    tags: ["Live"],
    iconType: "electronicKeyboard",
  },
  {
    id: "Flute",
    name: "Flute",
    category: "Instruments",
    subtitle: "Beginner friendly",
    tags: ["1-on-1"],
    iconType: "flute",
  },
  {
    id: "Violin",
    name: "Violin",
    category: "Instruments",
    subtitle: "Beginner friendly",
    tags: ["Live"],
    iconType: "violin",
  },
  {
    id: "Ukulele",
    name: "Ukulele",
    category: "Instruments",
    subtitle: "Beginner friendly",
    tags: ["Live"],
    iconType: "ukulele",
  },
  {
    id: "Tabla",
    name: "Tabla",
    category: "Instruments",
    subtitle: "Beginner friendly",
    tags: ["Live"],
    iconType: "tabla",
  },

  // ─── SINGING ──────────────────────────────────────────
  {
    id: "Western Vocals",
    name: "Western Vocals",
    category: "Singing",
    subtitle: "Beginner friendly",
    iconType: "westernVocals",
    iconBoxBg: "bg-rose-50 text-rose-500",
  },
  {
    id: "Hindustani Classical Vocals (North India)",
    name: "Hindustani Classical Vocals",
    category: "Singing",
    subtitle: "North Indian tradition",
    iconType: "hindustani",
    iconBoxBg: "bg-purple-100/70 text-purple-700",
  },
  {
    id: "Carnatic Classical Vocals (South India)",
    name: "Carnatic Classical",
    category: "Singing",
    subtitle: "South India",
    iconType: "carnatic",
    iconBoxBg: "bg-orange-100/70 text-[#FF7803]",
  },
  {
    id: "Bollywood & Light Vocals (North India)",
    name: "Bollywood & Light Vocals",
    category: "Singing",
    subtitle: "North Indian tradition",
    iconType: "bollywood",
    iconBoxBg: "bg-purple-100/70 text-purple-700",
  },
  {
    id: "Malayalam Film Music",
    name: "Malayalam Film Music",
    category: "Singing",
    subtitle: "North Indian tradition",
    iconType: "regionalFilm",
    iconBoxBg: "bg-rose-50 text-rose-500",
  },
  {
    id: "Tamil Film Music",
    name: "Tamil Film Music",
    category: "Singing",
    subtitle: "North Indian tradition",
    iconType: "regionalFilm",
    iconBoxBg: "bg-orange-50 text-[#FF7803]",
  },
  {
    id: "Telugu Film Music",
    name: "Telugu Film Music",
    category: "Singing",
    subtitle: "North Indian tradition",
    iconType: "regionalFilm",
    iconBoxBg: "bg-orange-50 text-[#FF7803]",
  },
  {
    id: "Kannada Film Music",
    name: "Kannada Film Music",
    category: "Singing",
    subtitle: "North Indian tradition",
    iconType: "regionalFilm",
    iconBoxBg: "bg-orange-50 text-[#FF7803]",
  },
];

function CategoryIcon({ type }: { type: CatalogItem["iconType"] }) {
  const Icon = type === "piano" || type === "electronicKeyboard" ? Piano
    : ["acousticGuitar", "electricGuitar", "ukulele"].includes(type) ? Guitar
    : type === "tabla" ? Drum : ["westernVocals", "hindustani", "carnatic", "bollywood", "regionalFilm"].includes(type) ? Mic : Music;
  return <Icon size={22} strokeWidth={1.7} aria-hidden="true"/>;
}

const HOURS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const POPULAR_SLOTS = [
  "9:00 AM",
  "9:30 AM",
  "10:00 AM",
  "10:30 AM",
  "11:00 AM",
  "11:30 AM",
  "4:00 PM",
  "5:00 PM",
  "6:00 PM",
  "7:00 PM",
];

const AGE_GROUPS = [
  { id: "4-7", label: "Kids", range: "4 - 7 years", desc: "Foundational ear-training, rhythm games & early finger dexterity" },
  { id: "8-12", label: "Children", range: "8 - 12 years", desc: "Structured technique, notation reading & performance songs" },
  { id: "13-17", label: "Teens", range: "13 - 17 years", desc: "Trinity/ABRSM grade tracks, raga theory & contemporary styling" },
  { id: "18+", label: "Adults", range: "18+ years", desc: "Flexible pacing, hobbyist to advanced classical mastery" },
];

export function BookTrialClient({ currentUser, isConvertedStudent }: BookTrialClientProps) {
  // If student is already converted or has active enrollments, free trials are restricted
  if (isConvertedStudent) {
    return (
      <div className="mx-auto max-w-xl px-4 sm:px-6 pt-4 sm:pt-8 animate-fadeIn">
        <div className="relative overflow-hidden rounded-3xl border border-surface-muted/90 bg-white/95 p-8 sm:p-10 shadow-xl shadow-primary/5 backdrop-blur-md">
          {/* Top Apple-style accent gradient line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary via-cta to-accent" />

          <div className="text-center space-y-5">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary border border-primary/20 shadow-xs">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                <span>Enrolled Student Account</span>
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-extrabold text-heading tracking-tight">
                Welcome back, {currentUser?.name || "Student"}!
              </h2>
            </div>

            <p className="text-sm sm:text-base text-body leading-relaxed max-w-md mx-auto">
              Complimentary free trials are exclusively reserved for new prospective students joining Gandharva School of Music.
            </p>

            <div className="p-4 sm:p-5 rounded-2xl bg-bg-alt/50 border border-surface-muted/80 text-left text-xs sm:text-sm text-body space-y-2.5">
              <p className="font-bold text-heading flex items-center gap-2">
                <Music className="w-4 h-4 text-cta shrink-0" />
                <span>Want to learn an additional instrument or discipline?</span>
              </p>
              <p className="text-body leading-relaxed">
                As an enrolled student, you can explore our complete accredited curriculum and request course admission directly from your student portal without needing a trial.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/student/dashboard/courses"
                className="btn-tactile w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-cta hover:bg-cta-hover text-white font-bold text-sm shadow-md shadow-cta/25 transition-all"
              >
                <span>Browse Course Catalog</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/student/dashboard"
                className="btn-tactile w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl border border-surface-muted/90 bg-white hover:bg-bg-alt/30 text-heading font-semibold text-sm transition-all shadow-xs"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <TrialBookingForm currentUser={currentUser}/>;
}

function TrialBookingForm({ currentUser }: Pick<BookTrialClientProps, "currentUser">) {
  // Wizard step: 1 = Category, 2 = Date/Time, 3 = Details & Age Group, 4 = Success
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const stepRef = useRef<HTMLDivElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    stepRef.current?.focus({ preventScroll: true });
    stepRef.current?.scrollIntoView({ block: "start", behavior: "instant" });
  }, [step]);


  // Step 1: Category & Instrument selection
  const [selectedCategory, setSelectedCategory] = useState<"Instruments" | "Singing">("Singing");
  const [selectedInstrument, setSelectedInstrument] = useState<string>("Bollywood & Light Vocals (North India)");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"All" | "Instruments" | "Singing">("All");

  // Filtered catalog items based on tab and live search
  const filteredItems = CATALOG_ITEMS.filter((item) => {
    const matchesFilter = filterTab === "All" || item.category === filterTab;
    if (!matchesFilter) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.name.toLowerCase().includes(q) ||
      item.subtitle.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.tags && item.tags.some((t) => t.toLowerCase().includes(q)))
    );
  });

  const instrumentsList = filteredItems.filter((i) => i.category === "Instruments");
  const singingList = filteredItems.filter((i) => i.category === "Singing");

  const selectedItemObj = CATALOG_ITEMS.find((item) => item.id === selectedInstrument);
  const selectedDisplayName = selectedItemObj?.name || selectedInstrument || "Select an instrument or style";

  // Step 2: Date & Time slot
  const [dates] = useState(() => {
    const list = [];
    const today = new Date();
    for (let i = 0; i < 10; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      list.push(d);
    }
    return list;
  });

  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [selectedHour, setSelectedHour] = useState("10");
  const [selectedMinute, setSelectedMinute] = useState("00");
  const [selectedPeriod, setSelectedPeriod] = useState<"AM" | "PM">("AM");

  // Live formatted slot (e.g. "10:00 AM")
  const selectedSlot = `${selectedHour}:${selectedMinute} ${selectedPeriod}`;

  const handleSelectPreset = (preset: string) => {
    const [time, p] = preset.split(" ");
    const [h, m] = time.split(":");
    setSelectedHour(String(parseInt(h, 10)));
    setSelectedMinute(m);
    setSelectedPeriod((p as "AM" | "PM") || "AM");
  };

  // Step 3: Age group & Contact details
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>("Children (8 - 12 years)");
  const [studentName, setStudentName] = useState(currentUser?.name || "");
  const [studentEmail, setStudentEmail] = useState(currentUser?.email || "");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption>(() => {
    if (currentUser?.phone) {
      const matched = SUPPORTED_COUNTRIES.find((c) =>
        currentUser.phone?.startsWith(c.dialCode)
      );
      if (matched) return matched;
    }
    return SUPPORTED_COUNTRIES[0];
  });
  const [studentPhone, setStudentPhone] = useState(() => {
    if (currentUser?.phone) {
      const matched = SUPPORTED_COUNTRIES.find((c) =>
        currentUser.phone?.startsWith(c.dialCode)
      );
      if (matched) {
        return currentUser.phone.slice(matched.dialCode.length).trim();
      }
      return currentUser.phone;
    }
    return "";
  });
  const [studentNotes, setStudentNotes] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Phone OTP verification state
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isPhoneVerified, setIsPhoneVerified] = useState(!!currentUser?.phoneVerified);
  const [verifiedOtpCode, setVerifiedOtpCode] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpBanner, setOtpBanner] = useState<{ message: string } | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [firebaseConfirmation, setFirebaseConfirmation] = useState<ConfirmationResult | null>(null);
  const [firebaseIdToken, setFirebaseIdToken] = useState<string>("");

  const [isSendingOtp, startSendOtpTransition] = useTransition();
  const [isVerifyingOtp, startVerifyOtpTransition] = useTransition();
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cooldown countdown for OTP resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Compute full international phone number
  const getFullPhoneNumber = () => {
    return formatInternationalE164(selectedCountry.dialCode, studentPhone);
  };

  // Pre-warm the reCAPTCHA verifier in the background
  useEffect(() => {
    if (isFirebaseConfigured()) {
      try {
        const v = createRecaptchaVerifier("trial-recaptcha-container");
        v?.render().catch(() => {});
      } catch {}
    }
  }, []);

  const handleSendOtp = () => {
    setPhoneError(null);
    setOtpError(null);
    setOtpBanner(null);

    const cleanDigits = studentPhone.replace(/\D/g, "");
    if (!cleanDigits) {
      setPhoneError("Please enter your mobile phone number.");
      return;
    }

    if (cleanDigits.length < 6) {
      setPhoneError("Please enter a valid phone number.");
      return;
    }

    const fullPhone = getFullPhoneNumber();

    startSendOtpTransition(async () => {
      try {
        if (isFirebaseConfigured()) {
          const verifier = createRecaptchaVerifier("trial-recaptcha-container");
          if (!verifier) {
            setPhoneError("Failed to initialize security verification. Please refresh.");
            return;
          }

          const [dbRes, fbRes] = await Promise.all([
            sendPhoneOtpAction(fullPhone, "SIGNUP"),
            sendFirebaseOtp(fullPhone, verifier),
          ]);

          if (!dbRes.success) {
            setPhoneError(dbRes.error || "Failed to dispatch verification code.");
            return;
          }

          if (!fbRes.success || !fbRes.confirmationResult) {
            setPhoneError(fbRes.error || "Failed to dispatch SMS via Firebase.");
            return;
          }

          setFirebaseConfirmation(fbRes.confirmationResult);
        } else {
          const res = await sendPhoneOtpAction(fullPhone, "SIGNUP");
          if (!res.success) {
            setPhoneError(res.error || "Failed to dispatch verification code.");
            return;
          }
        }

        setOtpSent(true);
        setResendCooldown(30);
        setOtpBanner({
          message: `A 6-digit verification code has been dispatched to ${fullPhone}.`,
        });
      } catch (err: any) {
        setPhoneError(err?.message || "Failed to dispatch verification code.");
      }
    });
  };

  const handleVerifyOtp = (codeOverride?: string) => {
    setOtpError(null);
    const trimmedCode = (codeOverride || otpCode).trim();

    if (trimmedCode.length !== 6) {
      setOtpError("Please enter the complete 6-digit OTP code.");
      return;
    }

    const fullPhone = getFullPhoneNumber();

    startVerifyOtpTransition(async () => {
      let idTokenToPass: string | undefined = undefined;

      if (firebaseConfirmation) {
        const confirmRes = await confirmFirebaseOtp(firebaseConfirmation, trimmedCode);
        if (!confirmRes.success || !confirmRes.idToken) {
          setOtpError(confirmRes.error || "Invalid verification code.");
          setOtpCode("");
          return;
        }
        idTokenToPass = confirmRes.idToken;
        setFirebaseIdToken(confirmRes.idToken);
      }

      const res = await verifyPhoneOtpForSignupAction(fullPhone, trimmedCode, idTokenToPass);
      if (!res.success) {
        setOtpError(res.error || "Invalid or expired OTP code.");
        setOtpCode("");
      } else {
        setIsPhoneVerified(true);
        setVerifiedOtpCode(trimmedCode);
        setOtpBanner(null);
        setPhoneError(null);
        setOtpError(null);
      }
    });
  };

  const handleChangePhone = () => {
    setIsPhoneVerified(false);
    setOtpSent(false);
    setOtpCode("");
    setVerifiedOtpCode("");
    setFirebaseConfirmation(null);
    setFirebaseIdToken("");
    setOtpBanner(null);
    setPhoneError(null);
    setOtpError(null);
  };

  // Selected date formatting
  const activeDate = dates[selectedDateIndex] || new Date();
  const activeDateFormatted = activeDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const year = activeDate.getFullYear();
  const month = String(activeDate.getMonth() + 1).padStart(2, "0");
  const day = String(activeDate.getDate()).padStart(2, "0");
  const dateIsoString = `${year}-${month}-${day}`;

  const handleSubmitBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!selectedInstrument) {
      setErrorMessage("Please select a musical discipline or instrument.");
      setStep(1);
      return;
    }
    if (!selectedSlot) {
      setErrorMessage("Please pick your preferred trial lesson time.");
      setStep(2);
      return;
    }
    if (!selectedAgeGroup) {
      setErrorMessage("Please select the student age group.");
      return;
    }
    if (!studentName.trim() || !studentEmail.trim()) {
      setErrorMessage("Please enter student name and email.");
      return;
    }

    // Unauthenticated account creation validation
    if (!currentUser) {
      if (!studentPhone.trim()) {
        setErrorMessage("Mobile phone number is mandatory to book a trial lesson.");
        return;
      }
      if (!isPhoneVerified && otpCode.trim().length !== 6) {
        setErrorMessage("Mobile phone verification via OTP is mandatory. Please enter and verify the 6-digit code sent to your phone.");
        return;
      }
      if (!password) {
        setErrorMessage("Please create a password for your student account.");
        return;
      }
      if (password.length < 6) {
        setErrorMessage("Password must be at least 6 characters.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage("Passwords do not match. Please re-enter.");
        return;
      }
    }

    const detectedTz =
      typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
    const studentTz =
      currentUser?.timezone && currentUser.timezone !== "UTC"
        ? currentUser.timezone
        : detectedTz || "UTC";

    startTransition(async () => {
      const res = await createTrialRequestAction({
        category: selectedCategory,
        instrument: selectedInstrument,
        requestedDate: dateIsoString,
        timeSlot: selectedSlot,
        timezone: studentTz,
        ageGroup: selectedAgeGroup,
        studentName,
        studentEmail,
        studentPhone: getFullPhoneNumber() || undefined,
        otpCode: !currentUser ? (verifiedOtpCode || otpCode) : undefined,
        firebaseIdToken: !currentUser ? (firebaseIdToken || undefined) : undefined,
        studentNotes: studentNotes || undefined,
        password: !currentUser ? password : undefined,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to book trial lesson.");
      } else {
        setStep(4);
      }
    });
  };

  // Step indicator labels
  const steps = [
    { num: 1, label: "Category" },
    { num: 2, label: "Date & Time" },
    { num: 3, label: "Your Details" },
  ];

  // Input class reusable
  const inputClass =
    "block w-full rounded-xl border border-surface-muted/90 bg-white px-3.5 py-2.5 text-sm text-heading placeholder-body/40 shadow-sm transition-all focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-heading mb-1.5";

  return (
    <div className="trial-layout entry-fields">
      <aside className="trial-sidebar">
        <BookingSummary
          discipline={selectedDisplayName}
          date={step >= 2 ? activeDateFormatted : undefined}
          time={selectedSlot}
          onEditDiscipline={step > 1 && step < 4 ? () => setStep(1) : undefined}
          onEditSchedule={step === 3 ? () => setStep(2) : undefined}
        />
        <p className="trial-review-note">Your preferred schedule will be reviewed before a teacher is assigned.</p>
      </aside>
      <div className="trial-main" ref={stepRef} tabIndex={-1} aria-label={`Trial booking, step ${step} of ${step === 4 ? 4 : 3}`}>
        <h1 className="trial-page-title">Book your free trial</h1>
      {step < 4 && <nav className="trial-progress" aria-label="Booking progress">{steps.map(({num,label}) => <button key={num} type="button" aria-current={step === num ? "step" : undefined} disabled={num === 2 ? !selectedInstrument : num === 3 ? !selectedInstrument || !selectedSlot : false} onClick={() => setStep(num as 1 | 2 | 3)}><span>{step > num ? <Check size={16}/> : num}</span><strong>{label}</strong></button>)}</nav>}
      {errorMessage && step !== 3 && <div role="alert" className="trial-error"><AlertCircle size={18}/>{errorMessage}</div>}
      {step === 1 && <section className="trial-surface">
        <header className="trial-section-heading"><span>Step 1 of 3</span><h2>What would you like to learn?</h2><p>Choose an instrument or singing style to get started.</p></header>
        <div className="trial-catalog-toolbar">
          <div className="trial-filters" role="group" aria-label="Course categories">{(["All","Instruments","Singing"] as const).map(tab => <button key={tab} type="button" aria-pressed={filterTab === tab} onClick={() => setFilterTab(tab)}>{tab}</button>)}</div>
          <div className="trial-search"><Search size={18}/><input aria-label="Search instruments or styles" value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder="Search courses"/>{searchQuery && <button type="button" aria-label="Clear course search" onClick={() => setSearchQuery("")}><X size={17}/></button>}</div>
        </div>
        {filteredItems.length === 0 ? <div className="trial-empty"><Search size={28}/><h3>No matching courses</h3><p>Try another instrument or singing style.</p><button type="button" onClick={() => {setSearchQuery("");setFilterTab("All");}}>Clear filters</button></div> : <div className="trial-catalog">{[{name:"Instruments",items:instrumentsList},{name:"Singing",items:singingList}].filter(group => group.items.length).map(group => <section key={group.name} className="trial-category"><h3>{group.name}<span>{group.items.length}</span></h3><div className="trial-course-grid">{group.items.map(item => <button key={item.id} type="button" className="trial-course" aria-pressed={selectedInstrument === item.id} onClick={() => {setSelectedInstrument(item.id);setSelectedCategory(item.category);}}><span className="trial-course-icon"><CategoryIcon type={item.iconType}/></span><span className="trial-course-copy"><strong>{item.name}</strong><small>{item.subtitle}{item.tags?.length ? ` · ${item.tags.join(" · ")}` : ""}</small></span><span className="trial-course-check">{selectedInstrument === item.id && <Check size={14}/>}</span></button>)}</div></section>)}</div>}
        <footer className="trial-actions"><p><span>Selected</span><strong>{selectedDisplayName}</strong></p><button type="button" className="entry-primary" disabled={!selectedInstrument} onClick={() => setStep(2)}>Choose a time <ArrowRight size={18}/></button></footer>
      </section>}
      {step === 2 && <section className="trial-surface">
        <header className="trial-section-heading"><span>Step 2 of 3</span><h2>When is a good time?</h2><p>Choose your preferred date and time for the lesson.</p></header>
        <h3 className="trial-field-title">Choose a date</h3>
        <div className="trial-dates" role="group" aria-label="Preferred lesson date">{dates.map((date,index) => <button key={index} type="button" aria-pressed={selectedDateIndex === index} aria-label={date.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"})} onClick={() => setSelectedDateIndex(index)}><small>{index === 0 ? "Today" : date.toLocaleDateString("en-US",{weekday:"short"})}</small><strong>{date.getDate()}</strong><small>{date.toLocaleDateString("en-US",{month:"short"})}</small></button>)}</div>
        <h3 className="trial-field-title">Choose your preferred time</h3>
        <div className="trial-custom-time-card">
          <div className="trial-time-controls-row">
            {/* Hour Selector */}
            <div className="trial-time-col">
              <label htmlFor="trialHourSelect" className="trial-time-col-label">Hour</label>
              <div className="trial-time-select-wrap">
                <select
                  id="trialHourSelect"
                  aria-label="Select hour"
                  value={selectedHour}
                  onChange={(e) => setSelectedHour(e.target.value)}
                  className="trial-time-select"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="trial-time-select-icon" aria-hidden="true" />
              </div>
            </div>

            <span className="trial-time-colon-separator" aria-hidden="true">:</span>

            {/* Minute Selector */}
            <div className="trial-time-col">
              <label htmlFor="trialMinuteSelect" className="trial-time-col-label">Minute</label>
              <div className="trial-time-select-wrap">
                <select
                  id="trialMinuteSelect"
                  aria-label="Select minute"
                  value={selectedMinute}
                  onChange={(e) => setSelectedMinute(e.target.value)}
                  className="trial-time-select"
                >
                  {MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <ChevronDown size={18} className="trial-time-select-icon" aria-hidden="true" />
              </div>
            </div>

            {/* AM / PM Segmented Control */}
            <div className="trial-time-col trial-time-col-period">
              <span className="trial-time-col-label">Time of Day</span>
              <div className="trial-ampm-switch" role="radiogroup" aria-label="Time of day">
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedPeriod === "AM"}
                  onClick={() => setSelectedPeriod("AM")}
                  className={`trial-ampm-btn ${selectedPeriod === "AM" ? "active" : ""}`}
                >
                  AM
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedPeriod === "PM"}
                  onClick={() => setSelectedPeriod("PM")}
                  className={`trial-ampm-btn ${selectedPeriod === "PM" ? "active" : ""}`}
                >
                  PM
                </button>
              </div>
            </div>
          </div>

          {/* Quick select popular times */}
          <div className="trial-popular-section">
            <span className="trial-popular-label">Or quick pick a popular time:</span>
            <div className="trial-popular-grid" role="group" aria-label="Popular time slots">
              {POPULAR_SLOTS.map((slot) => {
                const isSelected = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => handleSelectPreset(slot)}
                    className={`trial-popular-btn ${isSelected ? "active" : ""}`}
                  >
                    {slot}
                    {isSelected && <Check size={14} className="inline ml-1.5" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <p className="trial-time-note"><Clock size={16}/>Times are shown in your local time.</p>
        <footer className="trial-actions"><button type="button" className="trial-back" onClick={() => setStep(1)}><ArrowLeft size={16}/>Back</button><button type="button" className="entry-primary" disabled={!selectedSlot} onClick={() => setStep(3)}>Your details <ArrowRight size={18}/></button></footer>
      </section>}
      {/* ============ STEP 3: ACCOUNT DETAILS & AGE GROUP ============ */}
      {step === 3 && (
        <form
          onSubmit={handleSubmitBooking}
          className="trial-surface trial-details"
        >

          <div className="space-y-6">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-heading tracking-tight">
                Student Age Group & Details
              </h2>
              <p className="text-xs text-body mt-1">
                Select the student age group so our director can match you with the ideal instructor.
              </p>
            </div>

            {/* Error Alert */}
            {errorMessage && (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-xl border border-error/30 bg-error-muted/40 p-3.5 text-xs text-error font-medium"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Age Group Selection Cards */}
            <div className="space-y-2">
              <label className={labelClass}>
                Choose Student Age Group *
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {AGE_GROUPS.map((g) => {
                  const isSelected = selectedAgeGroup.includes(g.range);
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedAgeGroup(`${g.label} (${g.range})`)}
                      aria-pressed={isSelected}
                      className={`p-3.5 rounded-xl text-left transition-all flex flex-col justify-between ${
                        isSelected
                          ? "bg-primary/8 ring-2 ring-primary/30 shadow-sm"
                          : "bg-bg-alt/20 hover:bg-bg-alt/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold text-sm ${isSelected ? "text-primary" : "text-heading"}`}>
                          {g.label} ({g.range})
                        </span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-cta" />}
                      </div>
                      <p className="text-[11px] text-body/60 mt-1.5 leading-relaxed">
                        {g.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Student Contact Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="studentName" className={labelClass}>
                  Student Full Name *
                </label>
                <input
                  id="studentName" autoComplete="name"
                  type="text"
                  required
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="e.g. Aisha Patel"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="studentEmail" className={labelClass}>
                  Email Address *
                </label>
                <input
                  id="studentEmail" autoComplete="email"
                  type="email"
                  required
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              {/* Mobile Phone Verification */}
              <div className="entry-verification sm:col-span-2 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-primary" />
                    <span className="entry-verification-title">
                      Mobile Number Verification
                    </span>
                  </div>
                  {!currentUser ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-accent-subtle text-accent-dark border border-accent/30">
                      Mandatory
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {isPhoneVerified ? "Verified" : "Optional"}
                    </span>
                  )}
                </div>

                {/* Error alert */}
                {(phoneError || otpError) && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-xl border border-error/30 bg-error-muted/40 p-2.5 text-xs text-error font-medium"
                  >
                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-error" />
                    <span>{phoneError || otpError}</span>
                  </div>
                )}

                {/* OTP Confirmation banner - Dev Test OTP completely removed */}
                {otpBanner && !isPhoneVerified && (
                  <div className="rounded-xl border border-accent/40 bg-accent-subtle/70 p-3 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 text-accent-dark font-bold">
                      <CheckCircle2 className="w-3.5 h-3.5 text-accent-dark" />
                      <span>{otpBanner.message}</span>
                    </div>
                  </div>
                )}

                {/* Invisible reCAPTCHA container for Firebase */}
                <div id="trial-recaptcha-container" className="hidden" aria-hidden="true" />

                {/* Verified State */}
                {isPhoneVerified ? (
                  <div className="flex items-center justify-between rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <p className="font-bold text-emerald-950 font-mono">{getFullPhoneNumber()}</p>
                        <p className="text-[10px] text-emerald-700">Phone verified successfully via OTP</p>
                      </div>
                    </div>
                    {!currentUser && (
                      <button
                        type="button"
                        onClick={handleChangePhone}
                        className="text-xs font-semibold text-body hover:text-heading underline cursor-pointer"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  /* Phone input with CountryCodeSelector + Send OTP */
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* Country Code Selector + Phone Input Container */}
                      <div className="entry-phone flex-1 flex items-center">
                        <CountryCodeSelector
                          showDialCodeInButton
                          selectedCountry={selectedCountry}
                          onSelect={(country) => {
                            setSelectedCountry(country);
                            setPhoneError(null);
                          }}
                        />
                        <div className="h-6 w-px bg-border-default/80 shrink-0" />
                        <input
                          id="studentPhone"
                          aria-label="Mobile phone number" autoComplete="tel-national"
                          type="tel"
                          inputMode="tel"
                          value={studentPhone}
                          onChange={(e) => {
                            setStudentPhone(e.target.value);
                            setPhoneError(null);
                          }}
                          placeholder="Enter a phone number"
                          disabled={otpSent}
                          className="block flex-1 border-0 bg-transparent px-3.5 py-2 text-sm text-heading placeholder-body/40 focus:outline-none focus:ring-0 disabled:opacity-75 disabled:cursor-not-allowed"
                        />
                      </div>

                      <button
                        type="button"
                        disabled={isSendingOtp || resendCooldown > 0 || !studentPhone.trim()}
                        onClick={handleSendOtp}
                        className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs btn-tactile active:scale-[0.98]"
                      >
                        {isSendingOtp ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                        ) : resendCooldown > 0 ? (
                          <span>Resend ({resendCooldown}s)</span>
                        ) : (
                          <span>{otpSent ? "Resend OTP" : "Send OTP"}</span>
                        )}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-body-muted">
                      <span>
                        Includes country code: <strong className="font-mono text-heading">{selectedCountry.dialCode}</strong> ({selectedCountry.name})
                      </span>
                      {otpSent && !isPhoneVerified && (
                        <button
                          type="button"
                          onClick={handleChangePhone}
                          className="font-semibold text-blue-600 hover:underline cursor-pointer"
                        >
                          Change number
                        </button>
                      )}
                    </div>

                    {/* 6-Digit OTP verification block */}
                    {otpSent && (
                      <div className="p-3.5 rounded-2xl bg-white border border-border-default/80 space-y-3 animate-fade-in shadow-xs">
                        <div className="flex items-center justify-between">
                          <label
                            htmlFor="trial-otp-input"
                            className="block text-xs font-bold uppercase tracking-wider text-heading"
                          >
                            Enter 6-Digit OTP Code
                          </label>
                          <span className="text-[11px] text-body">
                            Sent to <strong className="font-mono text-heading">{getFullPhoneNumber()}</strong>
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <input
                            id="trial-otp-input"
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "");
                              setOtpCode(val);
                              if (val.length === 6) {
                                handleVerifyOtp(val);
                              }
                            }}
                            placeholder="••••••"
                            className="block flex-1 rounded-xl border border-surface-muted/90 bg-white px-3 py-2.5 text-center text-lg tracking-[0.3em] font-mono font-bold text-heading placeholder:tracking-normal placeholder:font-sans placeholder-body/40 shadow-xs focus:border-cta focus:outline-none focus:ring-4 focus:ring-cta/15"
                          />
                          <button
                            type="button"
                            disabled={isVerifyingOtp || otpCode.trim().length !== 6}
                            onClick={() => handleVerifyOtp()}
                            className="px-5 py-2.5 rounded-xl bg-cta hover:bg-cta-hover text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs btn-tactile active:scale-[0.98]"
                          >
                            {isVerifyingOtp ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                            ) : (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                                <span>Verify Code</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Password fields - only for unauthenticated users */}
              {!currentUser && (
                <>
                  <div>
                    <label htmlFor="password" className={labelClass}>
                      Create Password *
                    </label>
                    <div className="relative">
                      <input
                        id="password" autoComplete="new-password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 6 characters"
                        className={inputClass + " pr-11"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-body/50 hover:text-heading hover:bg-surface-subtle transition-all active:scale-95 cursor-pointer"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        title={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4 text-heading/70" />
                        ) : (
                          <Eye className="w-4 h-4 text-body/60" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirmPassword" className={labelClass}>
                      Confirm Password *
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword" autoComplete="new-password"
                        type={showConfirmPassword ? "text" : "password"}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className={inputClass + " pr-11"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-body/50 hover:text-heading hover:bg-surface-subtle transition-all active:scale-95 cursor-pointer"
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        title={showConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4 text-heading/70" />
                        ) : (
                          <Eye className="w-4 h-4 text-body/60" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Account creation info note */}
                  <div className="sm:col-span-2">
                    <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 p-3 text-xs text-body leading-relaxed">
                      <Info className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                      <span>
                        Your password will be used to log in to your Gandharva Student Portal to access your classroom and scheduled sessions.
                      </span>
                    </div>
                  </div>
                </>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="studentNotes" className={labelClass}>
                  Prior Musical Background (Optional)
                </label>
                <textarea
                  id="studentNotes"
                  rows={2}
                  value={studentNotes}
                  onChange={(e) => setStudentNotes(e.target.value)}
                  placeholder="e.g. Total beginner; interested in Bollywood film songs and voice modulation."
                  className={inputClass}
                />
              </div>
            </div>

            {/* Booking Summary */}
            <div className="p-3.5 rounded-xl bg-bg-alt/25 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-body/60">Selected: </span>
                <strong className="text-cta font-semibold">{selectedInstrument}</strong>
              </div>
              <div>
                <span className="text-body/60">Schedule: </span>
                <strong className="text-heading">{activeDateFormatted} at {selectedSlot}</strong>
              </div>
            </div>

            {!currentUser && !isPhoneVerified && <p className="text-xs text-body">Verify your phone number above to request your trial.</p>}
            {/* Action Row */}
            <div className="trial-actions trial-submit-actions">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2.5 rounded-xl bg-bg-alt/30 text-body hover:text-heading text-xs font-bold transition-colors"
              >
                Previous
              </button>
              <button
                type="submit"
                disabled={isPending || (!currentUser && !isPhoneVerified)}
                className={`btn-tactile flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white shadow-md transition-all cursor-pointer ${
                  !currentUser && !isPhoneVerified
                    ? "bg-neutral-400 cursor-not-allowed opacity-75 shadow-none"
                    : "bg-primary hover:bg-primary-light shadow-primary/20"
                }`}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Processing Trial Booking...</span>
                  </>
                ) : (
                  <>
                    <span>
                      {currentUser
                        ? "Submit Trial Request"
                        : !isPhoneVerified
                        ? "Request free trial"
                        : "Create Account & Book"}
                    </span>
                    <CheckCircle2 className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* ============ STEP 4: SUCCESS SCREEN ============ */}
      {step === 4 && (
        <div className="trial-surface trial-details">

          <div className="trial-success space-y-6">
            <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center text-green-500 mx-auto shadow-md shadow-green-100">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cta">
                Free Trial Request Registered
              </span>
              <SplitHeading
                as="h2"
                firstClause="Your Lesson Preference"
                accentClause="Has Been Received!"
                align="center"
                size="md"
              />
              <p className="text-xs sm:text-sm text-body max-w-lg mx-auto leading-relaxed">
                Our academic director will review your schedule and assign the perfect master instructor tailored for this age group.
              </p>
            </div>

            {/* Request Recap Card */}
            <div className="max-w-md mx-auto p-5 rounded-xl bg-bg-alt/25 text-left space-y-3">
              <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: "1px solid var(--color-surface-muted, #e5e5e5)" }}>
                <span className="text-xs text-body/60">Category & Discipline</span>
                <span className="text-xs font-bold text-cta">{selectedInstrument}</span>
              </div>
              <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: "1px solid var(--color-surface-muted, #e5e5e5)" }}>
                <span className="text-xs text-body/60">Requested Time</span>
                <span className="text-xs font-bold text-heading">{activeDateFormatted} at {selectedSlot}</span>
              </div>
              <div className="flex items-center justify-between pb-2.5" style={{ borderBottom: "1px solid var(--color-surface-muted, #e5e5e5)" }}>
                <span className="text-xs text-body/60">Student Age Group</span>
                <span className="text-xs font-bold text-primary">{selectedAgeGroup}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-body/60">Allotment Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-cta/10 text-cta animate-pulse">
                  <Clock className="w-3 h-3" /> Pending Admin Allotment
                </span>
              </div>
            </div>

            {!currentUser && (
              <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 p-3.5 text-xs text-body leading-relaxed max-w-md mx-auto">
                <Info className="w-4 h-4 shrink-0 text-primary mt-0.5" />
                <span>
                  Your student account has been created! Sign in with your email and password to access your dashboard and upcoming lessons.
                </span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
              {currentUser ? (
                <Link
                  href="/student/dashboard"
                  className="btn-tactile w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-light text-white font-bold text-sm shadow-md shadow-primary/20 transition-all text-center"
                >
                  Go to Student Dashboard
                </Link>
              ) : (
                <Link
                  href="/login"
                  className="btn-tactile w-full sm:w-auto px-6 py-3 rounded-xl bg-primary hover:bg-primary-light text-white font-bold text-sm shadow-md shadow-primary/20 transition-all text-center"
                >
                  Sign In to Student Dashboard
                </Link>
              )}
              <Link
                href="/"
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-bg-alt/30 hover:bg-bg-alt/50 text-heading text-sm font-bold transition-all text-center"
              >
                Back to Home
              </Link>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
