import Image from "next/image";
import { Music2 } from "lucide-react";
import type { ReactNode } from "react";
import "./form-ui.css";

// Preserve the school's DM Sans and brand palette. Design variance 4,
// motion intensity 2, visual density 4: task-focused forms with quiet feedback.
export function FormShell({ children, variant = "login", sidebar }: {
  children: ReactNode;
  variant?: "login" | "student" | "teacher";
  sidebar?: ReactNode;
}) {
  return (
    <div className="entry-page">
      <div className={`entry-layout ${variant !== "login" ? "entry-layout-signup" : ""} ${sidebar ? "entry-layout-summary" : ""}`}>
        {sidebar ? <aside className="entry-summary-column entry-fields">{sidebar}</aside> : (
          <aside className="entry-story" aria-label="Gandharva learning experience">
            <Image src="/auth-classical-student.png" alt="A teenage student learning traditional Indian vocal music with her teacher" fill priority sizes="(max-width: 900px) 0px, 44vw" />
          </aside>
        )}
        <section className="entry-form-column">
          <div className="entry-form entry-fields">{children}</div>
          <footer className="entry-footnote"><Music2 size={15}/> A space to learn, practise, and grow.</footer>
        </section>
      </div>
    </div>
  );
}
