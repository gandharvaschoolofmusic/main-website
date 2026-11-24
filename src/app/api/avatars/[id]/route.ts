import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { avatarPath, avatarStorage } from "@/lib/avatar-storage";

// Avatars are display images, including on public faculty profiles. Only the
// current, random version can be resolved; storage credentials stay server-side.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = request.nextUrl.searchParams.get("v");
  if (!version || !/^[a-f0-9-]{36}$/.test(version)) return new NextResponse(null, { status: 404 });
  try {
    const user = await db.user.findUnique({ where: { id }, select: { image: true } });
    if (user?.image !== `/api/avatars/${id}?v=${version}`) return new NextResponse(null, { status: 404 });
    const path = avatarPath(user.image, id)!;
    const { data, error } = await avatarStorage().createSignedUrl(path, 300);
    if (error || !data) return new NextResponse(null, { status: 503 });
    return NextResponse.redirect(data.signedUrl, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
