module.exports = function(app) {
  // Handle payment callback POST - convert to GET redirect for React Router
  app.post('/customer/app/payment-callback', (req, res) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      // Parse form data
      const params = new URLSearchParams(body);
      const orderId = params.get('order_id') || params.get('orderId') || '';
      const status = params.get('status') || '';

      // Redirect to GET with params so React Router can handle it
      const redirectUrl = `/customer/app/payment-callback?order_id=${orderId}&status=${status}`;
      console.log('[Proxy] Payment callback POST -> GET redirect:', redirectUrl);

      res.redirect(303, redirectUrl);
    });
  });
};
