import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth-helpers";
import { calendarCallback, calendarScope } from "@/lib/google-calendar";

export async function GET() {
  const user = await requireUser();
  if (!["STUDENT", "TEACHER"].includes(user.role)) return new Response("Forbidden", { status: 403 });
  if (!process.env.AUTH_GOOGLE_ID || !process.env.AUTH_GOOGLE_SECRET || !process.env.AUTH_SECRET) {
    return new Response("Google Calendar is not configured by the school yet.", { status: 503 });
  }
  const state = randomBytes(32).toString("hex");
  (await cookies()).set("gsm-calendar-state", user.id + ":" + state, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax",
    path: "/api/google-calendar", maxAge: 600,
  });
  const parameters = new URLSearchParams({
    client_id: process.env.AUTH_GOOGLE_ID, redirect_uri: calendarCallback(),
    response_type: "code", scope: calendarScope + " email",
    access_type: "offline", prompt: "consent", state, login_hint: user.email || "",
  });
  return NextResponse.redirect("https://accounts.google.com/o/oauth2/v2/auth?" + parameters);
}
