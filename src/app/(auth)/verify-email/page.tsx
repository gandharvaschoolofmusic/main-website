import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { VerifyEmailClient } from "./VerifyEmailClient";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verify Your Email | Gandharva School of Music",
  description: "Confirm and activate your Gandharva School of Music account.",
};

export default async function VerifyEmailPage() {
  const currentUser = await getCurrentUser();

  const userSummary = currentUser
    ? {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        emailVerified: currentUser.emailVerified,
      }
    : null;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-gradient-to-b from-bg via-bg-alt/25 to-bg">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-cta" />
            <p className="text-xs text-body-muted font-medium">Loading verification...</p>
          </div>
        </div>
      }
    >
      <VerifyEmailClient currentUser={userSummary} />
    </Suspense>
  );
}
