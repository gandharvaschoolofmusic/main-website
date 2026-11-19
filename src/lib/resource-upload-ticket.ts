import { createHmac, timingSafeEqual } from "node:crypto";

export type ResourceUploadTicket = {
  id: string; userId: string; path: string; fileName: string; size: number;
  mimeType: string; title: string; description: string; category: string; expires: number;
};

function signature(payload: string) {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Upload authentication is not configured.");
  return createHmac("sha256", secret).update(`resource-video:${payload}`).digest();
}

export function signResourceUpload(ticket: ResourceUploadTicket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

export function verifyResourceUpload(token: string, userId: string): ResourceUploadTicket {
  const [payload, hash, extra] = token.split(".");
  if (!payload || !hash || extra) throw new Error("Invalid upload. Please select the video again.");
  const expected = signature(payload);
  const supplied = Buffer.from(hash, "base64url");
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    throw new Error("Invalid upload. Please select the video again.");
  }
  const ticket = JSON.parse(Buffer.from(payload, "base64url").toString()) as ResourceUploadTicket;
  if (ticket.userId !== userId || ticket.expires <= Date.now()) {
    throw new Error("Upload session expired. Please select the video again.");
  }
  return ticket;
}
