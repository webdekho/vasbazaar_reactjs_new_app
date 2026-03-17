export const loader = "LOADER";

export const server_api = () => {

    const storedUrl = localStorage.getItem('host');

     // If it exists, return the URL from localStorage
     if (storedUrl) {
       return storedUrl;
     }

     // Use relative proxy path to avoid CORS issues in browser
     // Apache proxies /vb-api/ -> https://apis.uat.vasbazaar.com:8081/
     return '/vb-api';
   };
