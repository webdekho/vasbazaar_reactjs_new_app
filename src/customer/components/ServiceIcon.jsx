const ServiceIcon = ({ icon: Icon, accentColor, highlightColor }) => (
  <div
    className="cm-service-icon"
    style={{
      "--cm-service-accent": accentColor,
      "--cm-service-highlight": highlightColor,
    }}
  >
    <Icon />
  </div>
);

export default ServiceIcon;
