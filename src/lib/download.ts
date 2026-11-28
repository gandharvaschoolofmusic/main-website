/** Safe attachment names for response headers and storage download parameters. */
export function downloadFilename(value: string): string {
  return value.split(/[\\/]/).pop()?.replace(/[\x00-\x1f\x7f";]/g, "_").trim().slice(0, 180) || "download";
}

export function attachmentDisposition(filename: string): string {
  const safe = downloadFilename(filename);
  const ascii = safe.replace(/[^\x20-\x7e]/g, "_");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`;
}

/** Only used with the platform's authenticated, same-origin file endpoints. */
export function fileDownloadHref(source: string): string {
  const url = new URL(source, "https://download.invalid");
  if (url.origin !== "https://download.invalid" || !url.pathname.startsWith("/api/")) return source;
  url.searchParams.delete("resolve");
  url.searchParams.set("download", "1");
  return url.pathname + url.search;
}
