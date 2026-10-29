import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

export type StorageBucket = "chat-attachments" | "resources" | "recordings";

export type StorageUploadResult = {
  fileId: string;
  fileName: string;
  fileUrl: string;
  fileSizeBytes: number;
  mimeType: string;
  storageBackend: "SUPABASE_STORAGE";
};

// ─── Supabase Client (for Storage Buckets) ───────────────────────────────────

let cachedSupabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (cachedSupabase) return cachedSupabase;

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    "https://kprifflfakbucchpimvz.supabase.co";

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  try {
    cachedSupabase = createClient(url, key, {
      auth: { persistSession: false },
    });
    return cachedSupabase;
  } catch (err) {
    logger.warn({ err }, "Could not initialize Supabase JS client");
    return null;
  }
}

// ─── Check Configuration ─────────────────────────────────────────────────────

export function isStorageConfigured(): boolean {
  return !!(
    (process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://kprifflfakbucchpimvz.supabase.co")
  );
}

// ─── Upload to Supabase File Storage (Bucket) ────────────────────────────────

export async function uploadToSupabase(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  options?: {
    bucket?: StorageBucket;
    preserveExactName?: boolean;
  },
): Promise<StorageUploadResult> {
  const bucket: StorageBucket = options?.bucket || "resources";
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const finalName = options?.preserveExactName
    ? sanitized
    : `${Date.now()}_${sanitized}`;

  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase File Storage credentials are not configured in environment variables.",
    );
  }

  // Upload directly to Supabase File Storage Bucket
  const { data, error } = await client.storage
    .from(bucket)
    .upload(finalName, fileBuffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
    });

  if (error || !data?.path) {
    logger.error(
      { error: error?.message, bucket, fileName: finalName },
      "Supabase File Storage bucket upload failed",
    );
    throw new Error(
      error?.message || "Failed to upload file to Supabase File Storage.",
    );
  }

  const { data: publicUrlData } = client.storage
    .from(bucket)
    .getPublicUrl(data.path);

  const fileUrl =
    publicUrlData?.publicUrl ||
    `https://kprifflfakbucchpimvz.supabase.co/storage/v1/object/public/${bucket}/${encodeURIComponent(data.path)}`;

  logger.info(
    { bucket, path: data.path, fileName: finalName, fileUrl },
    "File successfully uploaded to Supabase File Storage bucket",
  );

  return {
    fileId: `${bucket}:${data.path}`,
    fileName: finalName,
    fileUrl,
    fileSizeBytes: fileBuffer.length,
    mimeType,
    storageBackend: "SUPABASE_STORAGE",
  };
}

// ─── Delete File from Supabase File Storage Bucket ───────────────────────────

export async function deleteFromSupabase(
  fileId: string,
  bucket?: StorageBucket,
): Promise<boolean> {
  if (!fileId) return false;

  const client = getSupabaseClient();
  if (!client) return false;

  let targetBucket: string = bucket || "resources";
  let targetPath: string = fileId;

  if (fileId.includes(":")) {
    const parts = fileId.split(":");
    targetBucket = parts[0];
    targetPath = parts.slice(1).join(":");
  }

  try {
    const { error } = await client.storage
      .from(targetBucket)
      .remove([targetPath]);

    if (error) {
      logger.warn(
        { error: error.message, bucket: targetBucket, path: targetPath },
        "Could not delete file from Supabase File Storage bucket",
      );
      return false;
    }

    logger.info(
      { bucket: targetBucket, path: targetPath },
      "File deleted from Supabase File Storage bucket",
    );
    return true;
  } catch (err) {
    logger.warn({ err, fileId }, "Exception deleting from Supabase File Storage");
    return false;
  }
}
