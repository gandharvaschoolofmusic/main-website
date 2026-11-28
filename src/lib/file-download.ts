import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { recordingPlaybackUrl } from "@/lib/supabase-storage";
import { attachmentDisposition } from "@/lib/download";

/** Call only after checking access to a database-owned file. Never accepts a caller-supplied URL. */
export async function storedFileDownload(stored: string, filename: string): Promise<Response> {
  const headers = { "Cache-Control": "private, no-store", "Content-Disposition": attachmentDisposition(filename), "X-Content-Type-Options": "nosniff" };
  if (stored.startsWith("/") && !stored.startsWith("//")) {
    const pathname = decodeURIComponent(stored.split("?")[0]);
    if (!/^\/(uploads|recordings|certificates)\//.test(pathname) || pathname.includes("\\")) return new Response(null, { status: 422 });
    const root = path.resolve(process.cwd(), "public");
    const file = path.resolve(root, "." + pathname);
    if (!file.startsWith(root + path.sep)) return new Response(null, { status: 422 });
    const info = await stat(file);
    if (!info.isFile()) return new Response(null, { status: 404 });
    return new Response(Readable.toWeb(createReadStream(file)) as ReadableStream, { headers: {
      ...headers, "Content-Type": "application/octet-stream", "Content-Length": String(info.size),
    } });
  }
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!project || !URL.canParse(stored)) return new Response(null, { status: 422 });
  const source = new URL(stored);
  // Restrict resolution to project storage, avoiding an arbitrary URL fetch endpoint.
  if (source.origin !== new URL(project).origin || !/^\/storage\/v1\/(object\/(public|sign|authenticated)|s3)\//.test(source.pathname)) {
    return new Response(null, { status: 422 });
  }
  const url = await recordingPlaybackUrl(stored, { download: filename });
  if (!url) return new Response(null, { status: 404 });
  // Storage serves the attachment directly; multi-GB recordings never buffer in the app.
  return new Response(null, { status: 307, headers: { ...headers, Location: url } });
}
