/** Store only canonical YouTube playlist links; never arbitrary external URLs. */
export function normalizeYoutubePlaylist(value: string): string | null {
  const input = value.trim();
  if (!input) return null;
  if (input.length > 2048) throw new Error("The playlist link is too long.");
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("Paste a complete YouTube playlist link."); }
  const hosts = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"];
  if (url.protocol !== "https:" || !hosts.includes(url.hostname) || url.username || url.password || url.port) {
    throw new Error("Use an HTTPS link from YouTube.");
  }
  if (url.hostname !== "youtu.be" && !["/playlist", "/watch"].includes(url.pathname)) {
    throw new Error("Use a playlist link, not a channel or video-only link.");
  }
  const ids = url.searchParams.getAll("list");
  if (ids.length !== 1 || !/^[A-Za-z0-9_-]{10,100}$/.test(ids[0])) {
    throw new Error("This link has no valid playlist. Copy the playlist's share link from YouTube.");
  }
  return `https://www.youtube.com/playlist?list=${ids[0]}`;
}
