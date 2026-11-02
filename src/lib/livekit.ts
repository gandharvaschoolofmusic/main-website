import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  S3Upload,
} from "livekit-server-sdk";
import { logger } from "@/lib/logger";

export interface GenerateLessonTokenParams {
  lessonId: string;
  userId: string;
  userName: string;
  role: "TEACHER" | "STUDENT";
  instrument: string;
  durationMinutes: number;
  requestHost?: string;
  groupRoomId?: string | null; // shared room ID for group course lessons
}

export interface LessonTokenResult {
  token: string;
  roomName: string;
  serverUrl: string;
  identity: string;
  role: "TEACHER" | "STUDENT";
}

/**
 * Generate a cryptographically signed LiveKit Access Token for a lesson participant.
 *
 * Security guarantees:
 * 1. Room name is strictly derived server-side: `lesson-${lessonId}` (never client-supplied).
 * 2. Identity is pinned to the user's validated ID.
 * 3. `roomAdmin` grant is given only to the TEACHER role.
 * 4. Token TTL is bounded to the lesson duration plus a safe grace buffer.
 */
export async function generateLessonRoomToken(
  params: GenerateLessonTokenParams,
): Promise<LessonTokenResult> {
  const {
    lessonId,
    userId,
    userName,
    role,
    instrument,
    durationMinutes,
    requestHost,
  } = params;

  const apiKey = process.env.LIVEKIT_API_KEY || "devkey";
  const apiSecret =
    process.env.LIVEKIT_API_SECRET ||
    "toneroom_dev_secret_key_minimum_32_characters_long_01";
  let serverUrl =
    process.env.NEXT_PUBLIC_LIVEKIT_URL ||
    process.env.LIVEKIT_URL ||
    "ws://localhost:7880";

  // If serverUrl is still pointing to localhost, check if incoming request is from a LAN IP
  if (
    serverUrl.includes("localhost") ||
    serverUrl.includes("127.0.0.1")
  ) {
    if (requestHost) {
      const hostname = requestHost.split(":")[0];
      const isLanIp =
        /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(hostname);

      if (isLanIp) {
        // Adapt local LiveKit port to match the laptop's LAN IP so devices on same Wi-Fi can connect
        serverUrl = serverUrl
          .replace("localhost", hostname)
          .replace("127.0.0.1", hostname);
        logger.info(
          { originalUrl: process.env.NEXT_PUBLIC_LIVEKIT_URL, adaptedUrl: serverUrl, hostname },
          "Adapted LiveKit server URL to local LAN IP for local network device",
        );
      } else if (!hostname.includes("localhost") && hostname !== "127.0.0.1") {
        logger.warn(
          { requestHost, serverUrl },
          "External domain/tunnel detected while LiveKit server is pointing to localhost. Remote devices will fail to connect unless LiveKit Cloud (wss://...) is configured in .env.local",
        );
      }
    }
  }

  // Server-side derived room name — use groupRoomId for group course lessons
  // so all enrolled students join the same LiveKit room
  const roomName = params.groupRoomId || `lesson-${lessonId}`;
  const isTeacher = role === "TEACHER";

  // TTL: lesson duration + 30 minutes grace in seconds
  const ttlSeconds = (durationMinutes + 30) * 60;

  const at = new AccessToken(apiKey, apiSecret, {
    identity: userId,
    name: userName,
    metadata: JSON.stringify({
      role,
      instrument,
      isTeacher,
    }),
    ttl: `${ttlSeconds}s`,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    roomAdmin: isTeacher,
  });

  const token = await at.toJwt();

  logger.info(
    { lessonId, userId, role, roomName },
    "Minted LiveKit access token for lesson room",
  );

  return {
    token,
    roomName,
    serverUrl,
    identity: userId,
    role,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// LiveKit Server-Side Recording (Egress Engine)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes LiveKit WebSocket URL into an HTTP/HTTPS endpoint for Twirp RPC / EgressClient.
 */
export function getLiveKitHttpUrl(): string {
  const url =
    process.env.LIVEKIT_URL ||
    process.env.NEXT_PUBLIC_LIVEKIT_URL ||
    "http://localhost:7880";
  return url.replace(/^wss:\/\//i, "https://").replace(/^ws:\/\//i, "http://");
}

let cachedEgressClient: EgressClient | null = null;

/**
 * Returns a cached singleton instance of LiveKit EgressClient.
 */
export function getEgressClient(): EgressClient | null {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!apiKey || !apiSecret) {
    logger.warn("LiveKit API key or secret missing, cannot initialize EgressClient");
    return null;
  }
  if (!cachedEgressClient) {
    const host = getLiveKitHttpUrl();
    cachedEgressClient = new EgressClient(host, apiKey, apiSecret);
  }
  return cachedEgressClient;
}

/**
 * Constructs an S3Upload configuration for LiveKit Egress if storage credentials are configured.
 * Supports AWS S3, Supabase S3, Cloudflare R2, MinIO, or custom S3-compatible backends.
 * If credentials are not set in environment, returns undefined (LiveKit Cloud uses default project storage).
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
    // If not supplied in env, LiveKit Cloud automatically uses the default bucket
    // configured in the LiveKit Cloud Project Settings -> Egress dashboard.
    return undefined;
  }

  // Automatic Supabase S3 endpoint resolution if NEXT_PUBLIC_SUPABASE_URL is provided
  let endpoint = process.env.LIVEKIT_S3_ENDPOINT || process.env.S3_ENDPOINT;
  if (!endpoint && process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const supaUrl = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
      endpoint = `${supaUrl.origin}/storage/v1/s3`;
    } catch {}
  }

  const bucket =
    process.env.LIVEKIT_S3_BUCKET ||
    process.env.S3_BUCKET ||
    "recordings";

  const region =
    process.env.LIVEKIT_S3_REGION ||
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

/**
 * Starts a server-side Room Composite Egress recording for a live lesson.
 * This runs completely server-side in LiveKit Cloud without consuming any client CPU or upload bandwidth.
 * Idempotent: checks if recording is already active for this room before initiating a new one.
 */
export async function startLessonRoomEgress(params: {
  roomName: string;
  lessonId?: string;
  groupRoomId?: string | null;
}): Promise<{ success: boolean; egressId?: string; error?: string }> {
  const { roomName, lessonId, groupRoomId } = params;
  const egressClient = getEgressClient();
  if (!egressClient) {
    return { success: false, error: "EgressClient not configured (check LIVEKIT_API_KEY/SECRET)" };
  }

  try {
    // 1. Idempotency check: don't start multiple recordings for the same room
    const activeEgresses = await egressClient.listEgress({
      roomName,
      active: true,
    });

    if (activeEgresses && activeEgresses.length > 0) {
      const existing = activeEgresses[0];
      logger.info(
        { roomName, egressId: existing.egressId, status: existing.status },
        "LiveKit Room Composite Egress is already active for this room",
      );
      return { success: true, egressId: existing.egressId };
    }

    // 2. Build recording destination path
    const now = new Date();
    const dateStamp = now.toISOString().slice(0, 10);
    const timeStamp = `${String(now.getUTCHours()).padStart(2, "0")}h${String(now.getUTCMinutes()).padStart(2, "0")}m`;
    const identifier = lessonId || groupRoomId || roomName.replace(/[^a-zA-Z0-9]/g, "_");
    const fileName = `Gandharva_Lesson_${identifier}_${dateStamp}_${timeStamp}.mp4`;
    const filepath = `recordings/${fileName}`;

    // 3. Configure file output with optional S3 credentials
    const s3 = getS3UploadConfig();
    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      ...(s3 ? { output: { case: "s3", value: s3 } } : {}),
    });

    // 4. Start composite egress in 720p 30fps with dark theme layout
    const egressInfo = await egressClient.startRoomCompositeEgress(
      roomName,
      fileOutput,
      {
        layout: "grid-dark",
        encodingOptions: EncodingOptionsPreset.H264_720P_30,
      },
    );

    logger.info(
      { roomName, egressId: egressInfo.egressId, filepath },
      "Started LiveKit server-side Room Composite Egress successfully",
    );

    return { success: true, egressId: egressInfo.egressId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      { err, roomName },
      "Failed to initiate LiveKit server-side Room Composite Egress",
    );
    return { success: false, error: message };
  }
}

/**
 * Stops all active Egress instances running for a given room.
 */
export async function stopActiveRoomEgressByRoom(roomName: string): Promise<void> {
  const egressClient = getEgressClient();
  if (!egressClient) return;

  try {
    const activeEgresses = await egressClient.listEgress({
      roomName,
      active: true,
    });

    for (const egress of activeEgresses) {
      try {
        await egressClient.stopEgress(egress.egressId);
        logger.info(
          { roomName, egressId: egress.egressId },
          "Successfully stopped active LiveKit Room Egress",
        );
      } catch (stopErr) {
        logger.warn(
          { stopErr, egressId: egress.egressId },
          "Failed to cleanly stop individual LiveKit Egress",
        );
      }
    }
  } catch (err) {
    logger.warn({ err, roomName }, "Error checking or stopping active room egresses");
  }
}
