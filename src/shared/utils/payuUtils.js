import { getPayUConfig } from '../constants/payu';

export const generatePayUHash = async (params) => {
  const config = getPayUConfig();
  const { txnid, amount, productinfo, firstname, email = '' } = params;

  const hashString = `${config.key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${config.salt}`;

  const encoder = new TextEncoder();
  const data = encoder.encode(hashString);
  const hashBuffer = await crypto.subtle.digest('SHA-512', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const buildPayUParams = (orderDetails) => {
  const config = getPayUConfig();
  return {
    key: config.key,
    txnid: orderDetails.txnId || `VB${Date.now()}`,
    amount: String(orderDetails.amount),
    productinfo: orderDetails.productInfo || 'VasBazaar Payment',
    firstname: orderDetails.firstName || '',
    email: orderDetails.email || '',
    phone: orderDetails.phone || '',
    surl: orderDetails.successUrl || `${window.location.origin}/customer/app/success`,
    furl: orderDetails.failureUrl || `${window.location.origin}/customer/app/wallet`,
  };
};

export const parsePayUResponse = (params) => {
  const status = String(params.status || '').toLowerCase();
  return {
    success: status === 'success',
    status,
    txnId: params.txnid || '',
    amount: params.amount || '',
    message: params.field9 || params.error_Message || '',
    payuMoneyId: params.payuMoneyId || '',
    bankRefNum: params.bank_ref_num || '',
    mode: params.mode || '',
  };
};
