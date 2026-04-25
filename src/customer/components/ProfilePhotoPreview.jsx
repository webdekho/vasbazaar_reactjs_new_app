import { useEffect } from "react";
import { FaTimes } from "react-icons/fa";
import ProfileAvatar from "./ProfileAvatar";

// Full-screen zoom preview for the profile photo.
// Tap outside the circle (or the close button) dismisses.
// Escape key also dismisses for desktop users.
const ProfilePhotoPreview = ({ open, candidates = [], name, onClose, emptyFallback = null }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="cm-photo-preview-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Profile photo"
      onClick={onClose}
    >
      <button type="button" className="cm-photo-preview-close" onClick={onClose} aria-label="Close">
        <FaTimes />
      </button>
      <div className="cm-photo-preview-stage" onClick={(e) => e.stopPropagation()}>
        <div className="cm-photo-preview-circle">
          <ProfileAvatar
            candidates={candidates}
            className="cm-photo-preview-img"
            alt={name || "Profile photo"}
            emptyFallback={emptyFallback}
          />
        </div>
        {name && <div className="cm-photo-preview-name">{name}</div>}
      </div>
    </div>
  );
};

export default ProfilePhotoPreview;
