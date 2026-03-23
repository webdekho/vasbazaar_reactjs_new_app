// Juspay/HDFC Smart Gateway configuration for web
// Payment status codes from Juspay
export const JUSPAY_STATUS = {
  CHARGED: 'CHARGED',
  SUCCESS: 'SUCCESS',
  COMPLETED: 'COMPLETED',
  PENDING: 'PENDING',
  PENDING_VBV: 'PENDING_VBV',
  AUTHORIZING: 'AUTHORIZING',
  STARTED: 'STARTED',
  AUTHORIZATION_FAILED: 'AUTHORIZATION_FAILED',
  AUTHENTICATION_FAILED: 'AUTHENTICATION_FAILED',
  JUSPAY_DECLINED: 'JUSPAY_DECLINED',
  FAILURE: 'FAILURE',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  USER_ABORTED: 'USER_ABORTED',
  BACKPRESSED: 'BACKPRESSED',
};

export const isSuccessStatus = (status) => {
  const s = status?.toUpperCase();
  return ['CHARGED', 'SUCCESS', 'COMPLETED'].includes(s);
};

export const isPendingStatus = (status) => {
  const s = status?.toUpperCase();
  return ['PENDING', 'PENDING_VBV', 'AUTHORIZING', 'STARTED'].includes(s);
};

export const isFailedStatus = (status) => {
  const s = status?.toUpperCase();
  return ['AUTHORIZATION_FAILED', 'AUTHENTICATION_FAILED', 'JUSPAY_DECLINED', 'FAILURE', 'FAILED'].includes(s);
};

export const isCancelledStatus = (status) => {
  const s = status?.toUpperCase();
  return ['CANCELLED', 'USER_ABORTED', 'BACKPRESSED'].includes(s);
};

// Session storage key for pending payment context
export const PENDING_PAYMENT_KEY = 'vb_pending_juspay_payment';
