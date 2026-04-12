export default function handler(req, res) {
  if (req.method === 'POST') {
    // Extract all mandate params from POST body (form-urlencoded or JSON)
    const body = req.body || {};
    const orderId = body.order_id || body.orderId || body.mandate_id || body.mandateId || '';
    const status = body.status || body.mandateStatus || '';
    const customerId = body.customer_id || body.customerId || body.mandateCustomerId || '';
    const message = body.message || '';

    // Build query string with all available params
    const params = new URLSearchParams();
    if (orderId) params.append('order_id', orderId);
    if (status) params.append('status', status);
    if (customerId) params.append('customer_id', customerId);
    if (message) params.append('message', message);

    // Redirect to GET with params so React app can handle it
    const redirectUrl = `/customer/app/autopay-callback?${params.toString()}`;
    res.redirect(303, redirectUrl);
  } else {
    // For non-POST requests, redirect to React app
    const queryString = new URLSearchParams(req.query || {}).toString();
    const redirectUrl = queryString
      ? `/customer/app/autopay-callback?${queryString}`
      : '/customer/app/autopay-callback';
    res.redirect(303, redirectUrl);
  }
}
