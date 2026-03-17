// PayU Payment Gateway Configuration
export const PAYU_CONFIG = {
  test: {
    key: 'rjQUPktU',
    salt: 'e5iIg1jwi8',
    url: 'https://test.payu.in/_payment',
  },
  prod: {
    key: 't88vPU',
    salt: 'DlHQZP8XlesWjsKMJjnVimMbvwkrS6hg',
    url: 'https://secure.payu.in/_payment',
  },
};

// Default to test in non-production environments
export const getPayUConfig = () => {
  const env = process.env.REACT_APP_PAYU_ENV || 'test';
  return PAYU_CONFIG[env] || PAYU_CONFIG.test;
};
