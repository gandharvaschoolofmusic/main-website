import { resourcePlaybackAction } from "@/actions/resource-videos";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await resourcePlaybackAction(id);
  if (!result.success || !result.data) {
    return Response.json({ error: result.error }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(null, { status: 307, headers: { Location: result.data.url, "Cache-Control": "private, no-store" } });
}
