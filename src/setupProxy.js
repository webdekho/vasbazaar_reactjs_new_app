const { createProxyMiddleware } = require("http-proxy-middleware");

const PROXY_TARGET = "https://apis.uat.vasbazaar.com:8081";

module.exports = function (app) {
  // Intercept POST to /customer/app/payment-callback from payment gateway
  // and redirect to GET with form data as query params so CRA serves index.html
  app.post("/customer/app/payment-callback", (req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });
    req.on("end", () => {
      const queryString = body || "";
      res.redirect(302, `/customer/app/payment-callback?${queryString}`);
    });
  });

  // Proxy each backend path with its own middleware instance
  const paths = ["/api", "/login", "/coupon", "/user"];
  paths.forEach((path) => {
    app.use(
      path,
      createProxyMiddleware({
        target: PROXY_TARGET,
        changeOrigin: true,
        secure: false,
        logLevel: "debug",
      })
    );
  });
};
