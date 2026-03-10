export const loader = "LOADER";

export const server_api = () => {

    const storedUrl = localStorage.getItem('host');

     // If it exists, return the URL from localStorage
     if (storedUrl) {
       return storedUrl;
     }

     // Otherwise, return the default URL
   return `${window.location.protocol}//${window.location.hostname}:8086`;
   };
