// npx tsx scripts/avatar-storage-smoke.mjs
// Writes only a uniquely named synthetic test image, then removes that image.
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { avatarStorage } from "../src/lib/avatar-storage.ts";
dotenv.config({ path: [".env.local", ".env"], quiet: true });
const path = `avatars/diagnostics/${randomUUID()}.webp`;
const storage = avatarStorage();
const image = await sharp({ create: { width: 32, height: 32, channels: 3, background: "#461278" } }).webp().toBuffer();
try {
  const uploaded = await storage.upload(path, image, { contentType: "image/webp", upsert: false });
  assert.equal(uploaded.error, null, "Could not upload test photo");
  const { data, error } = await storage.createSignedUrl(path, 60);
  assert.equal(error, null);
  const response = await fetch(data.signedUrl, { signal: AbortSignal.timeout(15000) });
  assert.equal(response.status, 200);
  const metadata = await sharp(Buffer.from(await response.arrayBuffer())).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 32);
  console.log("PASS durable avatar upload, signed download and image decoding on configured storage");
} finally {
  await storage.remove([path]);
  console.log("Removed synthetic test avatar");
}
