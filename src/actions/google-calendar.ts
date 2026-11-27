"use server";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { calendarProvider, syncGoogleCalendar } from "@/lib/google-calendar";

export async function calendarConnection() {
  const user = await requireUser();
  const account = await db.account.findUnique({
    where: { provider_providerAccountId: { provider: calendarProvider, providerAccountId: user.id } },
    select: { session_state: true, expires_at: true },
  });
  return { email: account?.session_state, lastSync: account?.expires_at,
    configured: Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET && process.env.AUTH_SECRET) };
}
export async function syncMyCalendar() {
  const user = await requireUser();
  try { await syncGoogleCalendar(user.id); return { success: true }; }
  catch { return { success: false }; }
}
export async function disconnectMyCalendar() {
  const user = await requireUser();
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"calendar:" + user.id}))`;
    await tx.account.deleteMany({ where: { userId: user.id, provider: calendarProvider } });
  }, { timeout: 120_000 });
}
