import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaArrowLeft, FaBell, FaToggleOn, FaToggleOff, FaCheckCircle } from "react-icons/fa";
import { outstandingService } from "../../services/outstandingService";
import { Capacitor } from "@capacitor/core";
import { cancelReminder, scheduleReminder, ensureSmsPermission } from "../../services/smsService";

const formatINR = (n) => {
  const v = Number(n || 0);
  return `₹${Math.round(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const DEFAULT_TEMPLATE =
  "Namaste {name}, you have an outstanding balance of Rs.{balance} with {owner}. Please clear at your earliest convenience.";

const SmsReminderListScreen = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState([]);
  const [reminderConfigs, setReminderConfigs] = useState({});
  const [toggling, setToggling] = useState({}); // { [customerId]: true }
  const [successMsg, setSuccessMsg] = useState("");

  const isAndroid = Capacitor.getPlatform() === "android";

  const load = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await outstandingService.listCustomers(0, 100, "balance");
      if (!res?.success) {
        setError(res?.message || "Failed to load customers");
        setLoading(false);
        return;
      }

      const allCustomers = res.data?.records || [];
      // Filter only customers with positive balance (outstanding)
      const dueCustomers = allCustomers.filter(c => Number(c.balance || 0) > 0);
      setCustomers(dueCustomers);

      // Load reminder configs for each customer
      const configs = {};
      await Promise.all(
        dueCustomers.map(async (c) => {
          try {
            const configRes = await outstandingService.getReminderConfig(c.id);
            if (configRes?.success && configRes.data) {
              configs[c.id] = configRes.data;
            }
          } catch {}
        })
      );
      setReminderConfigs(configs);
    } catch (err) {
      setError("Failed to load customers");
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const buildMessage = (customer, template) => {
    return (template || DEFAULT_TEMPLATE)
      .replace(/\{name\}/gi, customer.customerName || "Customer")
      .replace(/\{balance\}/gi, Math.abs(customer.balance || 0).toLocaleString("en-IN"))
      .replace(/\{owner\}/gi, "");
  };

  const toggleReminder = async (customer) => {
    const customerId = customer.id;
    const currentConfig = reminderConfigs[customerId] || {};
    const newEnabled = !currentConfig.reminderEnabled;

    setToggling((prev) => ({ ...prev, [customerId]: true }));
    setSuccessMsg("");
    setError("");

    try {
      // Request SMS permission if enabling on Android
      if (newEnabled && isAndroid) {
        const hasPermission = await ensureSmsPermission();
        if (!hasPermission) {
          setError("SMS permission required. Please allow SMS permission.");
          setToggling((prev) => ({ ...prev, [customerId]: false }));
          return;
        }
      }

      // Update backend config
      const payload = {
        reminderEnabled: newEnabled,
        reminderFrequency: currentConfig.reminderFrequency || "DAILY",
        reminderTime: currentConfig.reminderTime || "10:00",
        reminderMinBalance: currentConfig.reminderMinBalance ?? 1,
        reminderTemplate: currentConfig.reminderTemplate || null,
      };

      const res = await outstandingService.updateReminderConfig(customerId, payload);

      if (!res?.success) {
        setError(res?.message || "Failed to update reminder");
        setToggling((prev) => ({ ...prev, [customerId]: false }));
        return;
      }

      // Schedule or cancel native reminder on Android
      if (isAndroid && customer.customerMobile) {
        try {
          if (newEnabled) {
            const message = buildMessage(customer, currentConfig.reminderTemplate);
            await scheduleReminder({
              customerId: String(customerId),
              customerName: customer.customerName,
              phoneNumber: customer.customerMobile,
              message: message,
              time: currentConfig.reminderTime || "10:00",
              frequency: currentConfig.reminderFrequency || "DAILY"
            });
          } else {
            await cancelReminder(customerId);
          }
        } catch {}
      }

      // Update local state
      setReminderConfigs((prev) => ({
        ...prev,
        [customerId]: { ...prev[customerId], reminderEnabled: newEnabled }
      }));

      setSuccessMsg(newEnabled
        ? `SMS reminder enabled for ${customer.customerName}`
        : `SMS reminder disabled for ${customer.customerName}`
      );

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(""), 3000);

    } catch (err) {
      setError("Failed to update reminder settings");
    }

    setToggling((prev) => ({ ...prev, [customerId]: false }));
  };

  const enabledCount = Object.values(reminderConfigs).filter(c => c.reminderEnabled).length;

  return (
    <div className="cm-page ol-page ol-sms-list-page">
      <header className="ol-ledger-header">
        <button className="ol-back-btn" onClick={() => navigate(-1)} aria-label="Back">
          <FaArrowLeft />
        </button>
        <div className="ol-ledger-title">
          <h2>Auto SMS Reminders</h2>
          {customers.length > 0 && (
            <span className="ol-sms-list-count">{enabledCount} of {customers.length} enabled</span>
          )}
        </div>
      </header>

      {loading ? (
        <ul className="ol-sms-list">
          {[1, 2, 3].map((i) => (
            <li key={i} className="ol-sms-card" style={{ opacity: 0.5 }}>
              <div className="ol-sms-card-info">
                <div style={{ width: "60%", height: 16, background: "var(--ol-line)", borderRadius: 8, marginBottom: 8 }} />
                <div style={{ width: "40%", height: 12, background: "var(--ol-line)", borderRadius: 6, marginBottom: 6 }} />
                <div style={{ width: "50%", height: 12, background: "var(--ol-line)", borderRadius: 6 }} />
              </div>
              <div style={{ width: 50, height: 40, background: "var(--ol-line)", borderRadius: 10 }} />
            </li>
          ))}
        </ul>
      ) : error ? (
        <div className="ol-error" style={{ margin: 16 }}>{error}</div>
      ) : customers.length === 0 ? (
        <div className="ol-empty-state">
          <FaCheckCircle size={36} className="ol-empty-icon" />
          <p>No customers with outstanding balance.</p>
        </div>
      ) : (
        <>
          <div className="ol-sms-list-hint">
            {isAndroid ? (
              <>
                Enable auto SMS for customers below. At the scheduled time, SMS will be sent automatically
                from your phone. Standard SMS charges apply.
              </>
            ) : (
              <>
                Enable reminders for customers below. You will receive notifications at the scheduled
                time to send SMS manually.
              </>
            )}
          </div>

          {successMsg && (
            <div className="ol-success-msg" style={{ margin: "0 16px 12px" }}>
              <FaCheckCircle /> {successMsg}
            </div>
          )}

          <ul className="ol-sms-list">
            {customers.map((customer) => {
              const config = reminderConfigs[customer.id] || {};
              const isEnabled = !!config.reminderEnabled;
              const isToggling = !!toggling[customer.id];

              return (
                <li key={customer.id} className={`ol-sms-card ${isEnabled ? "is-enabled" : ""}`}>
                  <div className="ol-sms-card-info">
                    <div className="ol-sms-card-name">{customer.customerName}</div>
                    <div className="ol-sms-card-mobile">+91 {customer.customerMobile}</div>
                    <div className="ol-sms-card-balance">
                      Outstanding: <strong>{formatINR(customer.balance)}</strong>
                    </div>
                    {isEnabled && config.reminderTime && (
                      <div className="ol-sms-card-schedule">
                        <FaBell size={10} /> Daily at {config.reminderTime}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    className={`ol-sms-toggle ${isEnabled ? "is-on" : "is-off"}`}
                    onClick={() => toggleReminder(customer)}
                    disabled={isToggling}
                    aria-label={isEnabled ? "Disable reminder" : "Enable reminder"}
                  >
                    {isToggling ? (
                      <span className="ol-sms-toggle-loading">...</span>
                    ) : isEnabled ? (
                      <>
                        <FaToggleOn size={28} />
                        <span>ON</span>
                      </>
                    ) : (
                      <>
                        <FaToggleOff size={28} />
                        <span>OFF</span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="ol-sms-list-footer">
            <p>
              Tap on a customer to configure detailed reminder settings like time,
              frequency, and custom message template.
            </p>
            <button
              type="button"
              className="ol-submit"
              onClick={() => navigate("/customer/app/outstanding")}
            >
              Go to Outstanding List
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default SmsReminderListScreen;
