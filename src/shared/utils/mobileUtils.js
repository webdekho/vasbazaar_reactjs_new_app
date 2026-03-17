export const normalizeMobileNumber = (number) => {
  if (!number) return '';
  const digits = String(number).replace(/\D/g, '');
  // Remove country code prefix if present
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
  return digits;
};

export const isValidMobileNumber = (number) => {
  const normalized = normalizeMobileNumber(number);
  return /^[6-9]\d{9}$/.test(normalized);
};

export const formatMobileDisplay = (number) => {
  const normalized = normalizeMobileNumber(number);
  if (normalized.length !== 10) return normalized;
  return `${normalized.slice(0, 5)} ${normalized.slice(5)}`;
};

export const maskMobileNumber = (number) => {
  const normalized = normalizeMobileNumber(number);
  if (normalized.length < 10) return normalized;
  return `${normalized.slice(0, 2)}${'X'.repeat(6)}${normalized.slice(-2)}`;
};
