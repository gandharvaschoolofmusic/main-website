"use client";

import { useState, useTransition } from "react";
import { updateProfileAction, changePasswordAction } from "@/actions/profile";
import { POPULAR_TIMEZONES } from "@/lib/timezone";
import {
  User,
  Lock,
  Bell,
  Check,
  Loader2,
  Calendar,
  Sparkles,
  Users,
  MapPin,
  Globe,
  ShieldCheck,
  Pencil,
} from "lucide-react";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import {
  CountryCodeSelector,
  SUPPORTED_COUNTRIES,
  CountryOption,
} from "@/components/ui/CountryCodeSelector";

export interface ProfileEditorProps {
  user: {
    id: string;
    name: string;
    email: string;
    timezone: string;
    emailVerified: boolean;
    image?: string | null;
    createdAt?: string;
    country?: string;
    age?: number | null;
    gender?: string;
    guardianName?: string;
    guardianPhone?: string;
    address?: string;
  };
}

export function ProfileEditor({ user }: ProfileEditorProps) {
  // Personal Info
  const [name, setName] = useState(user.name);
  const [timezone, setTimezone] = useState(user.timezone || "UTC");
  const [country, setCountry] = useState(user.country || "");
  const [age, setAge] = useState<string>(
    user.age !== null && user.age !== undefined ? String(user.age) : ""
  );
  const [gender, setGender] = useState(user.gender || "");

  // Guardian & Residential Info
  const [guardianName, setGuardianName] = useState(user.guardianName || "");
  const [guardianCountry, setGuardianCountry] = useState<CountryOption>(() => {
    if (user.guardianPhone) {
      const match = SUPPORTED_COUNTRIES.find((c) =>
        user.guardianPhone?.startsWith(c.dialCode)
      );
      if (match) return match;
    }
    return SUPPORTED_COUNTRIES[0]; // India (+91)
  });
  const [guardianPhoneRaw, setGuardianPhoneRaw] = useState(() => {
    if (user.guardianPhone) {
      const match = SUPPORTED_COUNTRIES.find((c) =>
        user.guardianPhone?.startsWith(c.dialCode)
      );
      if (match) {
        return user.guardianPhone.slice(match.dialCode.length).trim();
      }
      return user.guardianPhone;
    }
    return "";
  });
  const [address, setAddress] = useState(user.address || "");

  const [isPendingProfile, startProfileTransition] = useTransition();
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isPendingPassword, startPasswordTransition] = useTransition();
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Notification toggles
  const [notifyBookings, setNotifyBookings] = useState(true);
  const [notifyReminders, setNotifyReminders] = useState(true);
  const [notifyCerts, setNotifyCerts] = useState(true);

  // Format Date of Joining (Automatically Added)
  const joinDate = user.createdAt ? new Date(user.createdAt) : null;
  const formattedJoinDate = joinDate
    ? joinDate.toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "Official Academy Member";

  const getFullGuardianPhone = () => {
    const raw = guardianPhoneRaw.trim();
    if (!raw) return "";
    if (raw.startsWith("+")) return raw;
    const cleanDigits = raw.replace(/\D/g, "");
    if (!cleanDigits) return "";
    return `${guardianCountry.dialCode}${cleanDigits}`;
  };

  const handleUpdateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(false);

    startProfileTransition(async () => {
      const res = await updateProfileAction({
        name,
        timezone,
        country: country || null,
        age: age ? parseInt(age, 10) : null,
        gender: gender || null,
        guardianName: guardianName || null,
        guardianPhone: getFullGuardianPhone() || null,
        address: address || null,
      });

      if (res.success) {
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3500);
      } else {
        setProfileError(res.error || "Failed to update profile.");
      }
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

    startPasswordTransition(async () => {
      const res = await changePasswordAction({ currentPassword, newPassword });
      if (res.success) {
        setPasswordSuccess(true);
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(false), 3000);
      } else {
        setPasswordError(res.error || "Failed to change password.");
      }
    });
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <form onSubmit={handleUpdateProfile} className="space-y-8">
        {/* Profile Success / Error Alerts */}
        {profileSuccess && (
          <div className="p-3.5 rounded-2xl bg-success-muted border border-success/30 text-xs text-success font-medium flex items-center gap-2.5 animate-fade-in shadow-xs">
            <Check className="w-4 h-4 text-success shrink-0" />
            <span>Profile updated successfully! Your name and details have been saved.</span>
          </div>
        )}
        {profileError && (
          <div className="p-3.5 rounded-2xl bg-danger-muted border border-danger/25 text-xs text-danger-dark font-medium flex items-center gap-2 animate-fade-in shadow-xs">
            <span>{profileError}</span>
          </div>
        )}

        {/* ─── CARD 1: PERSONAL INFORMATION & DEMOGRAPHICS ─── */}
        <div className="p-6 sm:p-7 rounded-3xl border border-border-default bg-white shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
            <div className="p-2.5 rounded-2xl bg-accent-subtle text-accent-dark">
              <User className="w-5 h-5 text-accent-dark" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-heading">
                Personal Information
              </h2>
              <p className="text-xs text-body-muted">
                Manage your name, student demographics, and official academy registration details.
              </p>
            </div>
          </div>

          {/* Profile Avatar Upload Section */}
          <div className="pb-3 border-b border-border-subtle">
            <AvatarUpload currentImage={user.image} userName={name} />
          </div>

          {/* Automatically Added Date of Joining Ribbon */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-primary-subtle/80 via-bg-alt/35 to-accent-subtle/50 border border-primary/20 gap-3 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-white text-primary shadow-xs shrink-0">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Date of Joining (Automatically Recorded)
                </span>
                <p className="text-sm font-bold text-heading font-serif">
                  {formattedJoinDate}
                </p>
              </div>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/95 border border-primary/20 text-[11px] font-bold text-primary shadow-2xs self-start sm:self-auto">
              <Sparkles className="w-3.5 h-3.5 text-accent" />
              <span>Official Student Member</span>
            </div>
          </div>

          <div className="space-y-4">
            {/* Full Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-heading">
                    Full Name *
                  </label>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary bg-primary/8 px-2 py-0.5 rounded-md">
                    <Pencil className="w-2.5 h-2.5" />
                    Editable
                  </span>
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-primary/30 text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all shadow-xs"
                />
                <p className="mt-1 text-[10px] text-body-muted">
                  This name appears on your lessons, certificates, and profile across the platform.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-heading">
                    Email Address
                  </label>
                  {user.emailVerified && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Verified
                    </span>
                  )}
                </div>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-bg-alt/30 border border-border-subtle text-xs text-body-muted cursor-not-allowed"
                />
              </div>
            </div>

            {/* Country, Age, Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-heading mb-1.5">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
                >
                  <option value="">Select country...</option>
                  {SUPPORTED_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.name}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-heading mb-1.5">
                  Age
                </label>
                <input
                  type="number"
                  min={3}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="e.g. 14"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading placeholder:text-body-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-heading mb-1.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
                >
                  <option value="">Select gender...</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>

            {/* Lesson Timezone */}
            <div>
              <label className="block text-xs font-bold text-heading mb-1.5">
                Timezone (used for all live 1:1 lesson countdowns and calendar scheduling)
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer"
              >
                {POPULAR_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label} ({tz.value})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* ─── CARD 2: GUARDIAN & RESIDENTIAL ADDRESS ─── */}
        <div className="p-6 sm:p-7 rounded-3xl border border-border-default bg-white shadow-sm space-y-6">
          <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
            <div className="p-2.5 rounded-2xl bg-cta-subtle text-cta">
              <Users className="w-5 h-5 text-cta" />
            </div>
            <div>
              <h2 className="font-serif text-lg font-bold text-heading">
                Guardian & Residential Details
              </h2>
              <p className="text-xs text-body-muted">
                Primary parent or legal guardian details and postal address for certifications.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-heading mb-1.5">
                  Guardian / Parent Full Name
                </label>
                <input
                  type="text"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g. Ananya Roy"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading placeholder:text-body-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-heading mb-1.5">
                  Guardian's Mobile Phone Number
                </label>
                <div className="flex items-center rounded-xl border border-border-default bg-white shadow-xs focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                  <CountryCodeSelector
                    selectedCountry={guardianCountry}
                    onSelect={(c) => setGuardianCountry(c)}
                  />
                  <div className="h-6 w-px bg-border-default/80 shrink-0" />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={guardianPhoneRaw}
                    onChange={(e) => setGuardianPhoneRaw(e.target.value)}
                    placeholder="Enter phone number"
                    className="block flex-1 border-0 bg-transparent px-3.5 py-2 text-xs text-heading placeholder-body/40 focus:outline-none focus:ring-0"
                  />
                </div>
                <p className="mt-1 text-[10px] text-body-muted">
                  Country dial code: <strong className="font-mono text-heading">{guardianCountry.dialCode}</strong> ({guardianCountry.name})
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-heading mb-1.5">
                Residential Address
              </label>
              <textarea
                rows={3}
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="House / Flat No., Street Name, City, State, Postal Code..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading placeholder:text-body-muted/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all resize-y"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-border-subtle">
            <button
              type="submit"
              disabled={isPendingProfile}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-bold transition-all shadow-md shadow-primary/20 disabled:opacity-50 flex items-center gap-2 btn-tactile cursor-pointer"
            >
              {isPendingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />}
              <span>Save Profile Changes</span>
            </button>
          </div>
        </div>
      </form>

      {/* ─── CARD 3: SECURITY & PASSWORD ─── */}
      <div className="p-6 sm:p-7 rounded-3xl border border-border-default bg-white shadow-sm space-y-5">
        <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
          <div className="p-2 rounded-xl bg-primary-subtle text-primary">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">
              Security & Password
            </h2>
            <p className="text-xs text-body-muted">
              Ensure your student account is protected with a strong, unique password.
            </p>
          </div>
        </div>

        {passwordSuccess && (
          <div className="p-3.5 rounded-2xl bg-success-muted border border-success/30 text-xs text-success font-medium flex items-center gap-2 animate-fade-in shadow-xs">
            <Check className="w-4 h-4 text-success" />
            <span>Password updated successfully!</span>
          </div>
        )}
        {passwordError && (
          <div className="p-3.5 rounded-2xl bg-danger-muted border border-danger/25 text-xs text-danger-dark font-medium animate-fade-in shadow-xs">
            {passwordError}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-heading mb-1">
              Current Password
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-heading mb-1">
                New Password (min. 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-heading mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-border-default text-xs text-heading focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isPendingPassword || !currentPassword || !newPassword}
              className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-bold transition-all shadow-sm shadow-primary/20 disabled:opacity-50 flex items-center gap-2 btn-tactile cursor-pointer"
            >
              {isPendingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Update Password</span>
            </button>
          </div>
        </form>
      </div>

      {/* ─── CARD 4: NOTIFICATION PREFERENCES ─── */}
      <div className="p-6 sm:p-7 rounded-3xl border border-border-default bg-white shadow-sm space-y-4">
        <div className="flex items-center gap-3 border-b border-border-subtle pb-4">
          <div className="p-2 rounded-xl bg-bg-alt text-cta">
            <Bell className="w-5 h-5 text-cta" />
          </div>
          <div>
            <h2 className="font-serif text-lg font-bold text-heading">
              Notification Preferences
            </h2>
            <p className="text-xs text-body-muted">
              Control the transactional email updates you receive from the academy.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-bg-alt/25 border border-border-subtle cursor-pointer hover:bg-bg-alt/40 transition-colors">
            <div>
              <div className="text-xs font-bold text-heading">
                Lesson Booking Confirmations and Calendar Invites
              </div>
              <div className="text-[11px] text-body">
                Receive instant emails with calendar attachments when you reserve a slot.
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyBookings}
              onChange={(e) => setNotifyBookings(e.target.checked)}
              className="w-4 h-4 accent-cta rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-bg-alt/25 border border-border-subtle cursor-pointer hover:bg-bg-alt/40 transition-colors">
            <div>
              <div className="text-xs font-bold text-heading">
                Lesson Countdown and Reminders
              </div>
              <div className="text-[11px] text-body">
                Get notified 24h and 1h before your live video session starts.
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyReminders}
              onChange={(e) => setNotifyReminders(e.target.checked)}
              className="w-4 h-4 accent-cta rounded cursor-pointer"
            />
          </label>

          <label className="flex items-center justify-between p-3.5 rounded-2xl bg-bg-alt/25 border border-border-subtle cursor-pointer hover:bg-bg-alt/40 transition-colors">
            <div>
              <div className="text-xs font-bold text-heading">
                Graduation Certificate Issuance
              </div>
              <div className="text-[11px] text-body">
                Receive celebratory notifications when an official diploma is issued.
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyCerts}
              onChange={(e) => setNotifyCerts(e.target.checked)}
              className="w-4 h-4 accent-cta rounded cursor-pointer"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
