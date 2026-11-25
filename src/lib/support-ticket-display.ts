export function getSupportTicketDisplaySubject(
  subject: string,
  requesterName?: string | null,
): string {
  if (subject.startsWith("Reschedule [")) {
    return requesterName
      ? `Session reschedule request from ${requesterName}`
      : "Session reschedule request";
  }

  return subject;
}
