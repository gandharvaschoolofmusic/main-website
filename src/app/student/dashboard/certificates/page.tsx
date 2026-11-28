import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { Role } from "@prisma/client";
import Link from "next/link";
import { Award, Download, ExternalLink, GraduationCap, ArrowRight } from "lucide-react";
import { SplitHeading } from "@/components/ui/SplitHeading";

export const metadata = {
  title: "My Certificates | Student Portal | Gandharva School of Music",
  description:
    "View and download your official, verified graduation certificates and diplomas.",
};

import { unstable_cache } from "next/cache";

const getCachedStudentCertificates = unstable_cache(
  async (userId: string) => {
    return db.certificate.findMany({
      where: { studentId: userId },
      include: {
        enrollment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });
  },
  ["student-certificates-data"],
  { revalidate: 60, tags: ["student-certificates"] }
);

export default async function StudentCertificatesPage() {
  const user = await requireRole(Role.STUDENT);

  let certificates: any[] = [];
  try {
    certificates = await getCachedStudentCertificates(user.id);
  } catch (err) {
    console.error("Failed to load cached student certificates:", err);
    certificates = await db.certificate.findMany({
      where: { studentId: user.id },
      include: {
        enrollment: {
          include: {
            course: true,
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <span className="text-xs font-bold uppercase tracking-wider text-accent-dark">
          Academic Credentials and Accreditations
        </span>
        <SplitHeading
          as="h1"
          firstClause="My"
          accentClause="Certificates"
          size="xl"
          className="mt-0.5"
        />
        <p className="text-xs sm:text-sm text-body mt-1 max-w-xl">
          Official authenticated Gandharva School of Music diplomas awarded upon course completion. You can download and present these credentials to grading examination boards.
        </p>
      </div>

      {certificates.length === 0 ? (
        /* Rich Empty State Pointing at Course Catalog */
        <div className="py-16 px-6 rounded-3xl border border-border-default bg-white text-center space-y-4 max-w-2xl mx-auto shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-accent-subtle border border-accent/30 text-accent-dark flex items-center justify-center mx-auto shadow-xs">
            <GraduationCap className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h2 className="font-serif text-2xl font-bold text-heading">
              No Certificates Earned Yet
            </h2>
            <p className="text-xs sm:text-sm text-body leading-relaxed max-w-md mx-auto">
              Certificates are awarded upon completing the masterclass curriculum of an accredited Gandharva course. Browse our catalog to select your instrument and begin working toward an official credential.
            </p>
          </div>

          <div className="pt-3">
            <Link
              href="/student/dashboard/courses"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cta hover:bg-cta-hover active:bg-cta-active text-white font-bold text-sm transition-all shadow-md shadow-cta/25 btn-tactile"
            >
              Explore Course Catalog <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <div
              key={cert.id}
              className="p-6 rounded-3xl border border-border-default bg-white shadow-sm space-y-4 hover:border-accent/40 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent-subtle text-accent-dark border border-accent/30">
                    <Award className="w-3.5 h-3.5" />
                    Verified Credential
                  </span>
                  <span className="text-xs font-mono text-body-muted">
                    {cert.certificateNumber}
                  </span>
                </div>

                <div>
                  <h3 className="font-serif text-xl font-bold text-heading group-hover:text-primary transition-colors">
                    {cert.enrollment.course.title}
                  </h3>
                  <p className="text-xs text-body mt-1">
                    Discipline: {cert.enrollment.course.discipline} | Instrument: {cert.enrollment.course.instrument}
                  </p>
                </div>

                <div className="text-xs text-body-muted">
                  Issued on {new Date(cert.issuedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                </div>
              </div>

              <div className="pt-4 border-t border-border-subtle flex items-center justify-between gap-3">
                <a
                  href={cert.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-body hover:text-primary transition-colors btn-tactile font-medium"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-primary" /> View in Browser
                </a>

                <a
                  href={`/api/files/certificate/${encodeURIComponent(cert.id)}/download`}
                  download={`${cert.certificateNumber}.pdf`}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary-active text-white text-xs font-bold transition-all shadow-xs btn-tactile"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
