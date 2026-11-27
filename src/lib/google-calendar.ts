import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";

export const calendarProvider = "google-calendar";
export const calendarScope = "https://www.googleapis.com/auth/calendar.events.owned";
export function calendarOrigin() {
  return new URL(process.env.APP_URL || process.env.NEXTAUTH_URL || "https://www.gandharvaschoolofmusic.com").origin;
}
export function calendarCallback() {
  return calendarOrigin() + "/api/google-calendar/callback";
}
function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Calendar encryption is not configured.");
  return createHash("sha256").update(secret).digest();
}
export function protectCalendarToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}
function readCalendarToken(value: string) {
  const bytes = Buffer.from(value, "base64");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
export async function googleTokenRequest(parameters: Record<string, string>) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      ...parameters,
      client_id: process.env.AUTH_GOOGLE_ID || "",
      client_secret: process.env.AUTH_GOOGLE_SECRET || "",
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error("Google authorization failed. Reconnect Google Calendar.");
  return response.json() as Promise<{ access_token: string; refresh_token?: string; scope?: string }>;
}

export async function syncGoogleCalendar(userId: string) {
  // A database lock serializes cron and manual syncs for this user across servers.
  return db.$transaction(async tx => {
    const lock = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${"calendar:" + userId})) AS locked`;
    if (!lock[0]?.locked) return;
    const account = await tx.account.findUnique({
      where: { provider_providerAccountId: { provider: calendarProvider, providerAccountId: userId } },
      include: { user: true },
    });
    if (!account?.refresh_token || !account.user.isActive) return;
    const token = await googleTokenRequest({
      grant_type: "refresh_token", refresh_token: readCalendarToken(account.refresh_token),
    });
    const api = async (path: string, method = "GET", body?: unknown) => {
      const response = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events" + path, {
        method,
        headers: { Authorization: `Bearer ${token.access_token}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15_000),
      });
      return response;
    };
    const origin = calendarOrigin();
    const owner = createHash("sha256").update(origin + userId).digest("hex");
    // Include recently completed sessions so corrections and cancellations are propagated.
    const since = new Date(Date.now() - 30 * 86400000);
    const lessons = await tx.lesson.findMany({
      where: { OR: [{ studentId: userId }, { teacherId: userId }], startsAt: { gte: since } },
      include: { student: { select: { name: true } }, teacher: { select: { name: true } } },
    });
    const events = await tx.event.findMany({
      where: { startsAt: { gte: since }, isPublished: true, OR: [
        { teacherId: userId }, { registrations: { some: { studentId: userId } } },
      ] },
    });
    const desired = new Map<string, Record<string, unknown>>();
    for (const item of [
      ...lessons.filter(l => l.status !== "CANCELLED").map(l => ({
        key: "lesson:" + l.id, title: l.instrument + " lesson",
        startsAt: l.startsAt, durationMinutes: l.durationMinutes,
        description: `Teacher: ${l.teacher.name || "Teacher"}\nStudent: ${l.student.name || "Student"}\nJoin: ${origin}/lesson/${l.id}`,
      })),
      ...events.map(e => ({ key: "event:" + e.id, title: e.title, startsAt: e.startsAt,
        durationMinutes: e.durationMinutes, description: origin + "/dashboard" })),
    ]) {
      const id = createHash("sha256").update(owner + item.key).digest("hex");
      const payload = {
        status: "confirmed", summary: item.title, description: item.description,
        start: { dateTime: item.startsAt.toISOString() },
        end: { dateTime: new Date(item.startsAt.getTime() + item.durationMinutes * 60_000).toISOString() },
      };
      desired.set(id, { ...payload, extendedProperties: { private: {
        gsmOwner: owner, gsmHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
      } } });
    }
    type GoogleEvent = { id: string; extendedProperties?: { private?: { gsmHash?: string } } };
    const existing = new Map<string, GoogleEvent>();
    let pageToken = "";
    do {
      const query = new URLSearchParams({ privateExtendedProperty: "gsmOwner=" + owner, maxResults: "2500", timeMin: since.toISOString() });
      if (pageToken) query.set("pageToken", pageToken);
      const response = await api("?" + query);
      if (!response.ok) throw new Error("Could not read Google Calendar. Try reconnecting.");
      const page = await response.json();
      for (const event of (page.items || []) as GoogleEvent[]) existing.set(event.id, event);
      pageToken = page.nextPageToken || "";
    } while (pageToken);
    for (const [id, payload] of desired) {
      const old = existing.get(id);
      const hash = (payload.extendedProperties as { private: { gsmHash: string } }).private.gsmHash;
      if (old?.extendedProperties?.private?.gsmHash === hash) continue;
      let response = await api("/" + id, "PATCH", payload);
      if (response.status === 404) response = await api("", "POST", { id, ...payload });
      if (!response.ok) throw new Error("Google Calendar could not save a session. Please retry sync.");
    }
    for (const id of existing.keys()) {
      if (desired.has(id)) continue;
      const response = await api("/" + id, "PATCH", { status: "cancelled" });
      if (!response.ok && response.status !== 404 && response.status !== 410) throw new Error("Could not remove an outdated calendar session.");
    }
    await tx.account.update({ where: { id: account.id }, data: { expires_at: Math.floor(Date.now() / 1000) } });
  }, { timeout: 120_000, maxWait: 5000 });
}
