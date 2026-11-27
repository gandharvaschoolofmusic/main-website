import { createHash } from "node:crypto";
import policy from "@/content/teacher-terms.json";

// Identify the exact supplied text, including its draft fields.
export const teacherTermsVersion = "1.0-" + createHash("sha256").update(JSON.stringify(policy)).digest("hex");
