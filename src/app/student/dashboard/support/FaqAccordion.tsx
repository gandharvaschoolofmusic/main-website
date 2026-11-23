"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQ_ITEMS = [
  {
    q: "How do free trial lessons work?",
    a: "Every new student account is granted free trial lessons upon registration (typically 2 sessions). You can book 1-to-1 private video lessons with any published faculty member. Once your trial quota is exhausted, you will be directed to our course catalog to enroll in a structured diploma course.",
  },
  {
    q: "What is your lesson cancellation & rescheduling policy?",
    a: "Students cannot cancel classes directly. Use Request Reschedule to contact administration at least 6 hours before your class starts. Each 24-class enrollment allows up to 6 requests. Your original class remains scheduled until admin confirms a new time, and each request includes a notification with your remaining allowance.",
  },
  {
    q: "How are teachers assigned when I buy a course?",
    a: "When you enroll in a course, our academy administration reviews your schedule preferences and skill goals to assign the most suitable mentor from our vetted faculty. All subsequent lessons for that course are scheduled with your assigned teacher.",
  },
  {
    q: "When and how are graduation certificates issued?",
    a: "When you consume the final masterclass session of an enrolled course, our system automatically compiles and signs an official, verifiable Gandharva School of Music diploma PDF with your unique credential ID. It is permanently accessible under the 'My Certificates' tab.",
  },
];

export function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="space-y-2.5">
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = openIndex === idx;

        return (
          <div
            key={idx}
            className="rounded-2xl border border-border-default bg-white overflow-hidden transition-all shadow-xs"
          >
            <button
              onClick={() => toggle(idx)}
              className="w-full px-4 py-3.5 flex items-center justify-between text-left gap-4 hover:bg-bg-alt/25 transition-colors cursor-pointer"
            >
              <span className="text-xs sm:text-sm font-bold text-heading">
                {item.q}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-body-muted shrink-0 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-primary" : ""
                }`}
              />
            </button>
            {isOpen && (
              <div className="px-4 pb-4 pt-2 text-xs text-body leading-relaxed border-t border-border-subtle bg-bg-alt/15">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
