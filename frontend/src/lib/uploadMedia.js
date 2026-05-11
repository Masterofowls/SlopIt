import { api } from "./api";


export const MAX_FILE_BYTES = 500 * 1024 * 1024;
export const MAX_FILE_MB = 500;


const SUPPORTED_PREFIXES = ["image/", "video/"];


export function validateMediaFile(file) {
  const isSupported = SUPPORTED_PREFIXES.some((p) => file.type.startsWith(p));
  if (!isSupported) {
    throw new Error(
      `"${file.name}" is not a supported media type (images and videos only).`,
    );
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / 1024 / 1024).toFixed(1);
    throw new Error(
      `"${file.name}" is ${mb} MB — exceeds the ${MAX_FILE_MB} MB limit.`,
    );
  }
}


export async function uploadMediaFile(file, onProgress) {
  validateMediaFile(file);

  const formData = new FormData();
  formData.append("file", file);

  const { data } = await api.post("/media/", formData, {
    headers: { "Content-Type": undefined },
    onUploadProgress: onProgress
      ? (evt) => {
          if (evt.total) onProgress(Math.round((evt.loaded * 100) / evt.total));
        }
      : undefined,
  });

  const url = data?.url || data?.file?.url;
  if (!url) {
    throw new Error("Upload failed: server did not return a file URL.");
  }

  return { success: 1, file: { url, name: file.name, size: file.size } };
}
