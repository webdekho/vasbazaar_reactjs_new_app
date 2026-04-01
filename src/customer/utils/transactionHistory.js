const isPresent = (value) => {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  return true;
};

const firstPresent = (...values) => values.find(isPresent);

const toFiniteNumber = (value) => {
  if (!isPresent(value)) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const normalized = String(value).replace(/[^0-9.-]/g, "");
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTitleCase = (value) =>
  String(value || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDisplayDate = (value) => {
  if (!isPresent(value)) return "—";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const inferPaymentMode = (item = {}) => {
  const txnMode = Number(item.txnMode);
  const candidates = [
    item.paymentBy,
    item.paymentMode,
    item.payType,
    item.mode,
    item.paymentType,
    item.payment_method,
    item.paymentMethod,
    item.paymentGateway,
    item.gateway,
  ]
    .filter(isPresent)
    .map((value) => String(value).trim());

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();

    if (normalized.includes("upi")) return "UPI";
    if (normalized.includes("wallet")) return "Wallet";
    if (normalized.includes("credit")) return "Credit Card";
    if (normalized.includes("debit")) return "Debit Card";
    if (normalized.includes("netbank")) return "Net Banking";
    if (normalized.includes("bank")) return "Bank Transfer";
  }

  if (isPresent(item.upiFrom)) return "UPI";
  if (txnMode === 1 && String(item.serviceType || "").toLowerCase() !== "wallet") return "UPI";

  const fallback = candidates.find((candidate) => /[a-z]/i.test(candidate) && candidate.length <= 30);
  return fallback ? toTitleCase(fallback) : "—";
};

export const formatCurrency = (value) => {
  const amount = toFiniteNumber(value);
  if (amount === null) return "—";

  return `₹${amount.toLocaleString("en-IN", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

const inferOfferMethod = (item) => {
  const explicit = String(
    firstPresent(
      item.offerType,
      item.offer_method,
      item.offerMethod,
      item.couponId?.categoryId?.name,
      item.couponCategory,
      item.couponType
    ) || ""
  ).toLowerCase();

  if (explicit.includes("cashback")) return "cashback";
  if (explicit.includes("discount")) return "discount";
  if (explicit.includes("coupon") || explicit.includes("other")) return "coupon";

  if (isPresent(item.couponCode) || isPresent(item.couponId?.couponCode) || isPresent(item.couponId?.couponName)) {
    return "coupon";
  }

  return "none";
};

const computeOfferValue = (item, method, baseAmount, paidAmount) => {
  const directValue = toFiniteNumber(
    firstPresent(
      method === "discount" ? item.discountValue : item.cashbackValue,
      method === "discount" ? item.discountAmount : item.cashbackAmount,
      method === "discount" ? item.discount : item.cashback,
      method === "discount" ? item.offerDiscount : item.offerCashback
    )
  );

  if (directValue !== null) return directValue;

  const couponAmount = toFiniteNumber(
    firstPresent(
      item.couponId?.amount,
      item.offerAmount,
      item.couponAmount
    )
  );
  const couponCalcType = String(firstPresent(item.couponId?.type, item.offerValueType) || "").toLowerCase();
  const referenceAmount = baseAmount ?? paidAmount;

  if (couponAmount !== null) {
    if (couponCalcType.includes("percent")) {
      if (referenceAmount !== null) {
        return Number(((referenceAmount * couponAmount) / 100).toFixed(2));
      }
    } else {
      return couponAmount;
    }
  }

  if (method === "discount" && baseAmount !== null && paidAmount !== null && baseAmount > paidAmount) {
    return Number((baseAmount - paidAmount).toFixed(2));
  }

  return null;
};

export const normalizeTransaction = (item = {}) => {
  const service = toTitleCase(
    firstPresent(
      item.serviceName,
      item.operatorId?.serviceId?.serviceName,
      item.serviceType,
      item.service,
      item.description,
      item.discription
    ) || "—"
  );

  const operator = firstPresent(
    item.operatorId?.operatorName,
    item.operatorId?.name,
    item.operatorName,
    item.customerName
  ) || "—";

  const paymentMode = inferPaymentMode(item);

  const baseAmount = toFiniteNumber(firstPresent(item.amount, item.totalAmount, item.billAmount));
  const paidAmount = toFiniteNumber(firstPresent(item.txnAmt, item.amount, item.payableAmount));
  const offerMethod = inferOfferMethod(item);
  const offerValue = computeOfferValue(item, offerMethod, baseAmount, paidAmount);

  return {
    service,
    operator: String(operator),
    paymentMode,
    mobile: String(firstPresent(item.operatorNo, item.mobile, item.field1, item.customerMobile) || ""),
    amount: paidAmount,
    baseAmount,
    paidAmount: offerMethod === "discount"
      ? paidAmount ?? (baseAmount !== null && offerValue !== null ? Number((baseAmount - offerValue).toFixed(2)) : null)
      : paidAmount,
    discountAmount: offerMethod === "discount" ? offerValue : null,
    cashbackAmount: offerMethod === "cashback" ? offerValue : null,
    offerMethod,
    offerMethodLabel: offerMethod === "none" ? "None" : toTitleCase(offerMethod),
    couponName: firstPresent(item.couponId?.couponName, item.couponName, item.offerName) || "—",
    couponCode: firstPresent(item.couponCode, item.couponId?.couponCode) || "—",
    couponValidity: formatDisplayDate(firstPresent(item.couponValidity, item.couponId?.validity, item.validity)),
  };
};

const searchableAmountTokens = (value) => {
  const amount = toFiniteNumber(value);
  if (amount === null) return [];

  return [
    String(amount),
    amount.toFixed(2),
    String(Math.round(amount)),
    formatCurrency(amount).replace(/[₹,\s]/g, ""),
  ];
};

export const matchesTransactionSearch = (item, rawQuery) => {
  const query = String(rawQuery || "").trim().toLowerCase();
  if (!query) return true;

  const txn = normalizeTransaction(item);
  const fields = [
    item.txnId,
    item.operatorNo,
    item.mobile,
    item.customerName,
    item.description,
    item.discription,
    item.status,
    txn.service,
    txn.operator,
    txn.paymentMode,
    txn.offerMethodLabel,
    txn.couponName,
    txn.couponCode,
  ]
    .filter(isPresent)
    .map((value) => String(value).toLowerCase());

  const amountFields = [
    ...searchableAmountTokens(item.txnAmt),
    ...searchableAmountTokens(item.amount),
    ...searchableAmountTokens(txn.discountAmount),
    ...searchableAmountTokens(txn.cashbackAmount),
  ].map((value) => String(value).toLowerCase());

  return [...fields, ...amountFields].some((value) => value.includes(query));
};
