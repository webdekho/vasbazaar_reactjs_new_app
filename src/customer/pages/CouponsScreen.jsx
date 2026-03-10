import { useEffect, useState } from "react";
import { couponService } from "../services/couponService";
import DataState from "../components/DataState";

const CouponsScreen = () => {
  const [coupons, setCoupons] = useState({ loading: true, error: "", records: [] });

  useEffect(() => {
    const load = async () => {
      const response = await couponService.getCoupons(0, 20);
      setCoupons({ loading: false, error: response.success ? "" : response.message, records: response.data?.records || response.data?.allCoupons || [] });
    };
    load();
  }, []);

  return (
    <DataState loading={coupons.loading} error={coupons.error} empty={coupons.records.length === 0 ? "No coupons available yet." : null}>
      <div className="cm-stack">
        <div className="cm-card"><h1>Coupons</h1><p className="cm-page-subtitle">Reward inventory pulled from the current customer transaction coupon API.</p></div>
        <div className="cm-panel-grid">
          {coupons.records.map((coupon, index) => (
            <div className="cm-card" key={coupon.txnId || coupon.id || index}>
              <div className="cm-section-head"><h2>{coupon.couponName || coupon.coupon_name || "Reward"}</h2><span className="cm-chip">{coupon.validity || coupon.validityFormatted || "Active"}</span></div>
              <p className="cm-muted">{coupon.description || coupon.couponDesc || coupon.message || "Coupon details"}</p>
              {coupon.txnAmt || coupon.amount ? <strong>₹{coupon.txnAmt || coupon.amount}</strong> : null}
            </div>
          ))}
        </div>
      </div>
    </DataState>
  );
};

export default CouponsScreen;
