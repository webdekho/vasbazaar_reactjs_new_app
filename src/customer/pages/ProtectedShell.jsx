import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { FaChevronRight, FaGift, FaRegBell, FaSignOutAlt, FaUserCircle, FaWallet } from "react-icons/fa";
import { HiMiniSquares2X2 } from "react-icons/hi2";
import { useCustomerModern } from "../context/CustomerModernContext";
import AppBrand from "../components/AppBrand";

const menuItems = [
  { to: "/customer/app/services", label: "Services", icon: <HiMiniSquares2X2 /> },
  { to: "/customer/app/wallet", label: "Wallet", icon: <FaWallet /> },
  { to: "/customer/app/coupons", label: "Coupons", icon: <FaGift /> },
  { to: "/customer/app/profile", label: "Profile", icon: <FaUserCircle /> },
];

const ProtectedShell = () => {
  const { logout, userData } = useCustomerModern();
  const location = useLocation();

  return (
    <div className="customer-modern-protected">
      <aside className="cm-sidebar">
        <AppBrand />
        <div className="cm-card">
          <strong>{userData?.name || userData?.firstName || "Customer"}</strong>
          <div className="cm-muted">{userData?.mobile || userData?.mobileNumber || "Active session"}</div>
        </div>
        <nav className="cm-side-links">
          {menuItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "is-active" : "")}>
              <span>{item.icon} {item.label}</span>
              <FaChevronRight />
            </NavLink>
          ))}
          <button type="button" onClick={logout}>
            <span><FaSignOutAlt /> Logout</span>
            <FaChevronRight />
          </button>
        </nav>
      </aside>

      <div className="cm-main">
        <header className="cm-topbar">
          <div className="cm-topbar-inner">
            <div className="cm-topbar-brand"><AppBrand /></div>
            <div className="cm-topbar-actions">
              <Link className="cm-icon-button" to="/customer/app/notifications"><FaRegBell /></Link>
              <button className="cm-icon-button" type="button" onClick={logout}><FaSignOutAlt /></button>
            </div>
          </div>
        </header>
        <main className="cm-content"><Outlet /></main>
        <nav className="cm-bottom-nav">
          {menuItems.map((item) => (
            <NavLink key={item.to} to={item.to} className={location.pathname === item.to ? "is-active" : ""}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default ProtectedShell;
