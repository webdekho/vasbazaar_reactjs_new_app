export const loader = "LOADER";

// Allowed API hosts — prevents localStorage tampering
const ALLOWED_HOSTS = [
  'https://apis.vasbazaar.com',
  'https://apis.uat.vasbazaar.com',
  'https://api.prod.webdekho.in',
  '/vb-api',
];

export const server_api = () => {

    const storedUrl = localStorage.getItem('host');

     // Validate stored URL against whitelist before using
     if (storedUrl) {
       const isAllowed = ALLOWED_HOSTS.some(host => storedUrl.startsWith(host));
       if (isAllowed) return storedUrl;
     }

     // In development, CRA proxy (package.json "proxy") forwards to the API server
     // so we use empty string (relative to origin). In production, Apache proxies /vb-api/.
     if (process.env.NODE_ENV === 'development') return '';
     return '/vb-api';
   };
