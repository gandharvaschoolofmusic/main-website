import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth-helpers";
import { getAdminPlaylistStudents, type PlaylistFilter } from "@/lib/admin-youtube";
import { AdminYoutubeManager } from "./AdminYoutubeManager";

export const metadata = { title: "YouTube Playlists | Admin | Gandharva" };

export default async function AdminYoutubePage({ searchParams }: { searchParams: Promise<{ q?: string; filter?: string; page?: string }> }) {
  await requireRole(Role.ADMIN);
  const params = await searchParams;
  const q = (params.q || "").trim().slice(0, 100);
  const filter: PlaylistFilter = params.filter === "ready" || params.filter === "missing" ? params.filter : "all";
  const requestedPage = Math.max(1, Math.min(100000, Number.parseInt(params.page || "1", 10) || 1));
  const data = await getAdminPlaylistStudents(q, filter, requestedPage);
  return <AdminYoutubeManager key={`${q}/${filter}/${data.page}`} {...data} q={q} filter={filter} />;
}
