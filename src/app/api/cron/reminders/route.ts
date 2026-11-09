import { NextRequest, NextResponse } from "next/server";
import { processUpcomingLessonReminders } from "@/lib/reminders";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/reminders
 * Automated endpoint for class reminders: 24 hours, 12 hours, 1 hour, and 10 minutes.
 * Can be triggered via Vercel Cron, external cron ping, or automated scheduler.
 */
export async function GET(request: NextRequest) {
  return handleCronReminders(request);
}

export async function POST(request: NextRequest) {
  return handleCronReminders(request);
}

async function handleCronReminders(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const keyParam = request.nextUrl.searchParams.get("key");
      const bearer = authHeader?.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;

      if (bearer !== cronSecret && keyParam !== cronSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const startTime = Date.now();
    const stats = await processUpcomingLessonReminders();
    const elapsedMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      durationMs: elapsedMs,
      stats,
    });
  } catch (error) {
    logger.error({ error }, "Error running class reminders cron job");
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

