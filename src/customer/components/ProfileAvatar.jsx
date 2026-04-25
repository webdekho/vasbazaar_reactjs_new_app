import { useEffect, useMemo, useState } from "react";
import { FAVICON_FALLBACK_SRC, clearServerProfilePhoto } from "../utils/profileAvatar";

// Renders a profile photo from a candidate list, walking forward on <img onError>.
// When every candidate fails to load, shows the favicon so a broken image icon
// never leaks to the UI. When the candidate list is empty, renders the caller's
// `emptyFallback` (typically a user-icon shaped placeholder).
const ProfileAvatar = ({
  candidates = [],
  className = "",
  alt = "Profile",
  emptyFallback = null,
}) => {
  // Stable key so the effect only resets when the source list actually changes.
  const key = useMemo(() => candidates.join("|"), [candidates]);
  const [index, setIndex] = useState(0);
  const [exhausted, setExhausted] = useState(false);

  useEffect(() => {
    setIndex(0);
    setExhausted(false);
  }, [key]);

  if (candidates.length === 0) {
    return emptyFallback;
  }

  if (exhausted) {
    return <img src={FAVICON_FALLBACK_SRC} alt={alt} className={className} />;
  }

  const src = candidates[index];

  const handleError = () => {
    // If the failing candidate was the stored server URL, drop it so we don't
    // keep re-attempting a URL the backend removed.
    if (src && /^https?:\/\//i.test(src)) {
      clearServerProfilePhoto();
    }
    if (index + 1 < candidates.length) {
      setIndex(index + 1);
    } else {
      setExhausted(true);
    }
  };

  return <img src={src} alt={alt} className={className} onError={handleError} />;
};

export default ProfileAvatar;
