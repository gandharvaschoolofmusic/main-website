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
    process.env.SUPABASE_URL ||
    "https://xopunboicdymbwdmxvnu.supabase.co";

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

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
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY) &&
    (process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      "https://xopunboicdymbwdmxvnu.supabase.co")
  );
}

// ─── Upload to Supabase File Storage (Bucket) ────────────────────────────────

export async function uploadToSupabase(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  options?: {
    bucket?: StorageBucket | string;
    preserveExactName?: boolean;
  },
): Promise<StorageUploadResult> {
  let bucket = options?.bucket || "resources";
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
  let { data, error } = await client.storage
    .from(bucket)
    .upload(finalName, fileBuffer, {
      contentType: mimeType || "application/octet-stream",
      upsert: true,
    });

  // If Bucket not found, attempt auto-creation or fallback to available bucket
  if (error && (error.message?.toLowerCase().includes("bucket not found") || (error as any).statusCode === "404" || (error as any).statusCode === 404)) {
    logger.warn({ bucket, error: error.message }, "Target bucket not found, attempting auto-creation");

    try {
      const { error: createErr } = await client.storage.createBucket(bucket, {
        public: true,
      });

      if (!createErr) {
        const retry = await client.storage
          .from(bucket)
          .upload(finalName, fileBuffer, {
            contentType: mimeType || "application/octet-stream",
            upsert: true,
          });
        data = retry.data;
        error = retry.error;
      }
    } catch (createCatch) {
      logger.warn({ createCatch }, "Auto-create bucket failed");
    }

    // If still error, inspect available buckets in project and use one of them
    if (error) {
      try {
        const { data: buckets } = await client.storage.listBuckets();
        if (buckets && buckets.length > 0) {
          const alternate =
            buckets.find((b) => b.name === "resources" || b.name === "chat-attachments" || b.name === "recordings") ||
            buckets[0];
          if (alternate && alternate.name !== bucket) {
            logger.info({ fromBucket: bucket, fallbackBucket: alternate.name }, "Retrying upload with existing bucket");
            const altUpload = await client.storage
              .from(alternate.name)
              .upload(finalName, fileBuffer, {
                contentType: mimeType || "application/octet-stream",
                upsert: true,
              });
            if (altUpload.data?.path) {
              data = altUpload.data;
              error = null;
              bucket = alternate.name as StorageBucket;
            }
          }
        }
      } catch (listErr) {
        logger.warn({ listErr }, "Could not list fallback buckets");
      }
    }
  }

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
    `https://xopunboicdymbwdmxvnu.supabase.co/storage/v1/object/public/${bucket}/${encodeURIComponent(data.path)}`;

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
