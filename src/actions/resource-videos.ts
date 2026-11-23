"use server";

import { randomUUID } from "node:crypto";
import { ResourceCategory, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSupabaseClient, recordingPlaybackUrl } from "@/lib/supabase-storage";
import { resourceFileType, validateResourceFile, isResourceAudio, isResourceVideo } from "@/lib/resource-video";
import { signResourceUpload, verifyResourceUpload } from "@/lib/resource-upload-ticket";
import type { ResourceActionResponse } from "./resources";

async function faculty() {
  const session = await auth();
  if (!session?.user?.id || (session.user.role !== Role.TEACHER && session.user.role !== Role.ADMIN)) {
    throw new Error("Only faculty members can upload learning resources.");
  }
  return session.user.id;
}

function storage() {
  const client = getSupabaseClient();
  if (!client) throw new Error("Media storage is not configured. Please contact administration.");
  return client;
}

export async function prepareResourceMediaAction(input: {
  fileName: string; mimeType?: string; size: number; title: string; description: string; category: string;
}): Promise<ResourceActionResponse<{ uploadUrl: string; ticket: string; mimeType: string }>> {
  try {
    const userId = await faculty();
    const validation = validateResourceFile(input.fileName, input.size);
    if (validation) throw new Error(validation);
    const title = input.title.trim();
    if (title.length < 2 || title.length > 200) throw new Error("Use a title between 2 and 200 characters.");
    if (input.fileName.length > 255 || input.description.length > 5000) throw new Error("The file name or description is too long.");
    if (!Object.values(ResourceCategory).includes(input.category as ResourceCategory)) throw new Error("Select a valid category.");
    const client = storage();
    const { data: bucket, error: bucketError } = await client.storage.getBucket("resources");
    if (bucketError || !bucket) throw new Error("The learning-materials storage bucket is unavailable. Please contact administration.");
    if (bucket.file_size_limit && input.size > bucket.file_size_limit) {
      throw new Error(`This storage bucket currently allows ${Math.floor(bucket.file_size_limit / 1024 / 1024)} MB. Ask administration to increase its limit for larger audio or video files.`);
    }
    const id = randomUUID();
    const path = `${isResourceAudio(input.fileName, resourceFileType(input.fileName, input.mimeType)) ? "audio" : isResourceVideo(input.fileName) ? "videos" : "files"}/${userId}/${id}.${input.fileName.split(".").pop()!.toLowerCase()}`;
    const mimeType = resourceFileType(input.fileName, input.mimeType)!;
    const ticket = signResourceUpload({ ...input, title, id, path, mimeType, userId, expires: Date.now() + 2 * 60 * 60 * 1000 });
    const { data, error } = await client.storage.from("resources").createSignedUploadUrl(path, { upsert: false });
    if (error || !data) throw new Error("Could not prepare media storage. Please try again or contact administration.");
    return { success: true, data: { uploadUrl: data.signedUrl, ticket, mimeType } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not prepare the media upload." };
  }
}

export async function completeResourceMediaAction(token: string): Promise<ResourceActionResponse<{ id: string; title: string; fileUrl: string }>> {
  try {
    const userId = await faculty();
    const ticket = verifyResourceUpload(token, userId);
    const client = storage();
    // Never create a playable database entry until storage confirms the complete file.
    const { data: file, error } = await client.storage.from("resources").info(ticket.path);
    if (error || !file) throw new Error("The file has not finished uploading. Please try again.");
    if (file.size !== ticket.size || file.contentType?.split(";")[0] !== ticket.mimeType) {
      throw new Error("The uploaded file does not match the selected file. Please upload it again.");
    }
    const resource = await db.resource.upsert({
      where: { id: ticket.id }, update: {},
      create: {
        id: ticket.id, teacherId: userId, title: ticket.title,
        description: ticket.description.trim() || null, category: ticket.category as ResourceCategory,
        fileName: ticket.fileName, fileId: `resources:${ticket.path}`,
        fileUrl: `/api/resources/${ticket.id}/file`, fileSizeBytes: file.size, mimeType: ticket.mimeType,
      },
    });
    revalidatePath("/teacher/dashboard/resources");
    revalidatePath("/admin/resources");
    return { success: true, data: { id: resource.id, title: resource.title, fileUrl: resource.fileUrl } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Could not save the uploaded file." };
  }
}

export async function resourcePlaybackAction(id: string): Promise<ResourceActionResponse<{ url: string }>> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Please sign in to play this material." };
    const resource = await db.resource.findFirst({ where: {
      id,
      ...(session.user.role === Role.ADMIN ? {} : { OR: [
        { teacherId: session.user.id }, { shares: { some: { studentId: session.user.id } } },
      ] }),
    } });
    if (!resource) return { success: false, error: "This material is no longer shared with you." };
    let url: string | null;
    if (resource.fileId?.includes(":")) {
      const [bucket, ...parts] = resource.fileId.split(":");
      const result = await storage().storage.from(bucket).createSignedUrl(parts.join(":"), 7200);
      if (result.error || !result.data) throw new Error("Media unavailable. Please try again or contact your teacher.");
      url = result.data.signedUrl;
    } else {
      url = await recordingPlaybackUrl(resource.fileUrl);
    }
    if (!url) throw new Error("The file could not be found in storage.");
    return { success: true, data: { url } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Media unavailable. Please try again." };
  }
}
