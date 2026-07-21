import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { FaTimesCircle, FaClock, FaWallet, FaSyncAlt, FaCopy, FaUniversity, FaPhoneAlt } from "react-icons/fa";
import { rechargeService } from "../services/rechargeService";
import { CARE_NUMBER_TEL, CARE_NUMBER_DISPLAY } from "../../utils/constants";
import { formatDisplayDateTime } from "../../utils/dateFormat";

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 60000;

const FailureScreen = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state || {};

  const [copied, setCopied] = useState("");
  const [autoRedirect, setAutoRedirect] = useState(true);

  const initialStatus = state.status === "pending" ? "pending" : "failed";
  const [currentStatus, setCurrentStatus] = useState(initialStatus);
  const [currentMessage, setCurrentMessage] = useState(state.message || "");
  const [currentIsPaid, setCurrentIsPaid] = useState(state.isPaid === true || state.is_paid === true);
  const [poll, setPoll] = useState({ active: false, attempt: 0, nextInSec: 0, error: "" });
  const pollTimerRef = useRef(null);
  const tickTimerRef = useRef(null);
  const inFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  const dateTime = useRef(formatDisplayDateTime(new Date())).current;

  const isPending = currentStatus === "pending";
  const isWalletPay = state.payType === "wallet";
  const isPaid = currentIsPaid;
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

  const eyebrow = isPending ? "Transaction Pending" : "Transaction Failed";
  const statusLabel = isPending ? "Pending" : "Failed";
  const statusModifier = isPending ? "sx2-page--pending" : "sx2-page--failure";

  const clearTimers = () => {
    if (pollTimerRef.current) { clearTimeout(pollTimerRef.current); pollTimerRef.current = null; }
    if (tickTimerRef.current) { clearInterval(tickTimerRef.current); tickTimerRef.current = null; }
  };

  // Start countdown, then AUTOMATICALLY run the next status check when it ends.
  const startCountdown = (attempt, delayMs) => {
    const startedAt = Date.now();
    setPoll({ active: true, attempt, nextInSec: Math.ceil(delayMs / 1000), error: "" });
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    tickTimerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((delayMs - (Date.now() - startedAt)) / 1000));
      setPoll((p) => ({ ...p, nextInSec: remaining }));
      if (remaining === 0 && tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
        // Countdown complete - auto-trigger the next status check
        if (isMountedRef.current) {
          performStatusCheck(Math.min(attempt + 1, MAX_POLL_ATTEMPTS));
        }
      }
    }, 1000);
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
        // Update isPaid from API response
        const apiIsPaid = resp?.data?.is_paid === true || resp?.data?.isPaid === true;
        if (apiIsPaid) {
          setCurrentIsPaid(true);
        }
        setPoll({ active: false, attempt, nextInSec: 0, error: "" });
        return;
      }

      if (attempt >= MAX_POLL_ATTEMPTS) {
        setPoll({ active: false, attempt, nextInSec: 0, error: "" });
        return;
      }
      // Start countdown - user must click "Check Now" when countdown ends
      startCountdown(attempt, POLL_INTERVAL_MS);
    } catch (e) {
      if (!isMountedRef.current) return;
      if (attempt >= MAX_POLL_ATTEMPTS) {
        setPoll({ active: false, attempt, nextInSec: 0, error: "Could not reach server." });
        return;
      }
      // Start countdown - user must click "Check Now" when countdown ends
      startCountdown(attempt, POLL_INTERVAL_MS);
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    if (initialStatus === "pending" && txnId) {
      // One automatic check on page load, then user must click "Check Now"
      performStatusCheck(0);
    }
    return () => {
      isMountedRef.current = false;
      clearTimers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // For a terminal failed result (refund already handled), auto-redirect to home after 10s.
  // Pending stays put so the user can watch the status polling.
  // If the user interacts with the page, the auto-redirect is cancelled.
  useEffect(() => {
    if (currentStatus !== "failed" || !autoRedirect) return undefined;
    const t = setTimeout(() => navigate("/customer/app/services", { replace: true }), 10000);
    return () => clearTimeout(t);
  }, [currentStatus, autoRedirect, navigate]);

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
    <div
      className={`sx2-page ${statusModifier}`}
      onClick={() => autoRedirect && setAutoRedirect(false)}
    >
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
                : poll.active && poll.nextInSec > 0
                  ? `Re-checking in ${poll.nextInSec}s · Attempt ${Math.min(poll.attempt + 1, MAX_POLL_ATTEMPTS)}/${MAX_POLL_ATTEMPTS}`
                  : poll.attempt >= MAX_POLL_ATTEMPTS
                    ? `Status not confirmed after ${MAX_POLL_ATTEMPTS} checks. Check transaction history later.`
                    : "Verifying payment status…"}
            </div>
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
        <section className="sx2-notice sx2-notice--info">
          <FaUniversity />
          <span>The amount will be refunded to your original payment source within 3 working days.</span>
        </section>
      )}

      {/* Customer care — an <a href="tel:"> rather than window.open("tel:"), which is
          unreliable inside iOS WKWebView. Tapping hands off to the device dialler. */}
      <a
        className="sx2-care"
        href={`tel:${CARE_NUMBER_TEL}`}
        onClick={() => setAutoRedirect(false)}
      >
        <span className="sx2-care-ic" aria-hidden><FaPhoneAlt /></span>
        <span className="sx2-care-text">
          <span className="sx2-care-label">Need help? Call customer care</span>
          <span className="sx2-care-num">{CARE_NUMBER_DISPLAY}</span>
        </span>
      </a>

      {!isPending && (
        <>
          <button
            type="button"
            className="sx2-home-btn"
            onClick={() => navigate("/customer/app/services", { replace: true })}
          >
            Go to Home
          </button>
          {autoRedirect && (
            <p className="sx2-redirect-hint">Redirecting to home in 10s…</p>
          )}
        </>
      )}

      {copied && <div className="sx2-toast">Copied!</div>}
    </div>
  );
};

export default FailureScreen;
