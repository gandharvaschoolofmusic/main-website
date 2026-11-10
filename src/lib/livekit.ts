import {
  AccessToken,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  EncodingOptionsPreset,
  EgressStatus,
  type EgressInfo,
} from "livekit-server-sdk";
import { getS3UploadConfig, recordingS3Object } from "./recording-s3";
export { getS3UploadConfig } from "./recording-s3";
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
  // A stale public build variable must not send participants to one Cloud
  // project while the recorder uses another. Keep self-hosted LAN routing.
  const recordingServer = process.env.LIVEKIT_URL;
  if (recordingServer && new URL(recordingServer).hostname.endsWith(".livekit.cloud") &&
      new URL(serverUrl).hostname.endsWith(".livekit.cloud")) {
    serverUrl = recordingServer.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
  }

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

export function completedRecordingFile(job: EgressInfo) {
  if (job.status !== EgressStatus.EGRESS_COMPLETE) return undefined;
  return job.fileResults[0] ?? (job.result.case === "file" ? job.result.value : undefined);
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
    // An unrelated active job cannot guarantee delivery to this archive.
    const s3 = getS3UploadConfig();
    if (!s3) {
      logger.info(
        { roomName },
        "S3 storage credentials not configured in env; skipping server egress so client recorder archives session to Supabase directly",
      );
      return { success: false, error: "S3_NOT_CONFIGURED" };
    }

    const target = recordingS3Object(s3.bucket, "");
    if (target) {
      const bucket = await target.client.fetch(target.url.href.replace(/\/$/, ""), {
        method: "HEAD", signal: AbortSignal.timeout(8000), cache: "no-store",
      });
      if (!bucket.ok) {
        logger.warn({ roomName, status: bucket.status }, "Recording bucket check failed; using the browser recorder");
        return { success: false, error: "S3_DESTINATION_UNAVAILABLE" };
      }
    }

    // 1. Idempotency check: don't start multiple recordings for the same room
    const activeEgresses = await egressClient.listEgress({
      roomName,
      active: true,
    });

    const existing = activeEgresses.find(job =>
      (job.status === EgressStatus.EGRESS_ACTIVE || job.status === EgressStatus.EGRESS_STARTING) &&
      job.request.case === "roomComposite" && !job.request.value.audioOnly && !job.request.value.videoOnly &&
      [...job.request.value.fileOutputs, ...(job.request.value.output.case === "file" ? [job.request.value.output.value] : [])]
        .some(file => file.output.case === "s3" && file.output.value.bucket === s3.bucket));
    if (existing) {
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
    const fileName = `Gandharva_Lesson_${identifier}_${dateStamp}_${timeStamp}_${crypto.randomUUID()}.mp4`;
    const filepath = fileName;

    const fileOutput = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath,
      output: { case: "s3", value: s3 },
    });

    // 4. Start composite egress in 720p 30fps with retry backoff for initial room creation
    let egressInfo: EgressInfo | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        egressInfo = await egressClient.startRoomCompositeEgress(
          roomName,
          fileOutput,
          {
            layout: "single-speaker",
            audioOnly: false,
            videoOnly: false,
            encodingOptions: EncodingOptionsPreset.H264_720P_30,
          },
        );
        break;
      } catch (egressErr) {
        lastError = egressErr;
        const msg = egressErr instanceof Error ? egressErr.message : String(egressErr);
        if ((msg.includes("does not exist") || msg.includes("not found")) && attempt < 2) {
          logger.info({ roomName, attempt, msg }, "Room not yet registered on LiveKit Cloud, backing off 2s before retry...");
          await new Promise((r) => setTimeout(r, 2000));
        } else {
          throw egressErr;
        }
      }
    }

    if (!egressInfo) {
      throw lastError || new Error("Failed to start LiveKit Room Composite Egress");
    }

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
