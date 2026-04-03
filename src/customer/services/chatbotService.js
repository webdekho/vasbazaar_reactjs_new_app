import { userService } from "./userService";
import { walletService } from "./walletService";
import { rechargeService } from "./rechargeService";
import { offerService } from "./offerService";

const AI_PROXY_URL = window.location.hostname === "localhost"
  ? "http://localhost:3847/api/chatbot/ai"
  : `/chatbot-api/ai`;

// ── AI Call ──
const callAI = async (conversationMessages) => {
  try {
    const res = await fetch(AI_PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversationMessages }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn("AI unavailable, using fallback:", err.message);
    return null;
  }
};

// ── Keyword Fallback Classifier ──
const classifyLocal = (text) => {
  const t = text.toLowerCase().trim();
  const mobile = t.match(/\b(\d{10})\b/)?.[1] || null;
  const amount = t.match(/(?:rs\.?|₹|rupee)?\s*(\d+)/)?.[1] || null;

  if (/balance|wallet\s*balance|how\s*much|kitna/.test(t)) return { intent: "CHECK_BALANCE", params: {} };
  if (/transaction|txn|status.*(?:vb|txn)/i.test(t)) { const txn = t.match(/(vb\d+)/i)?.[1]; return { intent: "CHECK_TRANSACTION", params: { txnId: txn } }; }
  if (/recent.*trans|last.*trans|history/.test(t)) return { intent: "SEARCH_TRANSACTIONS", params: {} };
  if (/recharge|prepaid|mobile.*recharge|top\s*up/.test(t)) return { intent: "INITIATE_RECHARGE", params: { mobile, amount } };
  if (/bill|postpaid|electric|gas|water|dth|broadband|landline/.test(t)) return { intent: "INITIATE_BILL_PAYMENT", params: { mobile } };
  if (/plan|browse.*plan/.test(t)) return { intent: "VIEW_PLANS", params: { mobile } };
  if (/offer|coupon|discount|cashback|deal/.test(t)) return { intent: "CHECK_OFFERS", params: {} };
  if (/complaint|issue|problem|grievance|file/.test(t)) return { intent: "FILE_COMPLAINT", params: {} };
  if (/my.*complaint|complaint.*status|track.*complaint/.test(t)) return { intent: "CHECK_COMPLAINTS", params: {} };
  if (/due|upcoming|pending|scheduled/.test(t)) return { intent: "CHECK_DUES", params: {} };
  if (/referral|refer|invite/.test(t)) return { intent: "CHECK_REFERRALS", params: {} };
  if (/notification/.test(t)) return { intent: "CHECK_NOTIFICATIONS", params: {} };
  if (/agent|human|support|talk|call|help/.test(t)) return { intent: "TALK_TO_AGENT", params: {} };
  if (/^(hi|hello|hey|hii|namaste|hola)/i.test(t)) return { intent: "GREETING", params: {} };
  if (/thank|thanks|dhanyavaad/i.test(t)) return { intent: "THANK_YOU", params: {} };
  if (/wallet|profile|home|services|history|offers|complaints|travel|autopay/.test(t)) {
    const pages = { wallet: "wallet", profile: "profile", home: "services", services: "services", history: "history", offers: "coupons", complaints: "complaints", travel: "travel", autopay: "autopay" };
    const page = Object.keys(pages).find((k) => t.includes(k));
    return { intent: "NAVIGATE", params: { page: pages[page] || "services" } };
  }
  return { intent: "UNKNOWN", params: { mobile, amount } };
};

// ── Action Executors ──
export const executeIntent = async (intent, params) => {
  switch (intent) {
    case "CHECK_BALANCE": {
      const res = await userService.getUserProfile();
      if (!res.success) return { reply: "Couldn't fetch your balance. Please try again.", cardType: null, cardData: null };
      const d = res.data;
      return {
        reply: `Your wallet balance is ₹${Number(d.balance || 0).toFixed(2)}`,
        cardType: "balance",
        cardData: {
          balance: Number(d.balance || 0).toFixed(2),
          cashback: Number(d.cashback || 0).toFixed(2),
          incentive: Number(d.incentive || 0).toFixed(2),
          referralBonus: Number(d.referralBonus || 0).toFixed(2),
        },
        actions: ["Recharge", "Add Money", "View Offers"],
      };
    }

    case "SEARCH_TRANSACTIONS": {
      const res = await walletService.getTransactionHistory(0, 5);
      if (!res.success || !res.data?.records?.length) return { reply: "No recent transactions found.", cardType: null, actions: ["Recharge", "Check Balance"] };
      const txns = res.data.records.slice(0, 5);
      return {
        reply: `Here are your last ${txns.length} transactions:`,
        cardType: "transactions",
        cardData: txns.map((t) => ({
          id: t.txnId || t.id,
          amount: t.amount || t.debitAmount,
          status: t.status || "COMPLETED",
          date: t.createdDate || t.date,
          operator: t.operatorId?.operatorName || t.serviceType || "Transaction",
          type: t.txnType || "debit",
        })),
        actions: ["Search by ID", "Check Balance"],
      };
    }

    case "CHECK_TRANSACTION": {
      if (!params.txnId) return { reply: "Please provide a transaction ID (e.g., VB1234567890).", cardType: null, actions: ["Search Transactions"] };
      const res = await walletService.getTransactionById(params.txnId);
      if (!res.success) return { reply: `Couldn't find transaction ${params.txnId}. Please check the ID.`, cardType: null };
      const t = res.data;
      return {
        reply: `Transaction ${params.txnId} details:`,
        cardType: "transaction_detail",
        cardData: {
          id: t.txnId || params.txnId,
          amount: t.amount || t.debitAmount,
          status: t.status || "UNKNOWN",
          date: t.createdDate || t.date,
          operator: t.operatorId?.operatorName || "—",
          mobile: t.field1 || t.mobile || "—",
          paymentMethod: t.payType || "—",
        },
        actions: ["File Complaint", "Check Balance"],
      };
    }

    case "CHECK_OFFERS": {
      const res = await offerService.getOffers(1);
      if (!res.success) return { reply: "Couldn't fetch offers right now.", cardType: null };
      const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
      if (data.length === 0) return { reply: "No offers available right now. Check back later!", cardType: null, actions: ["Recharge", "Check Balance"] };
      return {
        reply: `Found ${data.length} offer${data.length > 1 ? "s" : ""} for you:`,
        cardType: "offers",
        cardData: data.slice(0, 5).map((o) => ({
          id: o.id,
          name: o.couponName || o.name,
          code: o.couponCode,
          type: o.type,
          amount: o.amount,
          category: o.categoryId?.name || "Offer",
        })),
        actions: ["Recharge", "Check Balance"],
      };
    }

    case "CHECK_DUES": {
      const res = await walletService.getUpcomingDues();
      if (!res.success) return { reply: "Couldn't fetch upcoming dues.", cardType: null };
      const dues = Array.isArray(res.data) ? res.data : res.data?.records || [];
      if (dues.length === 0) return { reply: "No upcoming dues! You're all caught up.", cardType: null, actions: ["Recharge", "Check Balance"] };
      return {
        reply: `You have ${dues.length} upcoming due${dues.length > 1 ? "s" : ""}:`,
        cardType: "dues",
        cardData: dues.slice(0, 5),
        actions: ["Pay Now", "Check Balance"],
      };
    }

    case "CHECK_COMPLAINTS": {
      return { reply: "Let me redirect you to your complaints.", cardType: null, navigate: "/customer/app/complaints", actions: ["File Complaint", "Check Balance"] };
    }

    case "CHECK_REFERRALS": {
      const res = await userService.getUserProfile();
      if (!res.success) return { reply: "Couldn't fetch referral info.", cardType: null };
      return {
        reply: `Your referral stats:\n• Referral Bonus: ₹${Number(res.data?.referralBonus || 0).toFixed(2)}\n• Share your code to earn cashback on every friend's transaction!`,
        cardType: null,
        actions: ["Share Referral", "Check Balance"],
      };
    }

    case "INITIATE_RECHARGE": {
      if (!params.mobile) return { reply: "Please provide the 10-digit mobile number you want to recharge.", cardType: null, actions: ["Check Balance", "View Offers"] };
      if (!/^\d{10}$/.test(params.mobile)) return { reply: "That doesn't look like a valid 10-digit mobile number. Please try again.", cardType: null };
      // Detect operator
      const opRes = await rechargeService.fetchOperatorCircle(params.mobile);
      if (!opRes.success) return { reply: `Couldn't detect the operator for ${params.mobile}. Please try from the Services page.`, cardType: null, navigate: "/customer/app/services/prepaid" };
      const opData = opRes.data;
      const opName = opData.operatorName || opData.operator || "Unknown";
      const circle = opData.circleName || opData.circle || "";
      if (params.amount) {
        return {
          reply: `Recharge ₹${params.amount} for ${opName} — ${params.mobile} (${circle})?`,
          cardType: "confirmation",
          cardData: { action: "recharge", mobile: params.mobile, amount: Number(params.amount), operator: opName, circle, operatorData: opData },
          actions: ["Confirm", "Change Amount", "Cancel"],
        };
      }
      return {
        reply: `Detected ${opName} (${circle}) for ${params.mobile}. How much would you like to recharge? Or I can show you the available plans.`,
        cardType: null,
        actions: ["View Plans", "₹199", "₹299", "₹399", "₹599"],
        flowData: { mobile: params.mobile, operator: opName, circle, operatorData: opData },
      };
    }

    case "NAVIGATE": {
      const routes = {
        wallet: "/customer/app/wallet", profile: "/customer/app/profile", services: "/customer/app/services",
        history: "/customer/app/history", coupons: "/customer/app/coupons", complaints: "/customer/app/complaints",
        travel: "/customer/app/travel", autopay: "/customer/app/autopay", help: "/customer/app/help",
      };
      return { reply: `Taking you to ${params.page || "services"}...`, navigate: routes[params.page] || "/customer/app/services", cardType: null };
    }

    case "TALK_TO_AGENT": {
      return {
        reply: "I'll connect you with a human agent. You can also reach us at:\n📞 +91 8655681213\n📧 support@vasbazaar.com",
        cardType: "escalate",
        actions: ["Open Live Chat", "Call Support", "WhatsApp"],
      };
    }

    case "FILE_COMPLAINT": {
      return { reply: "I'll take you to the complaint form where you can file a BBPS grievance.", navigate: "/customer/app/file-complaint", cardType: null, actions: ["Check Complaints", "Check Balance"] };
    }

    case "GREETING": {
      return { reply: "Hello! How can I help you today?", cardType: null, actions: ["Check Balance", "Recharge", "View Offers", "Track Transaction", "File Complaint", "Talk to Agent"] };
    }

    case "THANK_YOU": {
      return { reply: "You're welcome! Is there anything else I can help you with?", cardType: null, actions: ["Check Balance", "Recharge", "View Offers"] };
    }

    default:
      return { reply: "I'm not sure I understand. Could you rephrase? Or try one of these:", cardType: null, actions: ["Check Balance", "Recharge", "View Offers", "Track Transaction", "File Complaint", "Talk to Agent"] };
  }
};

// ── Main Process Message ──
export const processMessage = async (text, conversationHistory) => {
  // Build messages for AI
  const aiMessages = conversationHistory.slice(-16).map((m) => ({
    role: m.role === "bot" ? "assistant" : "user",
    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
  }));
  aiMessages.push({ role: "user", content: text });

  // Try AI first
  let aiResult = await callAI(aiMessages);

  // Fall back to local classifier if AI fails
  if (!aiResult || aiResult.fallback || aiResult.error) {
    const local = classifyLocal(text);
    const result = await executeIntent(local.intent, local.params);
    return { ...result, intent: local.intent, params: local.params };
  }

  // AI returned structured response — execute the intent
  const intent = (aiResult.intent || "UNKNOWN").toUpperCase();
  const params = aiResult.params || {};

  // For informational intents, execute locally to get real data
  const dataIntents = ["CHECK_BALANCE", "SEARCH_TRANSACTIONS", "CHECK_TRANSACTION", "CHECK_OFFERS", "CHECK_DUES", "CHECK_REFERRALS", "CHECK_COMPLAINTS", "CHECK_NOTIFICATIONS", "INITIATE_RECHARGE", "INITIATE_BILL_PAYMENT", "FILE_COMPLAINT", "NAVIGATE", "TALK_TO_AGENT"];

  if (dataIntents.includes(intent)) {
    const result = await executeIntent(intent, params);
    // Use AI's reply text but our card data
    return { ...result, reply: aiResult.reply || result.reply, intent, params, actions: result.actions || aiResult.actions || [] };
  }

  // For FAQ, greetings, etc. — use AI's response directly
  return {
    reply: aiResult.reply || "How can I help you?",
    intent,
    params,
    actions: aiResult.actions || ["Check Balance", "Recharge", "View Offers"],
    cardType: aiResult.cardType || null,
    cardData: null,
  };
};
