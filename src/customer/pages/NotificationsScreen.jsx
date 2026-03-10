import { useEffect, useState } from "react";
import { notificationService } from "../services/notificationService";
import DataState from "../components/DataState";

const NotificationsScreen = () => {
  const [notifications, setNotifications] = useState({ loading: true, error: "", records: [] });

  useEffect(() => {
    const load = async () => {
      const response = await notificationService.getNotifications(0);
      setNotifications({ loading: false, error: response.success ? "" : response.message, records: response.data?.records || response.data || [] });
    };
    load();
  }, []);

  return (
    <DataState loading={notifications.loading} error={notifications.error} empty={notifications.records.length === 0 ? "No announcements available." : null}>
      <div className="cm-stack">
        <div className="cm-card"><h1>Notifications</h1><p className="cm-page-subtitle">Announcements and live customer communications from the existing API.</p></div>
        <div className="cm-list-card">
          <div className="cm-list">
            {notifications.records.map((item, index) => (
              <div className="cm-list-item" key={item.id || index}>
                <div><div className="cm-list-title">{item.title || "Announcement"}</div><div className="cm-muted">{item.message || item.date || "New notification"}</div></div>
                <span className="cm-chip">{item.status || "Live"}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DataState>
  );
};

export default NotificationsScreen;
