import { createHash } from "node:crypto";
import policy from "@/content/student-terms.json";

// Identify the exact supplied text, including its draft fields.
export const studentTermsVersion = "1.0-" + createHash("sha256").update(JSON.stringify(policy)).digest("hex");
