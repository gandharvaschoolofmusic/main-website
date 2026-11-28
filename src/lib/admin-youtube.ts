import { Role, type Prisma } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";

export const YOUTUBE_PAGE_SIZE = 20;
export type PlaylistFilter = "all" | "ready" | "missing";
export type PlaylistEnrollment = {
  id: string; title: string; instrument: string; level: string; status: string;
  enrolledAt: string; url: string | null;
};
export type PlaylistStudent = { id: string; name: string; customId: string | null; courses: PlaylistEnrollment[] };

// Authenticate in the page before reading this shared, short-lived cache.
export const getAdminPlaylistStudents = unstable_cache(async (q: string, filter: PlaylistFilter, requestedPage: number) => {
  const eligible: Prisma.EnrollmentWhereInput = { status: { not: "CANCELLED" } };
  const matching: Prisma.EnrollmentWhereInput = { ...eligible,
    ...(filter === "ready" ? { youtubePlaylistUrl: { not: null } } : filter === "missing" ? { youtubePlaylistUrl: null } : {}),
  };
  const where: Prisma.UserWhereInput = { role: Role.STUDENT, enrollments: { some: matching },
    ...(q ? { OR: [
      { name: { contains: q, mode: "insensitive" } },
      { customId: { contains: q, mode: "insensitive" } },
      { enrollments: { some: { ...matching, course: { title: { contains: q, mode: "insensitive" } } } } },
    ] } : {}),
  };
  const readPage = (page: number) => db.user.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }],
    skip: (page - 1) * YOUTUBE_PAGE_SIZE, take: YOUTUBE_PAGE_SIZE,
    select: { id: true, name: true, customId: true,
      // All allotted courses stay together, even when only one matched the search.
      enrollments: { where: eligible, orderBy: [{ startedAt: "desc" }, { id: "asc" }],
        select: { id: true, status: true, startedAt: true, youtubePlaylistUrl: true,
          course: { select: { title: true, instrument: true, level: true } } } },
    },
  });
  const [initial, total] = await Promise.all([readPage(requestedPage), db.user.count({ where })]);
  const pages = Math.max(1, Math.ceil(total / YOUTUBE_PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const users = page === requestedPage ? initial : await readPage(page);
  const students: PlaylistStudent[] = users.map(user => ({ id: user.id, name: user.name || "Student", customId: user.customId,
    courses: user.enrollments.map(enrollment => ({ id: enrollment.id, title: enrollment.course.title,
      instrument: enrollment.course.instrument, level: enrollment.course.level, status: enrollment.status,
      enrolledAt: enrollment.startedAt.toISOString().slice(0, 10), url: enrollment.youtubePlaylistUrl,
    })),
  }));
  return { students, total, page, pages };
}, ["admin-youtube-students-v1"], { revalidate: 30, tags: ["youtube-playlists", "enrollments"] });
