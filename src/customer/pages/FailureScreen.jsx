import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaTimesCircle, FaClock, FaHome, FaRedo, FaWallet, FaSyncAlt, FaCopy, FaUniversity } from "react-icons/fa";
import { FiArrowRight } from "react-icons/fi";
import { authPost } from "../services/apiClient";
import { rechargeService } from "../services/rechargeService";

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 60000;

const formatDateTime = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy}, ${hh}:${mi}:${ss}`;
};

const FailureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [refundLoading, setRefundLoading] = useState(null);
  const [refundMessage, setRefundMessage] = useState("");
  const [refundMessageType, setRefundMessageType] = useState("");
  const [copied, setCopied] = useState("");

  const initialStatus = state.status === "pending" ? "pending" : "failed";
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [currentMessage, setCurrentMessage] = useState(state.message || "");
  const [poll, setPoll] = useState({ active: false, attempt: 0, nextInSec: 0, error: "" });
  const pollTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const dateTime = useRef(formatDateTime()).current;

  const isPending = currentStatus === "pending";
  const isWalletPay = state.payType === "wallet";
  const isPaid = state.isPaid === true || state.is_paid === true;
  const isBill = state.type === "bill";
  const productLabel = isBill ? "Bill payment" : "Recharge";
  const txnId = state.txnId || state.orderId || "";
  const refId = state.refId || state.statusPayload?.refId || txnId;
  const amountNum = Number(state.amount || state.txnAmt || 0);
  const mobile = state.mobile || state.field1 || state.number || "";
  const operator = state.operatorName || state.operator || state.label || "";
  const paymentType = (state.payType || state.paymentType || "").toString().toUpperCase();

  const rawMessage = currentMessage || "";
  const isTechnical = /login failed|ip \d|automatic refund|internal server|exception|stacktrace|null pointer/i.test(rawMessage);
  const normalizedRaw = rawMessage && !isTechnical
    ? rawMessage.replace(/\brecharge\b/gi, (m) => (isBill ? (m === m.toUpperCase() ? "BILL PAYMENT" : m[0] === m[0].toUpperCase() ? "Bill payment" : "bill payment") : m))
    : "";
  const message = normalizedRaw || (
    isPending
      ? `${productLabel} is in process.`
      : isWalletPay
        ? `${productLabel} failed. Amount auto-refunded to your wallet.`
        : isPaid
          ? `${productLabel} could not be completed. Choose a refund option below.`
          : `${productLabel} failed.`
  );

  const eyebrow = isPending ? "Payment Pending" : "Payment Failed";
  const statusLabel = isPending ? "Pending" : "Failed";
  const statusModifier = isPending ? "sx2-page--pending" : "sx2-page--failure";

  const handleRefundRequest = async (refundType) => {
    if (!txnId) {
      setRefundMessageType("error");
      setRefundMessage("Transaction ID not found. Please contact support.");
      return;
    }
    setRefundLoading(refundType);
    setRefundMessage("");
    setRefundMessageType("");
    try {
      const response = await authPost("/api/customer/plan_recharge/request-refund", { txnId, refundType });
      if (response.success) {
        setRefundMessageType("success");
        setRefundMessage(
          refundType === "wallet"
            ? "Wallet refund request submitted successfully."
            : "Bank refund request submitted. May take up to 3 working days."
        );
      } else {
        setRefundMessageType("error");
        setRefundMessage(response.message || "Unable to submit refund request.");
      }
    } catch {
      setRefundMessageType("error");
      setRefundMessage("Unable to submit refund request.");
    } finally {
      setRefundLoading(null);
    }
  };

  const clearTimers = () => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
  };

  const scheduleNextCheck = (attempt, delayMs) => {
    const startedAt = Date.now();
    setPoll({ active: true, attempt, nextInSec: Math.ceil(delayMs / 1000), error: "" });
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((delayMs - (Date.now() - startedAt)) / 1000));
      setPoll((p) => ({ ...p, nextInSec: remaining }));
      if (remaining === 0 && tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    }, 1000);
    pollTimerRef.current = setTimeout(() => performStatusCheck(attempt + 1), delayMs);
  };

  const performStatusCheck = async (attempt) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
    setPoll({ active: true, attempt, nextInSec: 0, error: "" });

    const field1 = state.field1 || state.mobile || state.number || "";
    const payload = {
      txnId,
      field1,
      field2: state.field2 || null,
      validity: state.validity || null,
      recharge: !isBill,
      viewBillResponse: state.viewBillResponse || {},
    };

    try {
      const resp = await rechargeService.checkRechargeStatus(payload);
      if (!isMountedRef.current) return;
      const apiStatus = String(resp?.data?.status || resp?.raw?.Status || resp?.data?.Status || "").toUpperCase();

      if (apiStatus === "SUCCESS" || apiStatus === "COMPLETED" || apiStatus === "CHARGED") {
        clearTimers();
        navigate("/customer/app/success", {
          replace: true,
          state: {
            type: state.type,
            amount: state.amount,
            label: state.operatorName || state.label,
            txnId,
            statusPayload: resp.data || {},
            paymentType: state.payType || "web",
            mobile: state.mobile || field1,
            field1,
            operatorName: state.operatorName || state.label || "",
            logo: state.logo || "",
          },
        });
        return;
      }

      if (apiStatus === "FAILED" || apiStatus === "FAILURE" || apiStatus === "REFUNDED" || apiStatus === "CANCELLED") {
        clearTimers();
        setCurrentStatus("failed");
        setCurrentMessage(resp?.data?.message || `${productLabel} could not be completed.`);
        setPoll({ active: false, attempt, nextInSec: 0, error: "" });
        return;
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setPoll({ active: false, attempt, nextInSec: 0, error: "" });
        return;
      }
      scheduleNextCheck(attempt, POLL_INTERVAL_MS);
    } catch (e) {
      if (!isMountedRef.current) return;
      if (attempt >= MAX_POLL_ATTEMPTS) {
        setPoll({ active: false, attempt, nextInSec: 0, error: "Could not reach server." });
        return;
      }
      scheduleNextCheck(attempt, POLL_INTERVAL_MS);
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (initialStatus === "pending" && txnId) {
      scheduleNextCheck(0, POLL_INTERVAL_MS);
    }
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCheckNow = () => {
    if (!txnId) return;
    clearTimers();
    performStatusCheck(Math.min(poll.attempt + 1, MAX_POLL_ATTEMPTS));
  };

  const copyToClipboard = (text, label) => {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(""), 1500);
    });
  };

  const showRefundSection = !isPending && !isWalletPay && isPaid;
  const showWalletRefundNotice = !isPending && isWalletPay;

  return (
    <div className={`sx2-page ${statusModifier}`}>
      <div className="sx2-mesh" aria-hidden>
        <div className="sx2-mesh-blob sx2-mesh-blob--a" />
        <div className="sx2-mesh-blob sx2-mesh-blob--b" />
        <div className="sx2-mesh-blob sx2-mesh-blob--c" />
        <div className="sx2-grain" />
      </div>

      <header className="sx2-hero">
        <div className="sx2-badge">
          <span className="sx2-badge-glow" aria-hidden />
          <div className="sx2-status-icon" aria-hidden>
            {isPending ? <FaClock /> : <FaTimesCircle />}
          </div>
        </div>
        <p className="sx2-eyebrow">{eyebrow}</p>
        {amountNum > 0 && <h1 className="sx2-amount">₹{amountNum.toFixed(2)}</h1>}
        {(operator || mobile) && (
          <p className="sx2-paid-to">
            {isBill ? "Bill for " : "Recharge for "}
            <strong>{operator || "Service"}</strong>
            {mobile ? <> · {mobile}</> : null}
          </p>
        )}
      </header>

      <p className="sx2-subtext">{message}</p>

      <section className="sx2-ticket">
        <div className="sx2-ticket-top">
          <div className="sx2-ticket-status">
            <span className="sx2-ticket-dot" aria-hidden /> {statusLabel}
          </div>
          <div className="sx2-ticket-time">{dateTime}</div>
        </div>
        <div className="sx2-perforation" aria-hidden />
        <dl className="sx2-rows">
          {txnId && (
            <div className="sx2-row">
              <dt>Transaction ID</dt>
              <dd>
                <span className="sx2-mono">{txnId}</span>
                <button type="button" className="sx2-chip-btn" aria-label="Copy transaction id" onClick={() => copyToClipboard(txnId, "txn")}>
                  <FaCopy />
                </button>
              </dd>
            </div>
          )}
          {refId && refId !== txnId && (
            <div className="sx2-row">
              <dt>Reference ID</dt>
              <dd>
                <span className="sx2-mono">{refId}</span>
                <button type="button" className="sx2-chip-btn" aria-label="Copy reference id" onClick={() => copyToClipboard(refId, "ref")}>
                  <FaCopy />
                </button>
              </dd>
            </div>
          )}
          {paymentType && (
            <div className="sx2-row">
              <dt>Payment Method</dt>
              <dd>{paymentType}</dd>
            </div>
          )}
          {mobile && (
            <div className="sx2-row">
              <dt>{isBill ? "Account / Bill No" : "Mobile Number"}</dt>
              <dd>{mobile}</dd>
            </div>
          )}
        </dl>
      </section>

      {isPending && txnId && (
        <section className="sx2-poll">
          <div className="sx2-poll-row">
            <div className="sx2-poll-ic">
              <FaSyncAlt className={poll.active && poll.nextInSec === 0 ? "sx-spin" : ""} />
            </div>
            <div className="sx2-poll-text">
              {poll.active && poll.nextInSec === 0
                ? `Checking status… (${Math.min(poll.attempt, MAX_POLL_ATTEMPTS)}/${MAX_POLL_ATTEMPTS})`
                : poll.active
                  ? `Auto check in ${poll.nextInSec}s · Attempt ${Math.min(poll.attempt + 1, MAX_POLL_ATTEMPTS)}/${MAX_POLL_ATTEMPTS}`
                  : poll.attempt >= MAX_POLL_ATTEMPTS
                    ? `Status not confirmed after ${MAX_POLL_ATTEMPTS} checks.`
                    : "Tap Check Now to verify status."}
            </div>
            <button
              type="button"
              className="sx2-poll-btn"
              onClick={handleCheckNow}
              disabled={poll.active}
            >
              Check Now
            </button>
          </div>
          {poll.error && <div className="sx2-poll-error">{poll.error}</div>}
        </section>
      )}

      {showWalletRefundNotice && (
        <section className="sx2-notice sx2-notice--success">
          <FaWallet />
          <span>₹{amountNum.toFixed(2)} refunded to your wallet</span>
        </section>
      )}

      {showRefundSection && (
        <section className="sx2-refund">
          <div className="sx2-refund-head">
            <div className="sx2-refund-title">Request Refund</div>
            <div className="sx2-refund-desc">If payment was deducted, choose your refund option.</div>
          </div>
          <div className="sx2-refund-btns">
            <button
              type="button"
              className="sx2-refund-btn sx2-refund-btn--wallet"
              onClick={() => handleRefundRequest("wallet")}
              disabled={refundLoading !== null}
            >
              <FaWallet />
              <span>{refundLoading === "wallet" ? "Processing…" : "Wallet (Instant)"}</span>
            </button>
            <button
              type="button"
              className="sx2-refund-btn sx2-refund-btn--bank"
              onClick={() => handleRefundRequest("bank")}
              disabled={refundLoading !== null}
            >
              <FaUniversity />
              <span>{refundLoading === "bank" ? "Processing…" : "Bank (1–3 days)"}</span>
            </button>
          </div>
          {refundMessage && (
            <p className={`sx2-refund-status ${refundMessageType === "success" ? "is-success" : "is-error"}`}>
              {refundMessage}
            </p>
          )}
        </section>
      )}

      <div className="sx2-actionbar">
        <button type="button" className="sx2-act sx2-act--ghost" onClick={() => navigate("/customer/app/services", { replace: true })}>
          <FaHome /> Home
        </button>
        {isPending ? (
          <button type="button" className="sx2-act sx2-act--primary" onClick={handleCheckNow} disabled={poll.active}>
            <FaSyncAlt className={poll.active ? "sx-spin" : ""} /> Refresh
          </button>
        ) : (
          <button type="button" className="sx2-act sx2-act--primary" onClick={() => navigate(-2)}>
            <FaRedo /> Retry <FiArrowRight />
          </button>
        )}
      </div>

      {copied && <div className="sx2-toast">Copied!</div>}
    </div>
  );
};

export default FailureScreen;
