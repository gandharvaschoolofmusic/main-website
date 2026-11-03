import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { VerifyEmailClient } from "./VerifyEmailClient";
import { verifyEmailAction } from "@/actions/auth";
import { Loader2 } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Verify Your Email | Gandharva School of Music",
  description: "Confirm and activate your Gandharva School of Music account.",
};

interface VerifyEmailPageProps {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const [currentUser, resolvedParams] = await Promise.all([
    getCurrentUser(),
    searchParams
      ? searchParams
      : Promise.resolve<{ [key: string]: string | string[] | undefined }>({}),
  ]);

  const rawToken =
    (typeof resolvedParams.token === "string" ? resolvedParams.token : undefined) ||
    (typeof resolvedParams.oobCode === "string" ? resolvedParams.oobCode : undefined) ||
    (typeof resolvedParams.code === "string" ? resolvedParams.code : undefined);
  const token = rawToken?.trim() || null;

  // Server-side verification: If token is in the URL, verify immediately during SSR.
  // This eliminates any flash of the "expired link" card when opening the link from an email.
  let initialResult = null;
  if (token) {
    try {
      initialResult = await verifyEmailAction(token);
    } catch {
      // Allow client-side fallback if server-side run experiences transient issues
      initialResult = null;
    }
  }

  const userSummary = currentUser
    ? {
        id: currentUser.id,
        name: currentUser.name,
        email: currentUser.email,
        role: currentUser.role,
        emailVerified:
          currentUser.emailVerified || (initialResult?.success ? new Date() : null),
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
      <VerifyEmailClient
        currentUser={userSummary}
        initialToken={token}
        initialResult={initialResult}
      />
    </Suspense>
  );
}
