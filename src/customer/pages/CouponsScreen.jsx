import { useEffect, useState } from "react";
import { FaGift, FaTag } from "react-icons/fa";
import { couponService } from "../services/couponService";
import DataState from "../components/DataState";

const CouponsScreen = () => {
  const [coupons, setCoupons] = useState({ loading: true, error: "", records: [] });

  useEffect(() => {
    const load = async () => {
      const response = await couponService.getCoupons(0, 20);
      setCoupons({
        loading: false,
        error: response.success ? "" : response.message,
        records: response.data?.records || response.data?.allCoupons || [],
      });
    };
    load();
  }, []);

  return (
    <DataState loading={coupons.loading} error={coupons.error} empty={coupons.records.length === 0 ? "No coupons available yet." : null}>
      <div className="cm-page-animate">
        <div className="cm-section-header">
          <h2><FaGift style={{ marginRight: 8 }} />My Coupons</h2>
          <span className="cm-badge">{coupons.records.length}</span>
        </div>

        <div className="cm-coupon-grid">
          {coupons.records.map((coupon, index) => (
            <div className="cm-coupon-card" key={coupon.txnId || coupon.id || index} style={{ animationDelay: `${index * 50}ms` }}>
              <div className="cm-coupon-icon"><FaTag /></div>
              <div className="cm-coupon-content">
                <div className="cm-coupon-name">{coupon.couponName || coupon.coupon_name || "Reward"}</div>
                <div className="cm-coupon-desc">{coupon.description || coupon.couponDesc || coupon.message || "Coupon details"}</div>
                {coupon.validity || coupon.validityFormatted ? (
                  <span className="cm-coupon-validity">{coupon.validity || coupon.validityFormatted}</span>
                ) : null}
              </div>
              {(coupon.txnAmt || coupon.amount) && (
                <div className="cm-coupon-amount">₹{coupon.txnAmt || coupon.amount}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </DataState>
  );
};

export default CouponsScreen;
