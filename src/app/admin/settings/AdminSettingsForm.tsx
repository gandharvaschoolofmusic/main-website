"use client";

import { useState, useTransition } from "react";
import { updatePlatformSettingsAction } from "@/actions/admin";
import {
  Ticket,
  Save,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Shield,
  Mail,
  Coins,
  Database,
  Cloud,
  Check,
  Server,
} from "lucide-react";

interface AdminSettingsFormProps {
  initialSettings: {
    freeTrialLessonCount: number;
    storageProvider?: string;
  };
}

export function AdminSettingsForm({ initialSettings }: AdminSettingsFormProps) {
  const [trialCount, setTrialCount] = useState<number>(
    initialSettings.freeTrialLessonCount,
  );
  const [contactEmail, setContactEmail] = useState(
    "admissions@gandharvaschoolofmusic.com",
  );
  const [currency] = useState("INR (₹)");
  const [maintenanceMode, setMaintenanceMode] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(false);

    startTransition(async () => {
      const res = await updatePlatformSettingsAction({
        freeTrialLessonCount: trialCount,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to update platform settings.");
      } else {
        setSuccessMessage(true);
        setTimeout(() => setSuccessMessage(false), 3000);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Platform configuration saved and persisted successfully!</span>
        </div>
      )}

      {/* Trial Allocations Card */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-primary/10 pb-3">
          <h2 className="font-serif text-base font-bold text-heading flex items-center gap-2">
            <Ticket className="w-4 h-4 text-primary" />
            <span>Trial Lesson Allocation</span>
          </h2>
          <p className="text-xs text-body mt-0.5">
            Default number of complimentary trial sessions granted to newly registered students.
          </p>
        </div>

        <div className="space-y-1.5 max-w-xs">
          <label className="text-xs font-semibold text-heading">
            Granted Trial Lessons Per Student
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={0}
              max={10}
              value={trialCount}
              onChange={(e) => setTrialCount(Number(e.target.value))}
              className="w-24 rounded-xl bg-white border border-primary/15 px-3 py-2 text-sm text-heading font-numeric font-bold focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
            />
            <span className="text-xs text-body-muted">
              sessions (recommended: 1 or 2)
            </span>
          </div>
          <p className="text-[11px] text-body/60 mt-1">
            Changing this value applies immediately to new student accounts upon their first booking.
          </p>
        </div>
      </div>

      {/* Supabase Storage Card */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-primary/10 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-base font-bold text-heading flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                <span>Cloud Storage &amp; Database</span>
              </h2>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Supabase Active
              </span>
            </div>
            <p className="text-xs text-body mt-0.5">
              Secure institutional repository for chat attachments, faculty learning resources, and lesson recordings.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
            <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
              <Cloud className="w-3.5 h-3.5" />
              <span>Recordings</span>
            </div>
            <p className="text-[11px] text-body/80 font-medium">Automatic lesson takes (.webm)</p>
            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold pt-1">
              <Check className="w-3 h-3" />
              <span>Vault online</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
            <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
              <Database className="w-3.5 h-3.5" />
              <span>Resources</span>
            </div>
            <p className="text-[11px] text-body/80 font-medium">Sheet music, audio &amp; exercises</p>
            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold pt-1">
              <Check className="w-3 h-3" />
              <span>Vault online</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 space-y-1">
            <div className="flex items-center gap-1.5 text-primary text-xs font-semibold">
              <Server className="w-3.5 h-3.5" />
              <span>Chat Files</span>
            </div>
            <p className="text-[11px] text-body/80 font-medium">Direct message documents &amp; PDFs</p>
            <div className="flex items-center gap-1 text-[10px] text-emerald-700 font-semibold pt-1">
              <Check className="w-3 h-3" />
              <span>Vault online</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-bg-alt/60 border border-primary/10 p-3.5 text-xs text-body space-y-1">
          <p className="font-semibold text-heading flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-primary" />
            <span>High-Speed Supabase Infrastructure</span>
          </p>
          <p className="text-[11px] text-body-muted leading-relaxed">
            All files are stored in your dedicated Supabase database and cloud storage with low-latency streaming and permanent retention. Google Drive service account requirements have been eliminated.
          </p>
        </div>
      </div>

      {/* Institutional Metadata Card */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-primary/10 pb-3">
          <h2 className="font-serif text-base font-bold text-heading flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span>Academy Administration &amp; Billing</span>
          </h2>
          <p className="text-xs text-body mt-0.5">
            Default platform billing parameters and official admissions contact details.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-body/60" />
              <span>Contact &amp; Admissions Email</span>
            </label>
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className="w-full rounded-xl bg-white border border-primary/15 px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary shadow-2xs"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-body/60" />
              <span>Primary Transaction Currency</span>
            </label>
            <input
              type="text"
              disabled
              value={currency}
              className="w-full rounded-xl bg-bg-alt/30 border border-primary/10 px-3.5 py-2 text-xs text-body cursor-not-allowed"
            />
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2 text-xs text-heading cursor-pointer">
            <input
              type="checkbox"
              checked={maintenanceMode}
              onChange={(e) => setMaintenanceMode(e.target.checked)}
              className="w-4 h-4 accent-primary rounded"
            />
            <span>Maintenance Mode (Temporarily disables new student bookings)</span>
          </label>
        </div>
      </div>

      <div className="pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:scale-[0.98] text-white text-xs font-bold shadow-xs transition-all cursor-pointer disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Saving Changes...</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Save Configuration</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
