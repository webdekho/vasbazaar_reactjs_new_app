import { useEffect, useState } from "react";
import { userService } from "../services/userService";
import { walletService } from "../services/walletService";
import DataState from "../components/DataState";

const WalletScreen = () => {
  const [wallet, setWallet] = useState({ loading: true, error: "", records: [], balance: 0 });

  useEffect(() => {
    const load = async () => {
      const [profile, transactions] = await Promise.all([userService.getUserProfile(), walletService.getWalletTransactions(0, 20)]);
      setWallet({ loading: false, error: profile.success && transactions.success ? "" : profile.message || transactions.message, balance: Number(profile.data?.balance || 0), records: transactions.data?.records || [] });
    };
    load();
  }, []);

  return (
    <DataState loading={wallet.loading} error={wallet.error} empty={wallet.records.length === 0 ? "No wallet transactions found." : null}>
      <div className="cm-stack">
        <div className="cm-payment-card"><div className="cm-muted">Wallet balance</div><div className="cm-amount">₹{wallet.balance.toFixed(2)}</div></div>
        <div className="cm-card">
          <div className="cm-section-head"><h2>Wallet transactions</h2></div>
          <div className="cm-list">
            {wallet.records.map((item) => (
              <div className="cm-list-item" key={item.id || item.txnId}>
                <div><div className="cm-list-title">{item.operatorId?.operatorName || item.serviceType || "Wallet transaction"}</div><div className="cm-muted">{item.txnId || item.message || item.status}</div></div>
                <strong>{item.txnAmt || item.amount ? `₹${item.txnAmt || item.amount}` : item.status || "--"}</strong>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DataState>
  );
};

export default WalletScreen;
