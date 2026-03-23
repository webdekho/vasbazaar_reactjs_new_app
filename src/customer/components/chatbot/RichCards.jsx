import { FaWallet, FaGift, FaUsers, FaStar, FaCheck, FaTimes, FaTag, FaArrowUp, FaArrowDown } from "react-icons/fa";

// ── Balance Card ──
export const BalanceCard = ({ data }) => (
  <div className="cb-card cb-card--balance">
    <div className="cb-balance-main">
      <FaWallet className="cb-balance-icon" />
      <div>
        <div className="cb-balance-label">Wallet Balance</div>
        <div className="cb-balance-amount">₹{data.balance}</div>
      </div>
    </div>
    <div className="cb-balance-grid">
      <div className="cb-balance-item"><FaGift size={10} /> Cashback <strong>₹{data.cashback}</strong></div>
      <div className="cb-balance-item"><FaStar size={10} /> Incentive <strong>₹{data.incentive}</strong></div>
      <div className="cb-balance-item"><FaUsers size={10} /> Referral <strong>₹{data.referralBonus}</strong></div>
    </div>
  </div>
);

// ── Transaction List ──
export const TransactionsCard = ({ data }) => (
  <div className="cb-card cb-card--txns">
    {data.map((t) => (
      <div key={t.id} className="cb-txn-row">
        <div className={`cb-txn-icon ${t.type === "credit" ? "cb-txn-icon--credit" : ""}`}>
          {t.type === "credit" ? <FaArrowDown /> : <FaArrowUp />}
        </div>
        <div className="cb-txn-info">
          <div className="cb-txn-name">{t.operator}</div>
          <div className="cb-txn-date">{t.date ? new Date(t.date).toLocaleDateString("en-IN") : "—"}</div>
        </div>
        <div className="cb-txn-right">
          <div className={`cb-txn-amount ${t.type === "credit" ? "cb-txn-amount--credit" : ""}`}>
            {t.type === "credit" ? "+" : "-"}₹{Number(t.amount || 0).toFixed(2)}
          </div>
          <div className={`cb-txn-status cb-txn-status--${(t.status || "").toLowerCase()}`}>{t.status}</div>
        </div>
      </div>
    ))}
  </div>
);

// ── Offers Card ──
export const OffersCard = ({ data }) => (
  <div className="cb-card cb-card--offers">
    {data.map((o) => (
      <div key={o.id} className="cb-offer-row">
        <div className="cb-offer-badge"><FaTag /></div>
        <div className="cb-offer-info">
          <div className="cb-offer-name">{o.name}</div>
          <div className="cb-offer-desc">{o.type === "PERCENTAGE" ? `${o.amount}% OFF` : `₹${o.amount} OFF`} • {o.category}</div>
        </div>
        {o.code && <div className="cb-offer-code">{o.code}</div>}
      </div>
    ))}
  </div>
);

// ── Confirmation Card ──
export const ConfirmationCard = ({ data, onConfirm, onCancel }) => (
  <div className="cb-card cb-card--confirm">
    <div className="cb-confirm-title">Confirm {data.action === "recharge" ? "Recharge" : "Payment"}</div>
    <div className="cb-confirm-grid">
      {data.mobile && <div className="cb-confirm-row"><span>Mobile</span><strong>{data.mobile}</strong></div>}
      {data.operator && <div className="cb-confirm-row"><span>Operator</span><strong>{data.operator}</strong></div>}
      {data.circle && <div className="cb-confirm-row"><span>Circle</span><strong>{data.circle}</strong></div>}
      <div className="cb-confirm-row cb-confirm-row--total"><span>Amount</span><strong>₹{data.amount}</strong></div>
    </div>
    <div className="cb-confirm-actions">
      <button type="button" className="cb-confirm-btn cb-confirm-btn--yes" onClick={() => onConfirm(data)}><FaCheck /> Confirm & Pay</button>
      <button type="button" className="cb-confirm-btn cb-confirm-btn--no" onClick={onCancel}><FaTimes /> Cancel</button>
    </div>
  </div>
);

// ── Escalation Card ──
export const EscalateCard = ({ onLiveChat, onCall, onWhatsApp }) => (
  <div className="cb-card cb-card--escalate">
    <div className="cb-escalate-title">Connect with Support</div>
    <div className="cb-escalate-btns">
      <button type="button" className="cb-escalate-btn" onClick={onLiveChat}>💬 Live Chat</button>
      <button type="button" className="cb-escalate-btn" onClick={onCall}>📞 Call</button>
      <button type="button" className="cb-escalate-btn" onClick={onWhatsApp}>💚 WhatsApp</button>
    </div>
  </div>
);
