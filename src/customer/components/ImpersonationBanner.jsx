import { FaSignOutAlt, FaUserShield } from "react-icons/fa";
import { isImpersonationSession, getImpersonatedName, exitImpersonation } from "../utils/impersonation";

/**
 * Sticky banner shown while an admin is viewing the customer app via the
 * "Login As" action. "Return to admin" ends the impersonated session and
 * navigates back to the admin panel the admin came from.
 */
const ImpersonationBanner = () => {
  if (!isImpersonationSession()) return null;

  const name = getImpersonatedName();

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 9999,
        width: "100%",
        background: "#F59E0B",
        color: "#000",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "8px 14px",
        fontSize: 13,
        fontWeight: 500,
        paddingTop: "calc(8px + env(safe-area-inset-top, 0px))",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <FaUserShield style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          Admin view{name ? ` — ${name}` : ""}
        </span>
      </span>
      <button
        onClick={exitImpersonation}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "5px 12px",
          borderRadius: 8,
          border: "none",
          background: "rgba(0,0,0,0.85)",
          color: "#fff",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <FaSignOutAlt size={12} /> Return to admin
      </button>
    </div>
  );
};

export default ImpersonationBanner;
