import { AwsClient } from "aws4fetch";
import { S3Upload } from "livekit-server-sdk";

/**
 * Constructs an S3Upload configuration for LiveKit Egress if storage credentials are configured.
 * Supports AWS S3, Supabase S3, Cloudflare R2, MinIO, or custom S3-compatible backends.
 * Returns undefined when the lesson archive has no configured delivery credentials.
 */
export function getS3UploadConfig(): S3Upload | undefined {
  const accessKey =
    process.env.LIVEKIT_S3_KEY_ID ||
    process.env.SUPABASE_S3_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    process.env.S3_ACCESS_KEY_ID;

  const secret =
    process.env.LIVEKIT_S3_SECRET ||
    process.env.SUPABASE_S3_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY;

  if (!accessKey || !secret) {
    return undefined;
  }

  // Automatic Supabase S3 endpoint resolution if NEXT_PUBLIC_SUPABASE_URL is provided
  let endpoint = process.env.LIVEKIT_S3_ENDPOINT || process.env.SUPABASE_S3_ENDPOINT || process.env.S3_ENDPOINT;
  if (!endpoint && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supaUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
      if (supaUrl.hostname.endsWith(".supabase.co") && !supaUrl.hostname.endsWith(".storage.supabase.co")) {
        supaUrl.hostname = supaUrl.hostname.replace(".supabase.co", ".storage.supabase.co");
      }
      endpoint = `${supaUrl.origin}/storage/v1/s3`;
    } catch {}
  }

  const bucket =
    process.env.LIVEKIT_S3_BUCKET ||
    process.env.SUPABASE_S3_BUCKET ||
    process.env.S3_BUCKET ||
    "recordings";

  const region =
    process.env.LIVEKIT_S3_REGION ||
    process.env.SUPABASE_S3_REGION ||
    process.env.S3_REGION ||
    process.env.AWS_REGION ||
    "auto";

  const forcePathStyle =
    process.env.LIVEKIT_S3_FORCE_PATH_STYLE !== "false";

  return new S3Upload({
    accessKey,
    secret,
    endpoint: endpoint || undefined,
    bucket,
    region,
    forcePathStyle,
  });
}

/** Reuse LiveKit's destination and credentials for private Supabase recordings. */
export function recordingS3Object(bucket: string, key: string) {
  const config = getS3UploadConfig();
  const project = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!config?.endpoint || !project || config.bucket !== bucket) return null;
  const endpoint = new URL(config.endpoint);
  const projectHost = new URL(project).hostname;
  if (endpoint.protocol !== "https:" || ![projectHost, projectHost.replace(".supabase.co", ".storage.supabase.co")].includes(endpoint.hostname)) return null;
  const path = key.split("/").map(encodeURIComponent).join("/");
  const client = new AwsClient({ accessKeyId: config.accessKey, secretAccessKey: config.secret,
    region: config.region, service: "s3", retries: 0 });
  const url = new URL(`${endpoint.href.replace(/\/$/, "")}/${encodeURIComponent(bucket)}/${path}`);
  return { client, url, reference: new URL(`/storage/v1/object/public/${encodeURIComponent(bucket)}/${path}`, project).href };
}
