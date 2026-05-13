// ReBuddy local-only storage + debt simplification helpers.
const KEY = "rebuddy_groups_v1";

const safeParse = (raw, fallback) => {
  try { return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
};

export const loadGroups = () => safeParse(localStorage.getItem(KEY), {});

export const saveGroups = (groups) => {
  localStorage.setItem(KEY, JSON.stringify(groups));
};

export const getGroup = (id) => loadGroups()[id] || null;

export const upsertGroup = (group) => {
  const all = loadGroups();
  all[group.id] = { ...group, updatedAt: Date.now() };
  saveGroups(all);
  return all[group.id];
};

export const deleteGroup = (id) => {
  const all = loadGroups();
  delete all[id];
  saveGroups(all);
};

export const newId = (prefix = "g") =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export const formatMoney = (amount, currency = "INR") => {
  const n = Number(amount) || 0;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency", currency, maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

// Per-member net balance: positive = owed money, negative = owes money.
export const computeBalances = (group) => {
  const balances = {};
  if (!group?.members?.length) return balances;
  group.members.forEach((m) => { balances[m.id] = 0; });
  (group.expenses || []).forEach((exp) => {
    const splitAmong = (exp.splitAmong && exp.splitAmong.length) ? exp.splitAmong : group.members.map((m) => m.id);
    const share = exp.amount / splitAmong.length;
    if (balances[exp.paidBy] != null) balances[exp.paidBy] += exp.amount;
    splitAmong.forEach((id) => {
      if (balances[id] != null) balances[id] -= share;
    });
  });
  Object.keys(balances).forEach((k) => {
    balances[k] = Math.round(balances[k] * 100) / 100;
  });
  return balances;
};

// Greedy debt simplification: returns minimal list of {from, to, amount}.
export const simplifySettlements = (group) => {
  if (!group?.members?.length) return [];
  const balances = computeBalances(group);

  const debtors = [];
  const creditors = [];
  Object.entries(balances).forEach(([id, bal]) => {
    if (bal < -0.009) debtors.push({ id, amount: -bal });
    else if (bal > 0.009) creditors.push({ id, amount: bal });
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const result = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    result.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount < 0.01) i += 1;
    if (creditors[j].amount < 0.01) j += 1;
  }
  return result;
};

export const memberMap = (group) => {
  const map = {};
  (group?.members || []).forEach((m) => { map[m.id] = m; });
  return map;
};

export const CURRENCIES = [
  { code: "INR", flag: "🇮🇳", label: "Indian Rupee" },
  { code: "USD", flag: "🇺🇸", label: "US Dollar" },
  { code: "EUR", flag: "🇪🇺", label: "Euro" },
  { code: "GBP", flag: "🇬🇧", label: "British Pound" },
  { code: "JPY", flag: "🇯🇵", label: "Japanese Yen" },
  { code: "AUD", flag: "🇦🇺", label: "Australian Dollar" },
  { code: "CAD", flag: "🇨🇦", label: "Canadian Dollar" },
  { code: "SGD", flag: "🇸🇬", label: "Singapore Dollar" },
  { code: "AED", flag: "🇦🇪", label: "UAE Dirham" },
  { code: "CHF", flag: "🇨🇭", label: "Swiss Franc" },
  { code: "CNY", flag: "🇨🇳", label: "Chinese Yuan" },
  { code: "THB", flag: "🇹🇭", label: "Thai Baht" },
  { code: "MYR", flag: "🇲🇾", label: "Malaysian Ringgit" },
  { code: "IDR", flag: "🇮🇩", label: "Indonesian Rupiah" },
  { code: "KRW", flag: "🇰🇷", label: "Korean Won" },
  { code: "HKD", flag: "🇭🇰", label: "Hong Kong Dollar" },
  { code: "NZD", flag: "🇳🇿", label: "New Zealand Dollar" },
  { code: "ZAR", flag: "🇿🇦", label: "South African Rand" },
  { code: "BRL", flag: "🇧🇷", label: "Brazilian Real" },
  { code: "RUB", flag: "🇷🇺", label: "Russian Ruble" },
  { code: "TRY", flag: "🇹🇷", label: "Turkish Lira" },
  { code: "SEK", flag: "🇸🇪", label: "Swedish Krona" },
  { code: "NOK", flag: "🇳🇴", label: "Norwegian Krone" },
  { code: "DKK", flag: "🇩🇰", label: "Danish Krone" },
  { code: "PLN", flag: "🇵🇱", label: "Polish Zloty" },
  { code: "MXN", flag: "🇲🇽", label: "Mexican Peso" },
  { code: "PHP", flag: "🇵🇭", label: "Philippine Peso" },
  { code: "VND", flag: "🇻🇳", label: "Vietnamese Dong" },
  { code: "LKR", flag: "🇱🇰", label: "Sri Lankan Rupee" },
  { code: "BDT", flag: "🇧🇩", label: "Bangladeshi Taka" },
  { code: "NPR", flag: "🇳🇵", label: "Nepalese Rupee" },
  { code: "PKR", flag: "🇵🇰", label: "Pakistani Rupee" },
];

// VasBazaar brand palette (turquoise → blue). Keys named coral/coralDark/coralSoft
// for backward-compatibility with components that already reference them.
export const RB = {
  coral: "#007BFF",          // primary accent (vasbazaar blue)
  coralDark: "#0056B3",      // deeper blue for gradient end / hover
  coralSoft: "rgba(0,123,255,0.12)", // translucent chip background
  accentStart: "#40E0D0",    // gradient start (turquoise)
  accentEnd: "#007BFF",      // gradient end (blue)
  gradient: "linear-gradient(135deg, #40E0D0 0%, #007BFF 100%)",
  ink: "var(--cm-ink, #1F2230)",
  muted: "var(--cm-muted, #6B7280)",
  border: "rgba(0,123,255,0.18)",
  cardBg: "var(--cm-card, #1A1A1A)",
  surface: "var(--cm-bg-secondary, #121212)",
  borderDark: "var(--cm-line, #2A2A2A)",
};
