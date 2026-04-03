export default function handler(req, res) {
  if (req.method === 'POST') {
    // Extract order_id from POST body (form-urlencoded or JSON)
    const body = req.body || {};
    const orderId = body.order_id || body.orderId || '';
    const status = body.status || '';

    // Redirect to GET with params so React app can handle it
    const redirectUrl = `/customer/app/payment-callback?order_id=${orderId}&status=${status}`;
    res.redirect(303, redirectUrl);
  } else {
    // For non-POST requests, redirect to React app
    res.redirect(303, '/customer/app/payment-callback');
  }
}
