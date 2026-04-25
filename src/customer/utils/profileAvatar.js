// Profile photo storage + resolution helpers.
//
// Two persistent sources, tried in order:
//   1. profile_photo       — server URL (http...) from the API / upload response
//   2. profile_photo_local — data: URL of the cropped image (kept on-device so the
//                            photo survives refreshes and offline usage)
//
// Consumers ask for the candidate list with `getProfilePhotoCandidates(userData)`
// and render via the <ProfileAvatar /> component, which walks the list and falls
// back to the favicon if every candidate fails to load.

export const PROFILE_PHOTO_KEYS = {
  serverUrl: "profile_photo",
  localDataUrl: "profile_photo_local",
};

export const FAVICON_FALLBACK_SRC = "/favicon.png";

const isHttpUrl = (value) => typeof value === "string" && /^https?:\/\//i.test(value);
const isDataUrl = (value) => typeof value === "string" && value.startsWith("data:image/");

export const getProfilePhotoCandidates = (userData) => {
  const serverFromApi = userData?.profile || userData?.profilePhoto || userData?.photo || "";
  const serverFromStorage = typeof window !== "undefined" ? localStorage.getItem(PROFILE_PHOTO_KEYS.serverUrl) || "" : "";
  const localDataUrl = typeof window !== "undefined" ? localStorage.getItem(PROFILE_PHOTO_KEYS.localDataUrl) || "" : "";

  const candidates = [];
  if (isHttpUrl(serverFromApi)) candidates.push(serverFromApi);
  if (isHttpUrl(serverFromStorage) && !candidates.includes(serverFromStorage)) candidates.push(serverFromStorage);
  if (isDataUrl(localDataUrl)) candidates.push(localDataUrl);
  return candidates;
};

export const saveProfilePhoto = ({ dataUrl, serverUrl } = {}) => {
  if (typeof window === "undefined") return;
  if (isDataUrl(dataUrl)) localStorage.setItem(PROFILE_PHOTO_KEYS.localDataUrl, dataUrl);
  if (isHttpUrl(serverUrl)) localStorage.setItem(PROFILE_PHOTO_KEYS.serverUrl, serverUrl);
};

export const clearProfilePhoto = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROFILE_PHOTO_KEYS.serverUrl);
  localStorage.removeItem(PROFILE_PHOTO_KEYS.localDataUrl);
};

// Drop only the server URL (e.g., after it fails to load) so the local data URL
// remains available. Used on broken-image events for the server URL.
export const clearServerProfilePhoto = () => {
  if (typeof window === "undefined") return;
  localStorage.removeItem(PROFILE_PHOTO_KEYS.serverUrl);
};
