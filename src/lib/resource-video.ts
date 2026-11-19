export const MAX_RESOURCE_VIDEO_SIZE = 250 * 1024 * 1024;
export const RESOURCE_FILE_ACCEPT = ".pdf,.mp3,.wav,.m4a,.ogg,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.zip,.mp4,.webm,.mov,.m4v";
const videoTypes: Record<string, string> = {
  mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", m4v: "video/mp4",
};

export function resourceVideoType(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "";
  return Object.hasOwn(videoTypes, extension) ? videoTypes[extension] : undefined;
}

export function isResourceVideo(name: string, mimeType?: string | null) {
  return !!resourceVideoType(name) || !!mimeType?.startsWith("video/");
}

export function validateResourceVideo(name: string, size: number) {
  if (!resourceVideoType(name)) return "Choose an MP4, WebM, MOV, or M4V video.";
  if (!Number.isSafeInteger(size) || size <= 0) return "Choose a video that is not empty.";
  if (size > MAX_RESOURCE_VIDEO_SIZE) return "Videos can be up to 250 MB. Choose a smaller video.";
  return null;
}
