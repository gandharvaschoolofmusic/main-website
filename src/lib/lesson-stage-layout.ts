import { Track, type Participant, type TrackPublication } from "livekit-client";

export type LessonStageItem = {
  key: string;
  participant: Participant;
  publication?: TrackPublication;
  source: Track.Source.Camera | Track.Source.ScreenShare;
  label: string;
};
export type LessonStageTile = LessonStageItem & { x: number; y: number; width: number; height: number };

function details(participant: Participant) {
  try {
    const value = JSON.parse(participant.metadata || "{}");
    return value && typeof value === "object" ? value as { role?: string; companion?: boolean } : {};
  }
  catch { return {}; }
}

/** Stable ordering across viewers, reconnects and speaking changes. */
export function lessonStageItems(participants: Participant[], excludedIdentity?: string): LessonStageItem[] {
  const rank = (p: Participant) => details(p).companion ? 4 : ({ TEACHER: 0, STUDENT: 1, ADMIN: 2 }[details(p).role || ""] ?? 3);
  const ordered = participants.filter(p => p.identity !== excludedIdentity)
    .sort((a, b) => rank(a) - rank(b) || a.identity.localeCompare(b.identity));
  const items: LessonStageItem[] = [];
  for (const participant of ordered) {
    const publications = [...participant.videoTrackPublications.values()];
    const cameras = publications.filter(pub => pub.source === Track.Source.Camera);
    const primary = cameras.find(pub => pub.trackName !== "secondary-camera");
    const role = details(participant).role;
    const label = [participant.name || "Participant", role && ["TEACHER", "STUDENT", "ADMIN"].includes(role)
      ? role.charAt(0) + role.slice(1).toLowerCase() : ""].filter(Boolean).join(" · ");
    // A participant keeps their position even with camera disabled/unpublished.
    items.push({ key: `${participant.identity}:camera`, participant, publication: primary, source: Track.Source.Camera, label });
    for (const publication of cameras.filter(pub => pub !== primary)) {
      items.push({ key: `${participant.identity}:${publication.trackName}`, participant, publication, source: Track.Source.Camera, label: `${label} · Instrument camera` });
    }
    for (const publication of publications.filter(pub => pub.source === Track.Source.ScreenShare && !pub.isMuted)) {
      items.push({ key: `${participant.identity}:screen:${publication.trackSid}`, participant, publication, source: Track.Source.ScreenShare, label: `${participant.name || "Participant"} · Shared screen` });
    }
  }
  return items;
}

/** Normalized geometry shared by DOM and canvas; never uses active-speaker state. */
export function lessonStageLayout(items: LessonStageItem[]): LessonStageTile[] {
  const screens = items.filter(item => item.source === Track.Source.ScreenShare);
  const cameras = items.filter(item => item.source !== Track.Source.ScreenShare);
  if (screens.length) {
    const shareWidth = cameras.length ? 0.72 : 1;
    return [
      ...screens.map((item, i) => ({ ...item, x: 0, y: i / screens.length, width: shareWidth, height: 1 / screens.length })),
      ...cameras.map((item, i) => ({ ...item, x: shareWidth, y: i / cameras.length, width: 1 - shareWidth, height: 1 / cameras.length })),
    ];
  }
  const columns = Math.min(3, Math.max(1, cameras.length));
  const rows = Math.ceil(cameras.length / columns);
  return cameras.map((item, i) => ({ ...item, x: (i % columns) / columns, y: Math.floor(i / columns) / rows, width: 1 / columns, height: 1 / rows }));
}

/** Fit each source without cropping or stretching, including screen shares. */
export function drawLessonStage(ctx: CanvasRenderingContext2D, tiles: LessonStageTile[], videos: Map<string, { video: HTMLVideoElement }>) {
  const { width, height } = ctx.canvas;
  ctx.fillStyle = "#111111";
  ctx.fillRect(0, 0, width, height);
  for (const tile of tiles) {
    const gap = width / 320;
    const x = tile.x * width + gap, y = tile.y * height + gap;
    const w = tile.width * width - gap * 2, h = tile.height * height - gap * 2;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = "#202124"; ctx.fillRect(x, y, w, h);
    const video = tile.publication && !tile.publication.isMuted ? videos.get(tile.publication.trackSid)?.video : undefined;
    if (video && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
      const scale = Math.min(w / video.videoWidth, h / video.videoHeight);
      const dw = video.videoWidth * scale, dh = video.videoHeight * scale;
      ctx.drawImage(video, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    } else {
      ctx.fillStyle = "#e3e3e3"; ctx.textAlign = "center";
      ctx.font = `${Math.min(w, h) * 0.18}px Arial`;
      ctx.fillText((tile.participant.name || "P").trim().charAt(0).toUpperCase(), x + w / 2, y + h / 2);
    }
    const labelSize = Math.max(12, width / 80);
    ctx.font = `${labelSize}px Arial`; ctx.textAlign = "left";
    ctx.fillStyle = "rgba(17,17,17,0.8)"; ctx.fillRect(x, y + h - labelSize * 2, w, labelSize * 2);
    ctx.fillStyle = "#e3e3e3"; ctx.fillText(tile.label, x + gap * 2, y + h - labelSize * 0.6, w - gap * 4);
    ctx.restore();
  }
}
