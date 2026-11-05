import { photoError } from "./listingModel.js";

export function uploadError(message) {
  return Object.assign(new Error(message), { code: "photo/upload" });
}

// Only cloud name and restricted unsigned preset are public. Never put an API secret
// in VITE_* variables. Presets cannot enforce Firebase authentication: restrict formats,
// disable public IDs/overwrites, and monitor the Free account's shared upload quota.
export async function uploadPhoto(file, config, request = fetch) {
  const invalid = photoError(file);
  if (!file || invalid) throw uploadError(invalid || "Choose a photo.");
  const { cloudName, uploadPreset } = config;
  if (!/^[a-z0-9_-]+$/i.test(cloudName || "") || !uploadPreset) {
    throw uploadError(
      "Photo uploads are not configured yet. Please try again later.",
    );
  }
  const body = new FormData();
  body.append("file", file);
  body.append("upload_preset", uploadPreset);
  let response;
  try {
    response = await request(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: "POST",
        body,
        signal: AbortSignal.timeout(60000),
      },
    );
  } catch {
    throw uploadError(
      "Photo upload interrupted. Check your connection and try again.",
    );
  }
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw uploadError(
      "Photo upload failed. Please try again or choose another image.",
    );
  let url;
  try {
    url = new URL(result?.secure_url);
  } catch {
    throw uploadError(
      "The photo service returned an invalid image. Please try again.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.hostname !== "res.cloudinary.com" ||
    !url.pathname.startsWith(`/${cloudName}/image/upload/`) ||
    !result.public_id
  ) {
    throw uploadError(
      "The photo service returned an invalid image. Please try again.",
    );
  }
  return {
    photoURL: url.href,
    photoPublicId: result.public_id,
    deleteToken: result.delete_token || "",
  };
}

// Cloudinary can issue a short-lived deletion token for cleanup after a failed save.
// It is kept in memory only, never saved in a publicly readable listing.
export async function discardUpload(upload, config, request = fetch) {
  if (!upload?.deleteToken) return;
  const body = new FormData();
  body.append("token", upload.deleteToken);
  await request(
    `https://api.cloudinary.com/v1_1/${config.cloudName}/delete_by_token`,
    { method: "POST", body, signal: AbortSignal.timeout(10000) },
  );
}
