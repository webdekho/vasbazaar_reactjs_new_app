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

// The logged-in customer, read from the same localStorage blob the rest of the
// app uses. Returns a member-shaped object so the creator can be auto-added.
export const getCurrentUser = () => {
  try {
    const u = JSON.parse(localStorage.getItem("customerUserData") || "null");
    if (!u) return null;
    const name = u.name || u.firstName || u.userName || u.user_name || u.customerName || "You";
    const mobile = (u.mobile || u.mobileNumber || "").toString().replace(/\D/g, "").slice(-10);
    return { id: "self", name, mobile, isSelf: true };
  } catch {
    return null;
  }
};

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

// The viewer's own member in a group. The backend marks it with isSelf per
// viewer (mobile match); fall back to the conventional "self" id for safety.
export const selfMember = (group) =>
  (group?.members || []).find((m) => m.isSelf) ||
  (group?.members || []).find((m) => m.id === "self") || null;

// Aggregate the viewer's owe/owed position across many groups, broken down by
// counterparty (keyed by mobile) and kept per-currency so different currencies
// never get summed together. Uses simplified settlements so it matches the
// per-group "Settle up" view. Returns:
//   { byCurrency: { INR: { owed, owe, net,
//       people: { "<mobile>": { name, mobile, net } } }, ... } }
export const buildBalanceReport = (groups) => {
  const byCurrency = {};
  (groups || []).forEach((group) => {
    const self = selfMember(group);
    if (!self) return;
    const currency = group.currency || "INR";
    const mMap = memberMap(group);
    const bucket = byCurrency[currency] || (byCurrency[currency] = { owed: 0, owe: 0, net: 0, people: {} });

    simplifySettlements(group).forEach((s) => {
      let other = null;
      let signed = 0; // + = they owe you, - = you owe them
      if (s.from === self.id) { other = mMap[s.to]; signed = -s.amount; }
      else if (s.to === self.id) { other = mMap[s.from]; signed = s.amount; }
      if (!other) return;

      const key = other.mobile || other.id;
      const person = bucket.people[key] || (bucket.people[key] = { name: other.name, mobile: other.mobile, net: 0 });
      person.net += signed;
      if (other.name) person.name = other.name;
    });
  });

  // Recompute per-currency totals from the (already netted) people map so the
  // summary always matches the breakdown rows.
  Object.values(byCurrency).forEach((bucket) => {
    bucket.owed = 0; bucket.owe = 0;
    Object.values(bucket.people).forEach((p) => {
      p.net = Math.round(p.net * 100) / 100;
      if (p.net > 0.009) bucket.owed += p.net;
      else if (p.net < -0.009) bucket.owe += -p.net;
    });
    bucket.owed = Math.round(bucket.owed * 100) / 100;
    bucket.owe = Math.round(bucket.owe * 100) / 100;
    bucket.net = Math.round((bucket.owed - bucket.owe) * 100) / 100;
  });

  return byCurrency;
};

// Preset group categories (mirrors the "Made for moments like" list on the home
// screen). Users can pick one of these or type their own.
export const CATEGORIES = [
  "Trip", "Flatmates", "Vacation", "Festival", "Camping", "Dinner",
  "Office", "Family", "Event", "Other",
];

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
