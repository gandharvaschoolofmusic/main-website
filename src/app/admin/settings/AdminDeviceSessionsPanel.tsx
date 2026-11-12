"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getAdminDeviceSessionsAction,
  revokeAdminDeviceSessionAction,
} from "@/actions/admin";
import type { DeviceSessionInfo } from "@/lib/admin-device-session";
import {
  Laptop,
  Smartphone,
  Tablet,
  Monitor,
  Globe,
  Clock,
  ShieldAlert,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  KeyRound,
  ShieldCheck,
  X,
  Radio,
} from "lucide-react";

interface AdminDeviceSessionsPanelProps {
  initialSessions?: DeviceSessionInfo[];
  twoFactorEnabled?: boolean;
}

export function AdminDeviceSessionsPanel({
  initialSessions = [],
  twoFactorEnabled = false,
}: AdminDeviceSessionsPanelProps) {
  const [sessions, setSessions] = useState<DeviceSessionInfo[]>(initialSessions);
  const [is2FAEnabled, setIs2FAEnabled] = useState(twoFactorEnabled);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Revocation modal state
  const [targetSession, setTargetSession] = useState<DeviceSessionInfo | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isRevoking, setIsRevoking] = useState(false);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const fetchSessions = async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const res = await getAdminDeviceSessionsAction();
      if (res.success && res.data) {
        setSessions(res.data.sessions);
        setIs2FAEnabled(res.data.twoFactorEnabled);
      } else {
        setMessage({ type: "error", text: res.error || "Failed to load device sessions." });
      }
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Failed to load device sessions." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialSessions.length === 0) {
      fetchSessions();
    }
  }, []);

  const handleOpenRevokeModal = (session: DeviceSessionInfo) => {
    setRevokeError(null);
    setTotpCode("");
    setTargetSession(session);
  };

  const handleConfirmRevoke = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSession) return;
    if (!totpCode.trim()) {
      setRevokeError("Please enter your 6-digit Google Authenticator code.");
      return;
    }

    setIsRevoking(true);
    setRevokeError(null);

    try {
      const res = await revokeAdminDeviceSessionAction(targetSession.sessionId, totpCode);
      if (res.success) {
        // Remove revoked session from state
        setSessions((prev) => prev.filter((s) => s.sessionId !== targetSession.sessionId));
        setMessage({
          type: "success",
          text: `Device access revoked for "${targetSession.deviceName || targetSession.browser}". That device has been disconnected.`,
        });
        setTargetSession(null);
        setTotpCode("");
      } else {
        setRevokeError(res.error || "Verification failed. Please check your Google Authenticator code.");
      }
    } catch (err: any) {
      setRevokeError(err?.message || "Failed to revoke session.");
    } finally {
      setIsRevoking(false);
    }
  };

  const getDeviceIcon = (session: DeviceSessionInfo) => {
    const text = `${session.deviceName} ${session.os}`.toLowerCase();
    if (text.includes("iphone") || text.includes("android") || text.includes("mobile")) {
      return <Smartphone className="w-5 h-5 text-primary" />;
    }
    if (text.includes("ipad") || text.includes("tablet")) {
      return <Tablet className="w-5 h-5 text-primary" />;
    }
    if (text.includes("mac") || text.includes("laptop")) {
      return <Laptop className="w-5 h-5 text-primary" />;
    }
    return <Monitor className="w-5 h-5 text-primary" />;
  };

  const formatDate = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="rounded-2xl border border-primary/10 bg-white p-6 shadow-xs space-y-4">
      {/* Header */}
      <div className="border-b border-primary/10 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-base font-bold text-heading flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              <span>Active Admin Login Devices</span>
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary">
              {sessions.length} {sessions.length === 1 ? "Session" : "Sessions"}
            </span>
          </div>
          <p className="text-xs text-body mt-0.5">
            Audit which devices, browsers, and IP addresses are currently logged into the administrative portal.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchSessions}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-subtle hover:bg-surface-subtle/80 text-heading text-xs font-bold border border-border-default transition-all cursor-pointer self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-body ${isLoading ? "animate-spin" : ""}`} />
          <span>Refresh Devices</span>
        </button>
      </div>

      {/* Global alert feedback */}
      {message && (
        <div
          className={`p-3.5 rounded-xl text-xs flex items-center gap-2 ${
            message.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-rose-50 border border-rose-200 text-rose-800"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {/* 2FA Status Notice */}
      {!is2FAEnabled && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-700 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Google Authenticator Required For Revocation</p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              To revoke or remove device access, two-factor authentication must be active on your account. Please complete your 2FA setup in the section above.
            </p>
          </div>
        </div>
      )}

      {/* Device List */}
      <div className="space-y-3 pt-1">
        {isLoading && sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-body-muted flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span>Scanning active devices...</span>
          </div>
        ) : sessions.length === 0 ? (
          <div className="p-6 text-center text-xs text-body-muted bg-surface-subtle/30 rounded-xl border border-dashed border-border-subtle">
            No active device sessions found.
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              className={`p-4 rounded-xl border transition-all ${
                session.isCurrent
                  ? "bg-emerald-50/30 border-emerald-200/80 shadow-2xs"
                  : "bg-surface-subtle/40 border-border-subtle hover:bg-surface-subtle/70"
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      session.isCurrent ? "bg-emerald-100 text-emerald-800" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {getDeviceIcon(session)}
                  </div>

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-heading">
                        {session.deviceName || "Desktop Device"}
                      </span>

                      {session.isCurrent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          <span>This Device (Active Now)</span>
                        </span>
                      )}

                      <span className="text-[11px] font-medium text-body-muted">
                        • {session.browser} ({session.os})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-body-muted font-mono">
                      <span className="flex items-center gap-1">
                        <Globe className="w-3 h-3 text-body/50" />
                        <span>IP: {session.ip}</span>
                        {session.country && <span>({session.country})</span>}
                      </span>

                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-body/50" />
                        <span>Logged in: {formatDate(session.loginAt)}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Revoke button */}
                <div className="sm:self-center shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenRevokeModal(session)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold border border-rose-200 transition-all cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{session.isCurrent ? "Revoke (Sign Out)" : "Remove Device"}</span>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Revocation Confirmation Modal with Google Authenticator Verification */}
      {targetSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-heading">Verify Device Revocation</h3>
                  <p className="text-xs text-body-muted">Two-Factor Authentication Check</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTargetSession(null)}
                className="p-1 rounded-lg text-body-muted hover:text-heading hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-heading space-y-1">
              <p className="font-bold">Device to Disconnect:</p>
              <p className="text-body">
                {targetSession.deviceName} • {targetSession.browser} ({targetSession.os})
              </p>
              <p className="text-[11px] text-body-muted font-mono">
                IP: {targetSession.ip} {targetSession.isCurrent && "• (Current Device Session)"}
              </p>
            </div>

            <p className="text-xs text-body leading-relaxed">
              To confirm that you want to disconnect this device, open{" "}
              <strong className="text-heading">Google Authenticator</strong> and enter the 6-digit verification code below:
            </p>

            {revokeError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{revokeError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmRevoke} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-heading flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  <span>Google Authenticator 6-Digit Code</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  maxLength={9}
                  placeholder="000000"
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className="w-full text-center tracking-[0.25em] font-mono text-lg font-bold rounded-xl border border-primary/20 px-4 py-2.5 text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-2xs"
                />
                <p className="text-[11px] text-body-muted text-center">
                  You can also paste an emergency backup code if you don&apos;t have your phone.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setTargetSession(null)}
                  disabled={isRevoking}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-body hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isRevoking || !totpCode.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5 shadow-2xs"
                >
                  {isRevoking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Revoke Device Access</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

