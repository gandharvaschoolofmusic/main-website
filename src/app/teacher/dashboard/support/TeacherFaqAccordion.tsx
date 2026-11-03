"use client";

import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "When and how are teacher session payouts deposited?",
    answer:
      "Teacher compensation is calculated on a fixed session rate (default ₹800 per 60m session) and disbursed on a bi-weekly cycle directly to your registered bank account. You can inspect all delivered sessions and projected balances in the 'Earnings & Payouts' ledger.",
  },
  {
    question: "What happens if a student is a no-show for a scheduled lesson?",
    answer:
      "If a student fails to enter the video classroom within 15 minutes of the scheduled start time, the session is marked as completed with attendance recorded, ensuring teachers receive full session compensation for their reserved time window.",
  },
  {
    question: "How do I handle student reschedule requests?",
    answer:
      "Students may request a reschedule up to 24 hours in advance. If an urgent conflict arises, submit a support ticket under 'Student Issues & Rescheduling', and our administrative coordinators will reach out to the student to reschedule.",
  },
  {
    question: "How do I optimize microphone and audio quality for instrument instruction?",
    answer:
      "We recommend using wired studio headphones and an external USB condenser microphone. Inside the LiveKit video classroom, toggle on 'Original Sound / Music Mode' to prevent browser echo cancellation from filtering instrument overtones.",
  },
  {
    question: "Can I block specific dates for holidays or performance tours?",
    answer:
      "Yes! Navigate to 'Availability & Schedule' and use the 'Date Exceptions & Time Off' section. You can block full days or define temporary one-off hours on specific calendar dates without modifying your baseline weekly template.",
  },
];

export function TeacherFaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex((curr) => (curr === idx ? null : idx));
  };

  return (
    <div className="space-y-3">
      {faqs.map((faq, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-border-default bg-white overflow-hidden shadow-xs transition-all"
          >
            <button
              type="button"
              onClick={() => toggle(idx)}
              className="w-full p-4 text-left flex items-center justify-between gap-3 text-xs font-bold text-heading hover:text-primary transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <HelpCircle className="w-4 h-4 text-primary shrink-0" />
                <span>{faq.question}</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-body/50 transition-transform duration-200 ${
                  isOpen ? "rotate-180 text-primary" : ""
                }`}
              />
            </button>

            {isOpen && (
              <div className="px-4 pb-4 pt-2 text-xs text-body leading-relaxed border-t border-border-default/60 bg-neutral-50/50">
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
