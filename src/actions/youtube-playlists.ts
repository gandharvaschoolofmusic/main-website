"use server";

import { Role } from "@prisma/client";
import { revalidatePath, updateTag } from "next/cache";
import { requireRole } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { normalizeYoutubePlaylist } from "@/lib/youtube-playlist";

export async function saveEnrollmentPlaylist(input: { enrollmentId: string; url: string; expectedUrl: string | null }) {
  await requireRole(Role.ADMIN);
  if (!input || typeof input.enrollmentId !== "string" || typeof input.url !== "string" || !(input.expectedUrl === null || typeof input.expectedUrl === "string")) {
    return { success: false as const, error: "Invalid playlist details." };
  }
  let url: string | null;
  try { url = normalizeYoutubePlaylist(input.url); }
  catch (error) { return { success: false as const, error: (error as Error).message }; }
  try {
    const changed = await db.enrollment.updateMany({
      where: { id: input.enrollmentId, status: { not: "CANCELLED" }, youtubePlaylistUrl: input.expectedUrl },
      data: { youtubePlaylistUrl: url, youtubePlaylistUpdatedAt: new Date() },
    });
    if (!changed.count) return { success: false as const, error: "This enrollment changed or is no longer available. Refresh and try again." };
    updateTag("youtube-playlists");
    for (const path of ["/admin/youtube", "/student/dashboard/youtube"]) revalidatePath(path);
    return { success: true as const, url };
  } catch { return { success: false as const, error: "Could not save the playlist. Please try again." }; }
}
