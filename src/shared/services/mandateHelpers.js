export const isMandateActive = (status) =>
  ['ACTIVE', 'CREATED', 'SUCCESS'].includes(String(status).toUpperCase());

export const isMandatePending = (status) =>
  ['NEW', 'PENDING', 'INITIATED', 'PROCESSING'].includes(String(status).toUpperCase());

export const isMandateFailed = (status) =>
  ['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(String(status).toUpperCase());

export const getMandateStatusColor = (status) => {
  if (isMandateActive(status)) return '#16a34a';
  if (isMandatePending(status)) return '#f59e0b';
  if (isMandateFailed(status)) return '#ef4444';
  return '#6b7280';
};

export const getMandateStatusLabel = (status) => {
  const s = String(status).toUpperCase();
  if (isMandateActive(s)) return 'Active';
  if (isMandatePending(s)) return 'Pending';
  if (isMandateFailed(s)) return 'Failed';
  if (s === 'REVOKED') return 'Revoked';
  if (s === 'STOPPED') return 'Stopped';
  return status || 'Unknown';
};
