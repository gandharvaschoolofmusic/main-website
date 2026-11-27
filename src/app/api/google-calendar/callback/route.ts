import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { db } from "@/lib/db";
import { calendarCallback, calendarOrigin, calendarProvider, calendarScope, googleTokenRequest, protectCalendarToken } from "@/lib/google-calendar";

export async function GET(request: NextRequest) {
  const user = await requireUser();
  const jar = await cookies();
  const expected = jar.get("gsm-calendar-state")?.value;
  jar.set("gsm-calendar-state", "", { path: "/api/google-calendar", maxAge: 0 });
  const state = request.nextUrl.searchParams.get("state");
  if (!state || expected !== user.id + ":" + state || !["STUDENT", "TEACHER"].includes(user.role)) {
    return new Response("Invalid calendar connection. Please connect again.", { status: 400 });
  }
  const destination = calendarOrigin() + "/" + user.role.toLowerCase() + "/dashboard/calendar";
  try {
    const code = request.nextUrl.searchParams.get("code");
    if (!code) throw new Error("Authorization declined");
    const tokens = await googleTokenRequest({ grant_type: "authorization_code", code, redirect_uri: calendarCallback() });
    if (!tokens.refresh_token || !tokens.scope?.split(" ").includes(calendarScope)) throw new Error("Calendar permission required");
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: "Bearer " + tokens.access_token }, signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error("Google identity unavailable");
    const identity = await response.json();
    if (!identity.email || !identity.verified_email) throw new Error("Verified Google email required");
    const data = { refresh_token: protectCalendarToken(tokens.refresh_token), scope: tokens.scope,
      session_state: identity.email as string, expires_at: null };
    await db.account.upsert({
      where: { provider_providerAccountId: { provider: calendarProvider, providerAccountId: user.id } },
      create: { userId: user.id, type: "oauth", provider: calendarProvider, providerAccountId: user.id, ...data },
      update: data,
    });
    return NextResponse.redirect(destination + "?googleCalendar=connected");
  } catch {
    return NextResponse.redirect(destination + "?googleCalendar=error");
  }
}
