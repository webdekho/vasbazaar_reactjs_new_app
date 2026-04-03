import { useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";

const LOGO_DARK = "https://webdekho.in/images/vasbazaar.png";
const LOGO_LIGHT = "https://webdekho.in/images/vasbazaar1.png";

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
