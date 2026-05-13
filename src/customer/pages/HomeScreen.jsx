import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaBookOpen, FaGift, FaRegBell, FaRocket, FaUsers, FaWallet } from "react-icons/fa";
import { useCustomerModern } from "../context/CustomerModernContext";
import { userService } from "../services/userService";
import { advertisementService } from "../services/advertisementService";
import { serviceService } from "../services/serviceService";
import { walletService } from "../services/walletService";
import { notificationService } from "../services/notificationService";
import DataState from "../components/DataState";
import ServiceIcon from "../components/ServiceIcon";
import { getServiceVisual, normalizeService, toSerializableService } from "../components/serviceUtils";

const HomeScreen = () => {
  const navigate = useNavigate();
  const { userData } = useCustomerModern();
  const [state, setState] = useState({
    loading: true, error: "", ads: [], services: [], walletRecords: [], notifications: [], profile: userData,
  });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setState((prev) => ({ ...prev, loading: true, error: "" }));
      const [profile, ads, services, wallet, notifications] = await Promise.all([
        userService.getUserProfile(),
        advertisementService.getHomeAdvertisements(),
        serviceService.getHomeServices(),
        walletService.getWalletTransactions(0, 6),
        notificationService.getNotifications(0),
      ]);
      // PERF FIX: Skip setState if component unmounted during fetch (prevents memory leak)
      if (cancelled) return;
      const error = [profile, ads, services, wallet, notifications].find((r) => !r.success)?.message || "";
      setState({
        loading: false, error,
        profile: profile.data || userData,
        ads: Array.isArray(ads.data) ? ads.data : [],
        services: (Array.isArray(services.data) ? services.data : []).map(normalizeService),
        walletRecords: wallet.data?.records || [],
        notifications: notifications.data?.records || notifications.data || [],
      });
    };
    load();
    return () => { cancelled = true; };
    /**
     * PERF FIX: Changed dependency from [userData] to [] (mount-only).
     * Previously, when context hydration updated userData, HomeScreen would
     * re-fetch all 5 APIs. The profile response then updated userData again,
     * risking a cascade. Now fetches once on mount — API cache ensures
     * getUserProfile() returns instantly if already fetched by context.
     */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quickLinks = [
    { label: "My Bills", to: "/customer/app/services/electricity", ...getServiceVisual("electricity") },
    { label: "Recharge", to: "/customer/app/services/prepaid", ...getServiceVisual("prepaid") },
    { label: "Wallet", to: "/customer/app/wallet", ...getServiceVisual("wallet") },
    { label: "ReBill", to: "/customer/app/outstanding", icon: FaBookOpen, accentColor: "#FFE9D6", highlightColor: "#FF7A00" },
    { label: "RYBBO", to: "/customer/app/rybbo", icon: FaRocket, accentColor: "#EDE4FF", highlightColor: "#7C3AED" },
    { label: "ReBuddy", to: "/customer/app/rebuddy", icon: FaUsers, accentColor: "#FFE7E0", highlightColor: "#E8735A" },
    { label: "Rewards", to: "/customer/app/coupons", ...getServiceVisual("rewards") },
  ];

  return (
    <DataState loading={state.loading} error={state.error}>
      <section className="cm-grid">
        <div className="cm-hero">
          <div className="cm-banner-card">
            <div className="cm-hero-grid">
              <div className="cm-hero-headline">
                <div className="cm-badge">Live customer app</div>
                <h1>{`Hi ${state.profile?.firstName || state.profile?.name || "Customer"}`}</h1>
                <p>A sharper account center for recharge, BBPS billing, wallet, coupons, AutoPay and notifications.</p>
                <div className="cm-pills">
                  <span className="cm-pill"><FaWallet /> Balance ready</span>
                  <span className="cm-pill"><FaGift /> Rewards enabled</span>
                  <span className="cm-pill"><FaRegBell /> Alerts active</span>
                </div>
              </div>
              <div className="cm-panel-grid">
                <div className="cm-kpi-card"><span className="cm-muted">Wallet balance</span><strong>₹{Number(state.profile?.balance || 0).toFixed(2)}</strong></div>
                <div className="cm-kpi-card"><span className="cm-muted">Cashback earned</span><strong>₹{Number(state.profile?.cashback || 0).toFixed(2)}</strong></div>
                <div className="cm-kpi-card"><span className="cm-muted">Incentive earned</span><strong>₹{Number(state.profile?.incentive || 0).toFixed(2)}</strong></div>
              </div>
            </div>
          </div>
        </div>

        <div className="cm-card" style={{ gridColumn: "span 12" }}>
          <div className="cm-section-head">
            <h2>Quick Access</h2>
            <button className="cm-button-ghost" type="button" onClick={() => navigate("/customer/app/services")}>View all</button>
          </div>
          <div className="cm-service-grid">
            {quickLinks.map((item) => (
              <button key={item.label} className="cm-service-card" type="button" onClick={() => navigate(item.to)}>
                <ServiceIcon icon={item.icon} accentColor={item.accentColor} highlightColor={item.highlightColor} />
                <div className="cm-service-name">{item.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="cm-card" style={{ gridColumn: "span 12" }}>
          <div className="cm-section-head">
            <h2>Services</h2>
            <button className="cm-button-ghost" type="button" onClick={() => navigate("/customer/app/services")}>Manage services</button>
          </div>
          <div className="cm-service-grid">
            {state.services.slice(0, 8).map((service) => (
              <button key={service.id} className="cm-service-card" type="button"
                onClick={() => navigate(`/customer/app/services/${service.slug}`, { state: { service: toSerializableService(service) } })}>
                <ServiceIcon icon={service.icon} iconUrl={service.iconUrl} accentColor={service.accentColor} highlightColor={service.highlightColor} />
                <div className="cm-service-name">{service.name}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="cm-two-col" style={{ gridColumn: "span 12" }}>
          <div className="cm-list-card">
            <div className="cm-section-head">
              <h2>Recent Wallet Activity</h2>
              <Link className="cm-link-button" to="/customer/app/wallet">Open wallet</Link>
            </div>
            {state.walletRecords.length === 0 ? (
              <div className="cm-empty">Wallet history will appear here after your first transaction.</div>
            ) : (
              <div className="cm-list">
                {state.walletRecords.slice(0, 4).map((item) => (
                  <div className="cm-list-item" key={item.id || item.txnId}>
                    <div>
                      <div className="cm-list-title">{item.operatorId?.operatorName || item.serviceType || "Transaction"}</div>
                      <div className="cm-muted">{item.txnId || item.message || "No reference"}</div>
                    </div>
                    <strong>{item.txnAmt || item.amount ? `₹${item.txnAmt || item.amount}` : item.status || "--"}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="cm-list-card">
            <div className="cm-section-head">
              <h2>Announcements</h2>
              <Link className="cm-link-button" to="/customer/app/notifications">See all</Link>
            </div>
            {state.notifications.length === 0 ? (
              <div className="cm-empty">New updates and offers will surface here.</div>
            ) : (
              <div className="cm-list">
                {state.notifications.slice(0, 4).map((item, index) => (
                  <div className="cm-list-item" key={item.id || index}>
                    <div>
                      <div className="cm-list-title">{item.title || "Announcement"}</div>
                      <div className="cm-muted">{item.message || item.date || "Customer update"}</div>
                    </div>
                    <span className="cm-chip">{item.status || "Live"}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {state.ads.length > 0 ? (
          <div className="cm-card" style={{ gridColumn: "span 12" }}>
            <div className="cm-section-head">
              <h2>Campaigns</h2>
              <span className="cm-muted">Live banners from the customer API</span>
            </div>
            <div className="cm-panel-grid">
              {state.ads.slice(0, 3).map((item) => (
                <div className="cm-card" key={item.id}>
                  <div className="cm-list-title">{item.title || "Campaign"}</div>
                  <p className="cm-muted">{item.description || "Promotional banner"}</p>
                  <div className="cm-chip-row">
                    <span className="cm-chip">{item.screen || "home"}</span>
                    <span className="cm-chip">{item.status || "active"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </DataState>
  );
};

export default HomeScreen;
