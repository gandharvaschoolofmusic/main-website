import { getSupabaseClient } from "@/lib/supabase-storage";
import { projectStorageS3Object } from "@/lib/recording-s3";

export const AVATAR_BUCKET = "resources";

export function avatarPath(image: string | null | undefined, userId: string) {
  if (!image) return null;
  const match = image.match(/^\/api\/avatars\/([^/?]+)\?v=([a-f0-9-]{36})$/);
  return match?.[1] === userId ? `avatars/${userId}/${match[2]}.webp` : null;
}

export function avatarStorage() {
  // Deployments using S3 for recordings need not expose a separate REST service
  // key. The helper validates that the endpoint belongs to this Supabase project.
  if (projectStorageS3Object(AVATAR_BUCKET, "avatars")) {
    return {
      async upload(path: string, buffer: Buffer, options: { contentType: string; upsert: boolean }) {
        const s3 = projectStorageS3Object(AVATAR_BUCKET, path)!;
        const response = await s3.client.fetch(s3.url, { method: "PUT", body: new Uint8Array(buffer),
          headers: { "Content-Type": options.contentType }, signal: AbortSignal.timeout(15_000) });
        return { error: response.ok ? null : { message: `Storage upload failed (${response.status})` } };
      },
      async remove(paths: string[]) {
        await Promise.all(paths.map(async path => {
          const s3 = projectStorageS3Object(AVATAR_BUCKET, path)!;
          const response = await s3.client.fetch(s3.url, { method: "DELETE", signal: AbortSignal.timeout(10_000) });
          if (!response.ok && response.status !== 404) throw new Error("Could not remove old avatar.");
        }));
      },
      async createSignedUrl(path: string, seconds: number) {
        const s3 = projectStorageS3Object(AVATAR_BUCKET, path)!;
        s3.url.searchParams.set("X-Amz-Expires", String(seconds));
        const signed = await s3.client.sign(s3.url, { aws: { signQuery: true } });
        return { data: { signedUrl: signed.url }, error: null };
      },
    };
  }
  const client = getSupabaseClient();
  if (!client) throw new Error("Profile photo storage is not configured. Please contact administration.");
  return client.storage.from(AVATAR_BUCKET);
}
