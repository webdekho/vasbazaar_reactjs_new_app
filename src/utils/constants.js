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

     // Use relative proxy path to avoid CORS issues in browser
     // Apache proxies /vb-api/ -> https://apis.uat.vasbazaar.com:8081/
     return '/vb-api';
   };
