import type { Metadata } from "next";
import { LessonRecordingTemplate } from "@/components/room/LessonRecordingTemplate";

export const metadata: Metadata = {
  title: "Lesson recording",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RecordingPage() {
  return <LessonRecordingTemplate />;
}
