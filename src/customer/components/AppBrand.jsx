import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const LOGO_DARK = "/images/vasbazaar-dark.png";
const LOGO_LIGHT = "/images/vasbazaar-light.png";

const AppBrand = ({ subtitle }) => {
  const { theme } = useTheme();
  const navigate = useNavigate();
  return (
    <div className="cm-brand" onClick={() => navigate("/customer/app/services")} style={{ cursor: "pointer" }}>
      <img src={theme === "light" ? LOGO_LIGHT : LOGO_DARK} alt="VasBazaar" className="cm-brand-logo" />
      {subtitle ? <div style={{ color: 'var(--cm-muted, #B0B0B0)', fontSize: '0.75rem' }}>{subtitle}</div> : null}
    </div>
  );
};

export default AppBrand;
