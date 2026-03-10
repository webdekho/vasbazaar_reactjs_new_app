import { useCustomerModern } from "../context/CustomerModernContext";

const ProfileScreen = () => {
  const { userData } = useCustomerModern();

  return (
    <div className="cm-stack">
      <div className="cm-card"><h1>Profile</h1><p className="cm-page-subtitle">Current customer profile surfaced through the existing customer user API.</p></div>
      <div className="cm-panel-grid">
        <div className="cm-card"><div className="cm-list-title">{userData?.name || userData?.firstName || "Customer"}</div><p className="cm-muted">{userData?.email || "No email available"}</p></div>
        <div className="cm-card"><div className="cm-muted">Mobile</div><strong>{userData?.mobile || userData?.mobileNumber || "--"}</strong></div>
        <div className="cm-card"><div className="cm-muted">Referral code</div><strong>{userData?.referalCode || userData?.referralCode || "--"}</strong></div>
        <div className="cm-card"><div className="cm-muted">User type</div><strong>{userData?.userType || "customer"}</strong></div>
      </div>
    </div>
  );
};

export default ProfileScreen;
