export const openPaymentUrl = (paymentUrl, options = {}) => {
  if (!isValidPaymentUrl(paymentUrl)) {
    console.warn('Invalid payment URL:', paymentUrl);
    return null;
  }

  const { width = 600, height = 700 } = options;
  const left = (window.screen.width - width) / 2;
  const top = (window.screen.height - height) / 2;

  return window.open(
    paymentUrl,
    'PaymentWindow',
    `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
  );
};

export const isValidPaymentUrl = (url) => {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

export const getPaymentStatus = (url) => {
  if (!url) return 'pending';
  const lower = url.toLowerCase();
  const successTerms = ['success', 'completed', 'approved', 'confirmed'];
  const failureTerms = ['failure', 'error', 'declined', 'cancelled', 'rejected', 'failed'];

  if (successTerms.some((t) => lower.includes(t))) return 'success';
  if (failureTerms.some((t) => lower.includes(t))) return 'failure';
  return 'pending';
};
