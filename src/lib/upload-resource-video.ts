"use client";

import { prepareResourceVideoAction, completeResourceVideoAction } from "@/actions/resource-videos";
import { validateResourceVideo } from "@/lib/resource-video";

// If storage succeeded but saving metadata failed, retry saving the same upload.
// A lost application response must not create duplicate videos on the next click.
const uploaded = new WeakMap<File, { ticket: string; details: string }>();

export async function uploadResourceVideo(file: File, details: {
  title: string; description: string; category: string;
}, onProgress: (percent: number) => void) {
  try {
    const validation = validateResourceVideo(file.name, file.size);
    if (validation) throw new Error(validation);
    const previous = uploaded.get(file);
    if (previous?.details === JSON.stringify(details)) {
      onProgress(100);
      const result = await completeResourceVideoAction(previous.ticket);
      if (result.success) uploaded.delete(file);
      return result;
    }
    onProgress(0);
    const prepared = await prepareResourceVideoAction({ ...details, fileName: file.name, size: file.size });
    if (!prepared.success || !prepared.data) throw new Error(prepared.error || "Could not prepare upload.");
    const { uploadUrl, ticket, mimeType } = prepared.data;
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", uploadUrl);
      xhr.setRequestHeader("Content-Type", mimeType);
      xhr.timeout = 30 * 60 * 1000;
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) onProgress(Math.min(99, Math.round(event.loaded / event.total * 100)));
      };
      xhr.onerror = () => reject(new Error("Upload interrupted. Check your connection and try again."));
      xhr.ontimeout = () => reject(new Error("Upload timed out. Please try again on a faster connection."));
      xhr.onabort = () => reject(new Error("Upload cancelled."));
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else reject(new Error(xhr.status === 413
          ? "Storage rejected the video size. Ask administration to check the resources bucket and global upload limits."
          : "Video storage rejected the upload. Please try again or contact administration."));
      };
      xhr.send(file);
    });
    uploaded.set(file, { ticket, details: JSON.stringify(details) });
    onProgress(100);
    const result = await completeResourceVideoAction(ticket);
    if (result.success) uploaded.delete(file);
    return result;
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Video upload failed." };
  }
}
