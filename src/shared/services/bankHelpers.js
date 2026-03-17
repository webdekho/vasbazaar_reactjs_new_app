export const maskAccountNumber = (accountNumber) => {
  if (!accountNumber) return '';
  const str = String(accountNumber);
  if (str.length <= 4) return str;
  return 'X'.repeat(str.length - 4) + str.slice(-4);
};

export const getBankStatusStyle = (status) => {
  const s = String(status).toLowerCase();
  switch (s) {
    case 'active':
    case 'approved':
      return { color: '#16a34a', label: 'Active' };
    case 'pending':
      return { color: '#f59e0b', label: 'Pending' };
    case 'rejected':
      return { color: '#ef4444', label: 'Rejected' };
    default:
      return { color: '#6b7280', label: status || 'Unknown' };
  }
};

export const getRejectReason = (reasonCode) => {
  const reasons = {
    invalid_account: 'Invalid account number',
    invalid_ifsc: 'Invalid IFSC code',
    name_mismatch: 'Account holder name mismatch',
    closed_account: 'Account is closed',
    default: 'Bank details verification failed',
  };
  return reasons[reasonCode] || reasons.default;
};

export const validateIFSC = (ifsc) => /^[A-Z]{4}0[A-Z0-9]{6}$/i.test(ifsc);

export const validateAccountNumber = (number) => /^\d{9,18}$/.test(number);
