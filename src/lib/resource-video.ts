export const MAX_RESOURCE_VIDEO_SIZE = 250 * 1024 * 1024;
export const RESOURCE_FILE_ACCEPT = ".pdf,.mp3,.wav,.m4a,.ogg,.aac,.flac,.opus,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.zip,.mp4,.webm,.mov,.m4v,.mpeg,.mpg,.mpga";
const audioTypes: Record<string, string> = {
  mpga: "audio/mpeg", mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
  aac: "audio/aac", flac: "audio/flac", opus: "audio/ogg",
};

export function resourceAudioType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  return Object.hasOwn(audioTypes, extension) ? audioTypes[extension] : undefined;
}

export function isResourceAudio(name: string, mimeType?: string | null) {
  return !!resourceAudioType(name) || !!mimeType?.startsWith("audio/");
}

export function isResourceMedia(name: string, mimeType?: string | null) {
  return isResourceAudio(name, mimeType) || isResourceVideo(name, mimeType);
}

export function resourceMediaType(name: string, mimeType?: string) {
  if (/\.(mpeg|mpg)$/i.test(name) && mimeType === "audio/mpeg") return "audio/mpeg";
  return resourceAudioType(name) || resourceVideoType(name);
}

export function validateResourceMedia(name: string, size: number) {
  if (!resourceMediaType(name)) return "Choose MP3, WAV, M4A, OGG, AAC, FLAC, OPUS, MP4, WebM, MOV, M4V, MPEG, MPG, or MPGA.";
  if (!Number.isSafeInteger(size) || size <= 0) return "Choose a file that is not empty.";
  if (size > MAX_RESOURCE_VIDEO_SIZE) return "Audio and video files can be up to 250 MB.";
  return null;
}
const videoTypes: Record<string, string> = {
  mpeg: "video/mpeg", mpg: "video/mpeg", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4",
};

export function resourceVideoType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  return Object.hasOwn(videoTypes, extension) ? videoTypes[extension] : undefined;
}

export function isResourceVideo(name: string, mimeType?: string | null) {
  if (mimeType?.startsWith("audio/")) return false;
  return !!resourceVideoType(name) || !!mimeType?.startsWith("video/");
}

export function validateResourceVideo(name: string, size: number) {
  if (!resourceVideoType(name)) return "Choose an MP4, WebM, MOV, M4V, MPEG, or MPG video.";
  if (!Number.isSafeInteger(size) || size <= 0) return "Choose a video that is not empty.";
  if (size > MAX_RESOURCE_VIDEO_SIZE) return "Videos can be up to 250 MB. Choose a smaller video.";
  return null;
}
