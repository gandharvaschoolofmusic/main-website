"use client";

import { useState, useTransition } from "react";
import {
  updatePlatformSettingsAction,
  regenerateAdminBackupCodesAction,
  resetAdminTwoFactorAction,
} from "@/actions/admin";
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
  ShieldCheck,
  KeyRound,
  QrCode,
  Copy,
  RefreshCw,
  Lock,
} from "lucide-react";

export interface TwoFactorData {
  enabled: boolean;
  email: string;
  verifiedAt: string | null;
  backupCodesCount: number;
}

interface AdminSettingsFormProps {
  initialSettings: {
    freeTrialLessonCount: number;
    storageProvider?: string;
  };
  twoFactorData?: TwoFactorData;
}

export function AdminSettingsForm({ initialSettings, twoFactorData }: AdminSettingsFormProps) {
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

  // Two-Factor Authentication state
  const [twoFactorInfo, setTwoFactorInfo] = useState<TwoFactorData | undefined>(twoFactorData);
  const [isRegeneratingCodes, setIsRegeneratingCodes] = useState(false);
  const [displayedBackupCodes, setDisplayedBackupCodes] = useState<string[] | null>(null);
  const [copiedCodes, setCopiedCodes] = useState(false);
  const [twoFactorMessage, setTwoFactorMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Reset 2FA modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  const handleRegenerateCodes = async () => {
    setIsRegeneratingCodes(true);
    setTwoFactorMessage(null);
    try {
      const res = await regenerateAdminBackupCodesAction();
      if (res.success && res.data?.backupCodes) {
        setDisplayedBackupCodes(res.data.backupCodes);
        setTwoFactorInfo((prev) => (prev ? { ...prev, backupCodesCount: res.data!.backupCodes.length } : prev));
        setTwoFactorMessage({
          type: "success",
          text: "8 new backup codes generated. Make sure to copy and save them securely.",
        });
      } else {
        setTwoFactorMessage({ type: "error", text: res.error || "Failed to regenerate backup codes." });
      }
    } catch (err: any) {
      setTwoFactorMessage({ type: "error", text: err?.message || "Failed to regenerate backup codes." });
    } finally {
      setIsRegeneratingCodes(false);
    }
  };

  const handleReset2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassword) return;
    setIsResetting(true);
    setTwoFactorMessage(null);
    try {
      const res = await resetAdminTwoFactorAction(resetPassword);
      if (res.success) {
        setShowResetModal(false);
        setResetPassword("");
        setTwoFactorInfo((prev) => (prev ? { ...prev, enabled: false, backupCodesCount: 0 } : prev));
        setDisplayedBackupCodes(null);
        setTwoFactorMessage({
          type: "success",
          text: "Two-step verification has been reset. You will be prompted to re-configure Google Authenticator on your next login.",
        });
      } else {
        setTwoFactorMessage({ type: "error", text: res.error || "Failed to reset 2FA." });
      }
    } catch (err: any) {
      setTwoFactorMessage({ type: "error", text: err?.message || "Failed to reset 2FA." });
    } finally {
      setIsResetting(false);
    }
  };

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

      {/* Two-Factor Authentication (Google Authenticator) Card */}
      <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-xs space-y-4">
        <div className="border-b border-primary/10 pb-3 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-serif text-base font-bold text-heading flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Two-Step Verification (Google Authenticator)</span>
            </h2>
            <p className="text-xs text-body mt-0.5">
              Secure your administrator portal with RFC 6238 time-based one-time password (TOTP) verification.
            </p>
          </div>
          <div>
            {twoFactorInfo?.enabled ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Active &amp; Protected</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>Setup on Next Login</span>
              </span>
            )}
          </div>
        </div>

        {twoFactorMessage && (
          <div
            className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
              twoFactorMessage.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
                : "bg-rose-50 border border-rose-200 text-rose-800"
            }`}
          >
            {twoFactorMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            )}
            <span>{twoFactorMessage.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border-subtle space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-body-muted">
              Protected Account
            </span>
            <p className="text-xs font-bold text-heading">{twoFactorInfo?.email || "admin@gandharvaschoolofmusic.com"}</p>
            <p className="text-[11px] text-body-muted">
              {twoFactorInfo?.enabled
                ? "Requires 6-digit code from Google Authenticator on every sign-in."
                : "Will be activated automatically when you log in next."}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-subtle/50 border border-border-subtle space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-body-muted">
              Emergency Backup Codes
            </span>
            <p className="text-xs font-bold text-heading">
              {twoFactorInfo?.backupCodesCount ?? 0} codes remaining
            </p>
            <p className="text-[11px] text-body-muted">
              Use these single-use codes if your phone or authenticator app is lost.
            </p>
          </div>
        </div>

        {/* Display newly generated backup codes */}
        {displayedBackupCodes && displayedBackupCodes.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                <span>New Emergency Recovery Codes (Save These Now)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(displayedBackupCodes.join("\n"));
                  setCopiedCodes(true);
                  setTimeout(() => setCopiedCodes(false), 2000);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-amber-300 text-xs font-bold text-amber-900 hover:bg-amber-100/60 transition-colors cursor-pointer"
              >
                {copiedCodes ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCodes ? "Copied All!" : "Copy All Codes"}</span>
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono text-xs font-bold text-heading">
              {displayedBackupCodes.map((code, idx) => (
                <div key={idx} className="p-2 bg-white rounded-lg border border-amber-200/80 text-center select-all">
                  {code}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-amber-800">
              Each code can only be used once. Store them in a password manager or safe physical location.
            </p>
          </div>
        )}

        {/* 2FA Action buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={handleRegenerateCodes}
            disabled={isRegeneratingCodes || !twoFactorInfo?.enabled}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-subtle hover:bg-surface-subtle/80 text-heading text-xs font-bold border border-border-default transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isRegeneratingCodes ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5 text-body" />
            )}
            <span>Generate New Backup Codes</span>
          </button>

          {twoFactorInfo?.enabled && (
            <button
              type="button"
              onClick={() => setShowResetModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Reset Authenticator App</span>
            </button>
          )}
        </div>
      </div>

      {/* Reset 2FA Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-heading">Reset Two-Step Verification</h3>
                <p className="text-xs text-body mt-1 leading-relaxed">
                  Resetting 2FA removes Google Authenticator from your admin account. You will need to scan a new QR code on your next login. Please enter your password to confirm:
                </p>
              </div>
            </div>

            <form onSubmit={handleReset2FA} className="space-y-3 pt-2">
              <input
                type="password"
                required
                placeholder="Enter your admin password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs text-heading focus:outline-none focus:border-rose-600 focus:ring-1 focus:ring-rose-600"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setResetPassword("");
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-body hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isResetting || !resetPassword}
                  className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                >
                  {isResetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Confirm Reset 2FA</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
