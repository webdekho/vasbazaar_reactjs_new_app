import { useState } from "react";

const ServiceIcon = ({ icon: Icon, iconUrl, accentColor, highlightColor }) => {
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
};

export default ServiceIcon;
