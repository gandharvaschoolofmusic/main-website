/** A stable id makes retries safe when the response is lost after a DB commit. */
export async function archiveLessonChat(lessonId: string, message: string, messageId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(`/api/lessons/${encodeURIComponent(lessonId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, messageId }),
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) return;
      if (response.status < 500 && response.status !== 429) {
        const data = await response.json().catch(() => ({}));
        throw new ChatSaveError(data.error || "Could not save this message. Please sign in again.");
      }
    } catch (error) {
      if (error instanceof ChatSaveError) throw error;
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
  }
  throw new Error("Message could not be saved. Check your connection and try sending again.");
}

class ChatSaveError extends Error {}
