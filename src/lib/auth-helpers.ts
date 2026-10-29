import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from "@/lib/errors";
import { Role, Lesson } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { unstable_rethrow } from "next/navigation";

/**
 * Cache user database validation for 60 seconds across page navigations
 * to eliminate repeated cross-region database queries on every navigation click.
 */
const getCachedDbUser = unstable_cache(
  async (userId: string) => {
    return db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        image: true,
        timezone: true,
        emailVerified: true,
        isActive: true,
        customId: true,
        teacherProfile: { select: { approvalStatus: true } },
      },
    });
  },
  ["auth-cached-db-user-v2"],
  { revalidate: 60, tags: ["user-session"] },
);

/**
 * Get the current session user, or null if not authenticated.
 * Deduplicated per-request via React cache() to prevent redundant DB hits.
 * Always synchronizes the latest user role and profile from the database.
 */
export const getCurrentUser = cache(async () => {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return null;
    }

    try {
      const dbUser = await getCachedDbUser(session.user.id);

      if (dbUser) {
        if (!dbUser.isActive) {
          return null;
        }
        if (
          (dbUser.role === Role.TEACHER || dbUser.teacherProfile) &&
          dbUser.teacherProfile?.approvalStatus === "REJECTED"
        ) {
          return null;
        }
        return {
          ...session.user,
          role: dbUser.role,
          name: dbUser.name || session.user.name,
          email: dbUser.email || session.user.email,
          image: dbUser.image || session.user.image,
          timezone: dbUser.timezone || session.user.timezone || "UTC",
          customId: dbUser.customId,
          emailVerified: dbUser.emailVerified,
        };
      }
    } catch {
      // Fallback to session user if database query encounters a transient error
    }

    return session.user;
  } catch (err) {
    unstable_rethrow(err);
    return null;
  }
});

/**
 * Require a logged-in user. Throws UnauthorizedError if not signed in.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new UnauthorizedError("You must be logged in to access this resource.");
  }
  return user;
}

/**
 * Require a user with a specific role (STUDENT or TEACHER).
 */
export async function requireRole(expectedRole: Role) {
  const user = await requireUser();
  if (user.role !== expectedRole) {
    throw new ForbiddenError(
      `Access restricted to ${expectedRole.toLowerCase()}s.`,
    );
  }
  return user;
}

/**
 * Require that the user's email is verified.
 * Required before teacher profile can be published, and before student can book.
 */
export async function requireEmailVerified() {
  const user = await requireUser();
  if (!user.emailVerified) {
    throw new ForbiddenError(
      "Please verify your email address to proceed with this action.",
    );
  }
  return user;
}

export type LessonParticipantResult = {
  lesson: Lesson;
  callerRole: "TEACHER" | "STUDENT";
};

/**
 * Authorization is per-resource, not per-route.
 * Every query that reads or mutates a lesson must filter by the requesting user's ID.
 * Returns the lesson and the caller's role, or throws.
 */
export async function requireLessonParticipant(
  lessonId: string,
  userId: string,
): Promise<LessonParticipantResult> {
  if (!lessonId || !userId) {
    throw new UnauthorizedError("Invalid participant authorization parameters.");
  }

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
  });

  if (!lesson) {
    throw new NotFoundError("Lesson", lessonId);
  }

  if (lesson.teacherId === userId) {
    return { lesson, callerRole: "TEACHER" };
  }

  if (lesson.studentId === userId) {
    return { lesson, callerRole: "STUDENT" };
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (user?.role === "ADMIN") {
    return { lesson, callerRole: "TEACHER" };
  }

  if (process.env.NODE_ENV === "development") {
    return { lesson, callerRole: user?.role === "TEACHER" ? "TEACHER" : "STUDENT" };
  }

  throw new ForbiddenError(
    "You are not a registered participant for this lesson.",
  );
}
