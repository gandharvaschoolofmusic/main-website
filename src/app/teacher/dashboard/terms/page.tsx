import policy from "@/content/teacher-terms.json";
import { requireRole } from "@/lib/auth-helpers";
import { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { teacherTermsVersion } from "@/lib/teacher-terms";
import { TeacherTermsAcceptance } from "@/components/dashboard/TeacherTermsAcceptance";

export const metadata = {
  title: "Terms & Conditions | Teacher Studio | Gandharva School of Music",
  description: "Read the Gandharva School of Music Teacher Collaboration Policy.",
};

const isHeading = (text: string) => /^\d+\.\s/.test(text) || text === "Summary at a Glance" || text === "Teacher Acknowledgement";
const headingId = (index: number) => `policy-section-${index}`;

export default async function TeacherTermsPage() {
  const user = await requireRole(Role.TEACHER);
  const saved = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { teacherTermsAcceptedAt: true } });
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-accent-dark">Teacher Studio</p>
        <h1 className="font-serif text-3xl font-bold text-heading">Terms &amp; Conditions</h1>
        <p className="text-sm text-body">Your teacher collaboration policy, available here whenever you need it.</p>
      </header>

      <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Draft reference document.</strong> The supplied policy contains an unfilled effective date and other placeholders. These remain as provided by the school.
      </div>

      <nav aria-label="Policy sections" className="rounded-2xl bg-purple-50 p-5">
        <h2 className="font-semibold text-heading">Jump to a section</h2>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {policy.map((block, index) => block.text && isHeading(block.text) ? (
            <li key={index}><a className="text-primary underline-offset-4 hover:underline focus-visible:underline" href={`#${headingId(index)}`}>{block.text}</a></li>
          ) : null)}
        </ul>
      </nav>

      <article aria-label="Teacher Collaboration Policy" className="rounded-2xl bg-white p-5 shadow-sm sm:p-8">
        <div className="mx-auto max-w-3xl space-y-4 text-sm leading-7 text-body">
          {policy.map((block, index) => {
            if (block.type === "table" && block.rows) {
              return (
                <div key={index} className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Policy summary</caption>
                    <thead className="bg-purple-50 text-heading"><tr>{block.rows[0].map((cell, i) => <th scope="col" className="px-4 py-3 font-semibold" key={i}>{cell}</th>)}</tr></thead>
                    <tbody className="divide-y divide-purple-100">{block.rows.slice(1).map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="px-4 py-3 align-top whitespace-pre-line">{cell}</td>)}</tr>)}</tbody>
                  </table>
                </div>
              );
            }
            const text = block.text || "";
            if (index < 2) return <p key={index} className="font-serif text-xl font-bold text-heading">{text}</p>;
            if (text.startsWith("Drafting note")) return <details key={index} className="rounded-lg bg-bg-alt p-4"><summary className="cursor-pointer font-semibold">Source document drafting note</summary><p className="mt-2">{text}</p></details>;
            if (isHeading(text)) return <h2 key={index} id={headingId(index)} className="scroll-mt-24 pt-6 font-serif text-xl font-bold text-heading">{text}</h2>;
            return <p key={index} className="whitespace-pre-line">{text}</p>;
          })}
        </div>
      </article>
      <TeacherTermsAcceptance acceptedAt={saved.teacherTermsAcceptedAt?.toISOString() || null} version={teacherTermsVersion} />
    </div>
  );
}
