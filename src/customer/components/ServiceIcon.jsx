import { memo, useState } from "react";

/**
 * PERF FIX: Wrapped with React.memo to prevent unnecessary re-renders.
 * ServiceIcon renders 30+ times on ServicesScreen and 8+ on HomeScreen.
 * Without memoization, every parent state change (search typing, filter change)
 * caused all icons to re-render even though their props hadn't changed.
 */
const ServiceIcon = memo(({ icon: Icon, iconUrl, accentColor, highlightColor }) => {
  const [imgError, setImgError] = useState(false);

  const showImage = iconUrl && !imgError;

  return (
    <div
      className="cm-service-icon"
      style={{
        "--cm-service-accent": accentColor,
        "--cm-service-highlight": highlightColor,
      }}
    >
      {showImage ? (
        <img
          src={iconUrl}
          alt=""
          className="cm-service-icon-img"
          onError={() => setImgError(true)}
        />
      ) : (
        <Icon />
      )}
    </div>
  );
});

ServiceIcon.displayName = "ServiceIcon";

export default ServiceIcon;
