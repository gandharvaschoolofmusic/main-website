import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { storedFileDownload } from "@/lib/file-download";

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { kind, id } = await params;
  const userId = session.user.id;
  const admin = session.user.role === "ADMIN";
  let url: string | null = null;
  let filename = "download";
  try {
    if (kind === "resource") {
      const file = await db.resource.findFirst({ where: { id, ...(admin ? {} : {
        OR: [{ teacherId: userId }, { shares: { some: { studentId: userId } } }],
      }) } });
      if (!file) return new Response(null, { status: 404 });
      url = file.fileUrl; filename = file.fileName;
      if (file.fileId?.includes(":")) {
        const project = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
        const [bucket, ...parts] = file.fileId.split(":");
        if (!project) return new Response(null, { status: 503 });
        url = new URL(`/storage/v1/object/public/${encodeURIComponent(bucket)}/${parts.join(":").split("/").map(encodeURIComponent).join("/")}`, project).href;
      }
    } else if (kind === "certificate") {
      const file = await db.certificate.findFirst({ where: { id, ...(admin ? {} : { studentId: userId }) } });
      if (!file) return new Response(null, { status: 404 });
      url = file.pdfUrl; filename = `${file.certificateNumber}.pdf`;
    } else if (kind === "message") {
      const file = await db.directMessage.findFirst({ where: { id, ...(admin ? {} : {
        conversation: { OR: [{ teacherId: userId }, { studentId: userId }] },
      }) } });
      if (!file) return new Response(null, { status: 404 });
      url = file.fileUrl; filename = file.fileName || "attachment";
    } else return new Response(null, { status: 404 });
    if (!url) return new Response(null, { status: 404 });
    return await storedFileDownload(url, filename);
  } catch {
    return Response.json({ error: "The file could not be downloaded. Please try again." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
