/* Shared block-amount guard used by the prepaid (ServiceFlowScreen) and
   bill-pay / DTH (BillerFlowScreen) flows.

   Admin configures specific amounts that are not allowed for an operator via
   the operator's `rejectAmount` field — stored as a JSON array string
   ("[10,20]") with a comma-separated fallback ("10,20"). Empty/invalid
   config blocks nothing. */
export const isBlockedAmount = (raw, amount) => {
  if (raw == null || raw === "") return false;
  let nums = [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) nums = parsed.map(Number);
  } catch {
    nums = String(raw).split(",").map((s) => Number(s.trim()));
  }
  return nums.some((n) => Number.isFinite(n) && n === Number(amount));
};
