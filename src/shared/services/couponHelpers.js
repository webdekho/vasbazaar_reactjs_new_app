export const isExpired = (validity) => {
  if (!validity) return true;
  return new Date(validity) < new Date();
};

export const formatCouponDate = (dateString) => {
  if (!dateString) return '';
  const d = new Date(dateString);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

export const getDaysUntilExpiry = (validity) => {
  if (!validity) return 0;
  const diff = new Date(validity) - new Date();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

export const copyCouponCode = (code) => {
  if (navigator.clipboard) {
    return navigator.clipboard.writeText(code);
  }
  // Fallback
  const el = document.createElement('textarea');
  el.value = code;
  el.style.position = 'fixed';
  el.style.left = '-9999px';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
  return Promise.resolve();
};
