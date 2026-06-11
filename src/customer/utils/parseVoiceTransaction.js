// Best-effort parser that turns a spoken transcript (Hindi / Marathi / English)
// into { amount, note }. The caller always shows the result for confirmation,
// so this favours simple, predictable extraction over exhaustive NLP.

// Map Devanagari digits to ASCII.
const DEVANAGARI_DIGITS = { "०": "0", "१": "1", "२": "2", "३": "3", "४": "4", "५": "5", "६": "6", "७": "7", "८": "8", "९": "9" };

const normalizeDigits = (text) =>
  String(text || "").replace(/[०-९]/g, (d) => DEVANAGARI_DIGITS[d] || d);

// Number words → value, covering common Hindi/Marathi/English spoken amounts.
const UNIT_WORDS = {
  // English
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
  // Hindi/Marathi (romanised + Devanagari, common ones)
  ek: 1, "एक": 1, do: 2, "दो": 2, "दोन": 2, teen: 3, "तीन": 3, char: 4, chaar: 4, "चार": 4,
  paanch: 5, panch: 5, "पाच": 5, "पांच": 5, chah: 6, cheh: 6, "सहा": 6, "छह": 6, saat: 7, "सात": 7,
  aath: 8, "आठ": 8, nau: 9, "नौ": 9, "नऊ": 9, das: 10, dah: 10, "दस": 10, "दहा": 10,
};

const MULTIPLIER_WORDS = {
  hundred: 100, sau: 100, "सौ": 100, "शे": 100, "से": 100,
  thousand: 1000, hazaar: 1000, hazar: 1000, "हजार": 1000,
  lakh: 100000, lac: 100000, "लाख": 100000,
};

// Words/tokens to strip when deriving the note.
const NOISE_WORDS = new Set([
  "rupaye", "rupees", "rupee", "rs", "rupiya", "रुपये", "रुपया", "रुपय",
  "ka", "ki", "ke", "diye", "diya", "liye", "mile", "milra", "got", "gave", "and",
  "का", "के", "की", "दिले", "मिळाले", "ने", "को",
]);

const wordsToNumber = (tokens) => {
  // Resolve a run of number words into a single value (e.g. "paanch sau" -> 500).
  let total = 0;
  let current = 0;
  let matched = false;
  for (const raw of tokens) {
    const w = raw.toLowerCase();
    if (UNIT_WORDS[w] != null) {
      current += UNIT_WORDS[w];
      matched = true;
    } else if (MULTIPLIER_WORDS[w] != null) {
      current = (current || 1) * MULTIPLIER_WORDS[w];
      total += current;
      current = 0;
      matched = true;
    }
  }
  total += current;
  return matched ? total : null;
};

export const parseVoiceTransaction = (rawTranscript) => {
  const transcript = normalizeDigits(rawTranscript).trim();
  if (!transcript) return { amount: null, note: "" };

  let amount = null;

  // 1) Prefer an explicit numeric token (handles "500", "1,500", "₹2000").
  const numericMatch = transcript.replace(/[,₹]/g, "").match(/\d+(?:\.\d+)?/);
  if (numericMatch) {
    amount = Number(numericMatch[0]);
  } else {
    // 2) Fall back to spoken number words.
    const tokens = transcript.split(/\s+/);
    const fromWords = wordsToNumber(tokens);
    if (fromWords && fromWords > 0) amount = fromWords;
  }

  // Build the note from the leftover words (drop the amount token + noise words).
  const noteTokens = transcript
    .split(/\s+/)
    .filter((t) => {
      const clean = t.replace(/[,₹.]/g, "").toLowerCase();
      if (!clean) return false;
      if (/^\d+$/.test(clean)) return false; // numeric amount token
      if (NOISE_WORDS.has(clean)) return false;
      if (UNIT_WORDS[clean] != null || MULTIPLIER_WORDS[clean] != null) return false;
      return true;
    });

  return {
    amount: amount && amount > 0 ? amount : null,
    note: noteTokens.join(" ").trim(),
  };
};
