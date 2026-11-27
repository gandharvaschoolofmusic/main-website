import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { calendarProvider, syncGoogleCalendar } from "@/lib/google-calendar";

export const maxDuration = 300;
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== "Bearer " + process.env.CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }
  const accounts = await db.account.findMany({
    where: { provider: calendarProvider, user: { isActive: true } },
    select: { userId: true },
  });
  let failed = 0;
  // Small batches limit Google API concurrency.
  for (let index = 0; index < accounts.length; index += 5) {
    const results = await Promise.allSettled(accounts.slice(index, index + 5).map(a => syncGoogleCalendar(a.userId)));
    failed += results.filter(r => r.status === "rejected").length;
  }
  return NextResponse.json({ attempted: accounts.length, failed });
}
