import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaComments } from "react-icons/fa";
import { serviceChatService } from "../../services/serviceChatService";
import { serviceBazaarService } from "../../services/serviceBazaarService";
import { useToast } from "../../context/ToastContext";
import "./service-bazaar.css";

/**
 * Service Bazaar message inbox. Two tabs:
 *  - "My chats"  : conversations where I booked / contacted a provider (customer side)
 *  - "As provider": conversations from my customers (only if I am a provider)
 */
export default function ChatInboxScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [tab, setTab] = useState("customer");
  const [isProvider, setIsProvider] = useState(false);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    serviceBazaarService.getMyProviderProfile().then((res) => {
      setIsProvider(!!(res.success && res.data));
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const res = tab === "provider"
      ? await serviceChatService.getMyProviderThreads()
      : await serviceChatService.getMyThreads();
    if (res.success) setThreads(res.data?.records || []);
    else showToast(res.message || "Could not load conversations", "error");
    setLoading(false);
  }, [tab, showToast]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="sb-page">
      <div className="sb-topbar">
        <button className="sb-back" onClick={() => navigate("/customer/app/service-bazaar")} aria-label="Back"><FaArrowLeft /></button>
        <h1 className="sb-title">Messages</h1>
      </div>

      {isProvider && (
        <div className="sb-tabs">
          <button className={`sb-tab ${tab === "customer" ? "active" : ""}`} onClick={() => setTab("customer")}>My chats</button>
          <button className={`sb-tab ${tab === "provider" ? "active" : ""}`} onClick={() => setTab("provider")}>As provider</button>
        </div>
      )}

      {loading ? (
        <div className="sb-empty">Loading…</div>
      ) : threads.length === 0 ? (
        <div className="sb-empty"><FaComments style={{ fontSize: 28, opacity: 0.4, marginBottom: 8 }} /><br />No conversations yet.</div>
      ) : (
        <div className="sb-results">
          {threads.map((t) => {
            const name = tab === "provider"
              ? (t.customer?.name || "Customer")
              : (t.provider?.businessName || t.provider?.providerName || "Provider");
            const photo = tab === "provider" ? null : t.provider?.profilePhotoUrl;
            return (
              <button key={t.id} className="sb-chat-row" onClick={() => navigate(`/customer/app/service-bazaar/chat/${t.id}`)}>
                <div className="sb-avatar" style={{ width: 44, height: 44, flex: "0 0 auto" }}>
                  {photo ? <img src={photo} alt={name} style={{ width: "100%", height: "100%", borderRadius: 12, objectFit: "cover" }} /> : (name || "?").charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <p className="sb-card-name" style={{ fontSize: 15 }}>{name}</p>
                  <p className="sb-card-meta" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {t.lastMessage || "Tap to start chatting"}
                  </p>
                </div>
                {t.myUnread > 0 && <span className="sb-chat-badge">{t.myUnread}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
