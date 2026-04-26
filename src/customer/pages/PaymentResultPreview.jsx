import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

const MOCK_TXN_ID = "1479T144B17347";
const MOCK_REF_ID = "AIRTEL9220775555X88";

const presets = {
  success: {
    path: "/customer/app/success",
    state: {
      type: "mobileRecharge",
      amount: 299,
      label: "Airtel Prepaid",
      txnId: MOCK_TXN_ID,
      paymentType: "wallet",
      offerType: "cashback",
      cashbackValue: 12.5,
      mobile: "9220775555",
      field1: "9220775555",
      operatorId: 1,
      operatorName: "Airtel Prepaid",
      logo: "",
      validity: "30",
      statusPayload: {
        status: "SUCCESS",
        cashback: 12.5,
        refId: MOCK_REF_ID,
        txnId: MOCK_TXN_ID,
      },
    },
  },
  "success-coupon": {
    path: "/customer/app/success",
    state: {
      type: "bill",
      amount: 1499,
      label: "Tata Power",
      txnId: MOCK_TXN_ID,
      paymentType: "upi",
      offerType: "coupon",
      couponCode: "MYNTRA200",
      couponName: "Flat ₹200 OFF on Myntra",
      couponDesc: "Use on Myntra app on orders above ₹999. Valid till 30 Apr.",
      mobile: "BILL98765",
      field1: "BILL98765",
      operatorId: 17,
      operatorName: "Tata Power",
      statusPayload: { status: "SUCCESS", refId: MOCK_REF_ID, txnId: MOCK_TXN_ID },
    },
  },
  "success-discount": {
    path: "/customer/app/success",
    state: {
      type: "bill",
      amount: 880,
      label: "BSNL Landline",
      txnId: MOCK_TXN_ID,
      paymentType: "upi",
      offerType: "discount",
      discountValue: 20,
      mobile: "022-2345-6789",
      field1: "022-2345-6789",
      operatorId: 31,
      operatorName: "BSNL Landline",
      statusPayload: { status: "SUCCESS", refId: MOCK_REF_ID, txnId: MOCK_TXN_ID },
    },
  },
  pending: {
    path: "/customer/app/failure",
    state: {
      status: "pending",
      message: "Recharge is in process.",
      txnId: MOCK_TXN_ID,
      orderId: MOCK_TXN_ID,
      amount: 10,
      type: "mobileRecharge",
      payType: "wallet",
      mobile: "9220775555",
      field1: "9220775555",
      operatorName: "Airtel Postpaid",
    },
  },
  "pending-bill": {
    path: "/customer/app/failure",
    state: {
      status: "pending",
      message: "Recharge is in process.",
      txnId: MOCK_TXN_ID,
      orderId: MOCK_TXN_ID,
      amount: 1499,
      type: "bill",
      payType: "upi",
      mobile: "BILL98765",
      field1: "BILL98765",
      operatorName: "Tata Power",
    },
  },
  failure: {
    path: "/customer/app/failure",
    state: {
      status: "failed",
      message: "UPI Transaction Failed",
      txnId: MOCK_TXN_ID,
      orderId: MOCK_TXN_ID,
      amount: 299,
      type: "mobileRecharge",
      payType: "upi",
      isPaid: true,
      mobile: "9220775555",
      operatorName: "Airtel Prepaid",
    },
  },
  "failure-wallet": {
    path: "/customer/app/failure",
    state: {
      status: "failed",
      message: "",
      txnId: MOCK_TXN_ID,
      amount: 299,
      type: "bill",
      payType: "wallet",
      mobile: "BILL98765",
      operatorName: "Tata Power",
    },
  },
};

const PaymentResultPreview = () => {
  const { kind } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    const preset = presets[kind];
    if (!preset) {
      navigate("/customer/app/services", { replace: true });
      return;
    }
    navigate(preset.path, { replace: true, state: preset.state });
  }, [kind, navigate]);

  return null;
};

export default PaymentResultPreview;
