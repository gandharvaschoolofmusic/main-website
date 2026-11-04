import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";

// Only call after the lesson playback route has checked ownership of this part.
export async function readLessonRecordingMedia(recordingId: string, range: string | null, client: Prisma.TransactionClient = db) {
  const [media] = await client.$queryRaw<{ size: number; mimeType: string }[]>`
    SELECT octet_length("bytes") AS size, "mimeType" FROM "LessonRecordingMedia" WHERE "recordingId" = ${recordingId}`;
  if (!media) return new Response(null, { status: 404 });
  const { size, mimeType } = media;
  const headers = new Headers({ "Content-Type": mimeType, "Accept-Ranges": "bytes", "Cache-Control": "private, no-store" });
  let first = 0, last = size - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    if (!match[1]) first = Math.max(0, size - Number(match[2]));
    else {
      first = Number(match[1]);
      if (match[2]) last = Math.min(last, Number(match[2]));
    }
    if (first > last || first >= size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${first}-${last}/${size}`);
  }
  const length = last - first + 1;
  const [part] = await client.$queryRaw<{ data: Uint8Array }[]>`
    SELECT substring("bytes" FROM ${first + 1}::int FOR ${length}::int) AS data
    FROM "LessonRecordingMedia" WHERE "recordingId" = ${recordingId}`;
  if (!part) return new Response(null, { status: 404 });
  headers.set("Content-Length", String(length));
  return new Response(new Uint8Array(part.data), { headers, status: range ? 206 : 200 });
}
