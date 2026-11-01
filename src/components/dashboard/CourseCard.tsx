"use client";

import Link from "next/link";
import { Clock, BookOpen, Award, ArrowRight, FileText, Download } from "lucide-react";
import { Discipline, CourseLevel } from "@/types";
import { PriceDisplay } from "@/components/currency/PriceDisplay";
import { cleanDescriptionText } from "@/lib/pricing-tiers";

export type CourseCardProps = {
  course: {
    id: string;
    title: string;
    slug: string;
    discipline: Discipline;
    instrument: string;
    level: CourseLevel;
    accreditation?: string | null;
    description: string;
    syllabusSummary: string;
    priceMinorUnits: number;
    currency: string;
    sessionCount: number;
    durationWeeks: number;
    thumbnailUrl?: string | null;
    structurePdfUrl?: string | null;
  };
  basePath?: string;
};

export function CourseCard({ course, basePath = "/student/dashboard/courses" }: CourseCardProps) {

  const disciplineBadgeColors: Record<Discipline, string> = {
    INSTRUMENT: "bg-accent-subtle text-accent-dark border-accent/30 font-bold",
    VOCALS: "bg-primary-subtle text-primary border-primary/30 font-bold",
    DANCE: "bg-bg-alt text-cta border-cta/30 font-bold",
  };

  const levelBadgeColors: Record<CourseLevel, string> = {
    FOUNDATION: "text-primary border-primary/25 bg-primary-subtle font-bold",
    BEGINNER: "text-success border-success/30 bg-success-muted font-bold",
    INTERMEDIATE: "text-info border-info/30 bg-info-muted font-bold",
    ADVANCED: "text-accent-dark border-accent/30 bg-accent-subtle font-bold",
  };

  return (
    <div className="bg-white border border-border-default rounded-2xl p-5 flex flex-col justify-between hover:border-cta/40 hover:shadow-md transition-all duration-300 group shadow-xs">
      <div className="space-y-3.5">
        {/* Badges & Meta */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[11px] border ${
              disciplineBadgeColors[course.discipline] || "bg-accent-subtle text-accent-dark border-accent/30 font-bold"
            }`}
          >
            {course.discipline}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] border ${
              levelBadgeColors[course.level] || "text-primary border-primary/25 bg-primary-subtle font-bold"
            }`}
          >
            {course.level}
          </span>
          {course.accreditation && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-primary-subtle text-primary border border-primary/30">
              <Award className="w-3 h-3 text-primary" />
              {course.accreditation}
            </span>
          )}
        </div>

        {/* Title */}
        <div>
          <h3 className="font-serif text-lg font-bold text-heading group-hover:text-primary transition-colors">
            {course.title}
          </h3>
          <p className="text-xs text-accent-dark font-semibold mt-0.5">
            Focus: {course.instrument}
          </p>
        </div>

        {/* Description */}
        <p className="text-xs text-body line-clamp-2 leading-relaxed">
          {cleanDescriptionText(course.description)}
        </p>

        {/* Metrics Pill Grid */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-bg-alt/50 border border-border-subtle text-xs text-heading font-medium">
            <BookOpen className="w-3.5 h-3.5 text-accent" />
            <span>{course.sessionCount} Sessions</span>
          </div>
          <div className="flex items-center gap-1.5 p-2 rounded-xl bg-bg-alt/50 border border-border-subtle text-xs text-heading font-medium">
            <Clock className="w-3.5 h-3.5 text-cta" />
            <span>{course.durationWeeks} Weeks</span>
          </div>
        </div>

        {/* Course Structure PDF Download Link */}
        {course.structurePdfUrl && (
          <div className="pt-1">
            <a
              href={`/api/courses/structure-pdf?slug=${encodeURIComponent(course.slug)}`}
              download
              className="w-full inline-flex items-center justify-between px-3 py-2 rounded-xl bg-purple-50/80 hover:bg-purple-100 text-[#3C096C] text-xs font-bold border border-purple-200/80 transition-all shadow-2xs group/pdf cursor-pointer active:scale-[0.99]"
              title="Download Course Structure PDF"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-3.5 h-3.5 text-[#3C096C] shrink-0" />
                <span className="truncate">Course Structure (PDF)</span>
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#3C096C]/80 group-hover/pdf:text-[#3C096C] shrink-0">
                <span>Download</span>
                <Download className="w-3 h-3" />
              </span>
            </a>
          </div>
        )}
      </div>

      {/* Pricing & CTA */}
      <div className="pt-4 mt-4 border-t border-border-subtle flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-body-muted font-medium">Tuition fee</div>
          <PriceDisplay
            priceMinorUnits={course.priceMinorUnits}
            level={course.level}
            sessionCount={course.sessionCount}
            description={course.description}
            size="lg"
            showOriginalStrike
            showDiscountBadge
            showPerSessionBadge
          />
        </div>

        <Link
          href={`${basePath}/${course.slug}`}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active text-white font-bold text-xs transition-all shadow-sm shadow-cta/25 btn-tactile"
        >
          <span>Request Admission</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
