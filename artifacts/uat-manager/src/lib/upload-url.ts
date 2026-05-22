import { getAuthToken } from "./auth";

/** Build an authenticated URL for uploaded files (img src, links). */
export function resolveUploadUrl(fileUrl: string): string {
  if (!fileUrl) return fileUrl;

  const path = fileUrl.startsWith("/uploads/")
    ? `/api${fileUrl}`
    : fileUrl.startsWith("/api/uploads/")
      ? fileUrl
      : fileUrl;

  const token = getAuthToken();
  if (!token) return path;

  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}access_token=${encodeURIComponent(token)}`;
}
