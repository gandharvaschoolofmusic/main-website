"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Modal from "@/components/Modal";
import { countryOptions } from "@/Data/CountryCode";
import { submitTeacherJobApplicationAction } from "@/actions/teacher";
import { Loader2, ArrowRight, CheckCircle2, AlertCircle, Award, Check } from "lucide-react";

type FormData = {
  name: string;
  phone: string;
  mail: string;
  gender: string;
  qualification: string;
  experience: string;
  english: string;
  certificate: string[];
  setup: string;
};

const initialState: FormData = {
  name: "",
  phone: "",
  mail: "",
  gender: "",
  qualification: "",
  experience: "",
  english: "",
  certificate: [],
  setup: "Yes",
};

export default function JobApplication() {
  const [formData, setFormData] = useState<FormData>(initialState);
  const [countryCode, setCountryCode] = useState("+91");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMessage, setModalMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [warning, setWarning] = useState({
    name: false,
    phone: false,
    mail: false,
    gender: false,
    qualification: false,
    english: false,
    experience: false,
  });

  const genderOptions = [
    { value: "Male", label: "Male" },
    { value: "Female", label: "Female" },
    { value: "Other", label: "Other" },
  ];

  const qualificationOptions = [
    { value: "High School", label: "High School" },
    { value: "Bachelor's Degree", label: "Bachelor's Degree" },
    { value: "Master's Degree", label: "Master's Degree" },
    { value: "PhD / Doctorate", label: "PhD / Doctorate" },
    { value: "Sangeet Visharad / Prabhakar", label: "Sangeet Visharad / Prabhakar" },
    { value: "Diploma in Music", label: "Diploma in Music" },
  ];

  const experienceOptions = [
    { value: "0-1 years", label: "0-1 years" },
    { value: "2-3 years", label: "2-3 years" },
    { value: "4-5 years", label: "4-5 years" },
    { value: "5+ years", label: "5+ years" },
    { value: "10+ years", label: "10+ years" },
  ];

  const englishProficiencyOptions = [
    { value: "Basic", label: "Basic" },
    { value: "Intermediate", label: "Intermediate" },
    { value: "Advanced", label: "Advanced" },
    { value: "Native", label: "Native / Bilingual" },
  ];

  const certificationsList = [
    "Rockschool",
    "Trinity College London",
    "LCME",
    "ABRSM",
    "Gandharva Mahavidyalaya (ABGMVM)",
    "Prayag Sangeet Samiti",
    "Bhatkhande Music Institute",
    "Other Recognized Board",
  ];

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear warning on user edit
    if (name in warning) {
      setWarning((prev) => ({ ...prev, [name]: false }));
    }
  };

  const handleCertificateToggle = (cert: string) => {
    setFormData((prev) => {
      const exists = prev.certificate.includes(cert);
      return {
        ...prev,
        certificate: exists
          ? prev.certificate.filter((c) => c !== cert)
          : [...prev.certificate, cert],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const localWarning = {
      name: !formData.name.trim(),
      phone: !formData.phone.trim() || formData.phone.replace(/\D/g, "").length < 6,
      mail: !formData.mail.trim() || !formData.mail.includes("@"),
      gender: !formData.gender.trim(),
      qualification: !formData.qualification.trim(),
      english: !formData.english.trim(),
      experience: !formData.experience.trim(),
    };

    const hasAnyWarning = Object.values(localWarning).some(Boolean);
    if (hasAnyWarning) {
      setWarning(localWarning);
      return;
    }

    setIsSubmitting(true);

    // Optional safe IP detection with timeout
    let detectedIP = "client";
    try {
      const ipRes = await fetch("https://api.ipify.org?format=json", {
        signal: AbortSignal.timeout(2500),
      });
      if (ipRes.ok) {
        const ipData = await ipRes.json();
        detectedIP = ipData.ip || "client";
      }
    } catch {
      // Non-blocking IP detection
    }

    try {
      const fullPhone = `${countryCode} ${formData.phone.trim()}`;
      const res = await submitTeacherJobApplicationAction({
        name: formData.name.trim(),
        phone: fullPhone,
        mail: formData.mail.trim(),
        gender: formData.gender,
        qualification: formData.qualification,
        experience: formData.experience,
        english: formData.english,
        certificate: formData.certificate,
        setup: formData.setup,
        userIP: detectedIP,
      });

      if (res.success) {
        setSubmitSuccess(true);
        setFormData(initialState);
        setModalMessage(
          res.message ||
            "Your application has been submitted successfully! Our Academic Board will review your credentials and contact you shortly."
        );
        setModalOpen(true);
      } else {
        setModalMessage(
          res.error || "Unable to submit application. Please check your details and try again."
        );
        setModalOpen(true);
      }
    } catch (err: any) {
      setModalMessage(
        err?.message || "An unexpected error occurred during submission. Please try again."
      );
      setModalOpen(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  return (
    <div className="w-full bg-[#fdfbf7] min-h-screen">
      {/* Hero Banner */}
      <section className="bg-gradient-to-r from-[#3C096C] to-[#7507BF] w-full min-h-[40vh] md:min-h-[48vh] flex flex-col items-start justify-center py-12 px-4 sm:px-6 md:px-16 text-white">
        <div className="max-w-4xl mx-auto w-full">
          <span className="inline-block px-3 py-1 rounded-full bg-white/15 text-xs font-semibold tracking-wider uppercase mb-3">
            Academic Careers &amp; Faculty
          </span>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4"
            style={{ fontFamily: "var(--font-vidaloka), serif" }}
          >
            Online Music Faculty Application
          </h1>
          <p
            className="text-base sm:text-lg text-white/90 max-w-2xl leading-relaxed"
            style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
          >
            Join Gandharva School of Music&apos;s global faculty. Teach passionate students
            worldwide with live 1:1 sessions, flexible scheduling, and competitive session payouts.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link
              href="/signup?role=teacher"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-bold transition-all shadow-md active:scale-95"
            >
              <span>Direct Portal Registration</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/teach-with-us/job-details"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs sm:text-sm font-semibold transition-all active:scale-95"
            >
              <span>View Faculty Compensation Details</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Main Application Container */}
      <section
        className="max-w-4xl mx-auto px-4 sm:px-6 md:px-8 py-10"
        style={{ fontFamily: "var(--font-dm-sans), sans-serif" }}
      >
        <Modal isOpen={modalOpen} onClose={closeModal} message={modalMessage} />

        {submitSuccess && (
          <div className="mb-8 p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
              <div>
                <h3 className="font-bold text-base text-emerald-900">Application Received</h3>
                <p className="text-xs text-emerald-700 mt-0.5">
                  Our admissions board is reviewing your teaching credentials. You can also create your faculty account now:
                </p>
              </div>
            </div>
            <Link
              href="/signup?role=teacher"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shrink-0 transition-all shadow-sm"
            >
              Create Account
            </Link>
          </div>
        )}

        <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-neutral-200/80">
          <div className="border-b border-neutral-200/70 pb-6 mb-8">
            <h2
              className="text-2xl sm:text-3xl font-bold text-[#19022C]"
              style={{ fontFamily: "var(--font-vidaloka), serif" }}
            >
              Instructor Application Form
            </h2>
            <p className="text-xs sm:text-sm text-neutral-500 mt-1">
              Please provide complete and accurate details about your musical disciplines and teaching background.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Section 1: Personal Information */}
            <div className="space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-[#19022C] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-900 text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <span>Personal Information</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Full Name */}
                <div>
                  <label htmlFor="name" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Full Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="e.g. Pt. Ravi Sharma"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                  />
                  {warning.name && <WarningMsg message="Full name is required." />}
                </div>

                {/* Email Address */}
                <div>
                  <label htmlFor="mail" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="mail"
                    name="mail"
                    value={formData.mail}
                    onChange={handleChange}
                    placeholder="e.g. instructor@example.com"
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                  />
                  {warning.mail && <WarningMsg message="A valid email address is required." />}
                </div>

                {/* Phone with Country Code */}
                <div>
                  <label htmlFor="phone" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <select
                      aria-label="Country Code"
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="rounded-xl border border-neutral-300 bg-neutral-50 px-2.5 py-2.5 text-xs sm:text-sm font-semibold text-neutral-800 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all shrink-0 max-w-[130px]"
                    >
                      {countryOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="98765 43210"
                      className="flex-1 rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                    />
                  </div>
                  {warning.phone && <WarningMsg message="A valid mobile number is required." />}
                </div>

                {/* Gender */}
                <div>
                  <label htmlFor="gender" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Gender <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="gender"
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                  >
                    <option value="">Select Gender</option>
                    {genderOptions.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                  {warning.gender && <WarningMsg message="Please select your gender." />}
                </div>
              </div>
            </div>

            {/* Section 2: Qualifications & Experience */}
            <div className="space-y-4 pt-6 border-t border-neutral-200/70">
              <h3 className="text-base sm:text-lg font-bold text-[#19022C] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-900 text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <span>Pedagogical Qualifications &amp; Experience</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Highest Qualification */}
                <div>
                  <label htmlFor="qualification" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Highest Qualification <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="qualification"
                    name="qualification"
                    value={formData.qualification}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                  >
                    <option value="">Select Qualification</option>
                    {qualificationOptions.map((q) => (
                      <option key={q.value} value={q.value}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                  {warning.qualification && <WarningMsg message="Highest qualification is required." />}
                </div>

                {/* Years Teaching */}
                <div>
                  <label htmlFor="experience" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    Teaching Experience <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="experience"
                    name="experience"
                    value={formData.experience}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                  >
                    <option value="">Select Experience</option>
                    {experienceOptions.map((e) => (
                      <option key={e.value} value={e.value}>
                        {e.label}
                      </option>
                    ))}
                  </select>
                  {warning.experience && <WarningMsg message="Teaching experience is required." />}
                </div>

                {/* English Proficiency */}
                <div>
                  <label htmlFor="english" className="block text-xs font-bold uppercase tracking-wider text-neutral-700 mb-1.5">
                    English Proficiency <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="english"
                    name="english"
                    value={formData.english}
                    onChange={handleChange}
                    className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-2.5 text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all"
                  >
                    <option value="">Select Proficiency</option>
                    {englishProficiencyOptions.map((ep) => (
                      <option key={ep.value} value={ep.value}>
                        {ep.label}
                      </option>
                    ))}
                  </select>
                  {warning.english && <WarningMsg message="English proficiency is required." />}
                </div>
              </div>
            </div>

            {/* Section 3: Music Board Certifications */}
            <div className="space-y-4 pt-6 border-t border-neutral-200/70">
              <div className="flex items-center justify-between">
                <h3 className="text-base sm:text-lg font-bold text-[#19022C] flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-900 text-xs font-bold flex items-center justify-center">
                    3
                  </span>
                  <span>Board Certifications &amp; Accreditations</span>
                </h3>
                <span className="text-xs text-neutral-500">Optional</span>
              </div>
              <p className="text-xs text-neutral-500">
                Select any formal music certifications or grade exam boards you hold credentials in:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {certificationsList.map((cert) => {
                  const isChecked = formData.certificate.includes(cert);
                  return (
                    <button
                      key={cert}
                      type="button"
                      onClick={() => handleCertificateToggle(cert)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left text-xs font-medium transition-all cursor-pointer ${
                        isChecked
                          ? "bg-purple-50 border-purple-500 text-purple-950 font-bold shadow-xs"
                          : "bg-white border-neutral-200 text-neutral-700 hover:border-purple-300 hover:bg-neutral-50"
                      }`}
                    >
                      <span>{cert}</span>
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center shrink-0 ml-2 ${
                          isChecked ? "bg-purple-600 text-white" : "border border-neutral-300"
                        }`}
                      >
                        {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 4: Home Studio Equipment Setup */}
            <div className="space-y-4 pt-6 border-t border-neutral-200/70">
              <h3 className="text-base sm:text-lg font-bold text-[#19022C] flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-900 text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <span>Home Studio &amp; Tech Readiness</span>
              </h3>
              <p className="text-xs text-neutral-600">
                Do you have a quiet studio space with a laptop/PC, stable high-speed WiFi, external microphone/headset, and webcam for live video lessons?
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                {[
                  { value: "Yes", label: "Yes, fully equipped studio setup" },
                  { value: "Arranging", label: "No, but arranging within 7 days" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all ${
                      formData.setup === opt.value
                        ? "bg-orange-50 border-orange-500 text-orange-950 font-bold shadow-xs"
                        : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="setup"
                      value={opt.value}
                      checked={formData.setup === opt.value}
                      onChange={handleChange}
                      className="accent-orange-600 w-4 h-4"
                    />
                    <span className="text-xs sm:text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-6 border-t border-neutral-200/70 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-neutral-500">
                By submitting, you agree to Gandharva&apos;s Faculty Code of Ethics &amp; Instructor Privacy Policy.
              </p>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-all shadow-md active:scale-98 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Submitting Application...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Application</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </section>
    </div>
  );
}

function WarningMsg({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-1.5 text-red-600 text-xs mt-1.5 font-medium">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
