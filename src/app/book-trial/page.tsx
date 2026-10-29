import { getCurrentUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { BookTrialClient } from "./BookTrialClient";
import { EnrollmentStatus } from "@prisma/client";

export const metadata = {
  title: "Book Free Trial Lesson | Gandharva School of Music",
  description: "Schedule your complimentary 1-to-1 live trial lesson with our accredited music faculty.",
};

export default async function BookTrialPage() {
  const user = await getCurrentUser();
  let dbUser = null;
  let isConvertedOrEnrolled = false;

  if (user?.id) {
    const [foundUser, convertedTrial, activeEnrollment] = await Promise.all([
      db.user.findUnique({
        where: { id: user.id },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          phoneVerified: true,
          timezone: true,
        },
      }),
      db.trialRequest.findFirst({
        where: { studentId: user.id, isConverted: true },
        select: { id: true },
      }),
      db.enrollment.findFirst({
        where: { studentId: user.id, status: EnrollmentStatus.ACTIVE },
        select: { id: true },
      }),
    ]);

    dbUser = foundUser;
    isConvertedOrEnrolled = Boolean(convertedTrial || activeEnrollment);
  }

  return (
    <div className="trial-page">
      <BookTrialClient
        currentUser={
          dbUser
            ? {
                id: dbUser.id,
                name: dbUser.name ?? null,
                email: dbUser.email ?? null,
                phone: dbUser.phone ?? null,
                phoneVerified: !!dbUser.phoneVerified,
                timezone: dbUser.timezone || "UTC",
              }
            : null
        }
        isConvertedStudent={isConvertedOrEnrolled}
      />
    </div>
  );
}
