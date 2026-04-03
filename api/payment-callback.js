export default function handler(req, res) {
  if (req.method === 'POST') {
    // Extract all payment params from POST body (form-urlencoded or JSON)
    const body = req.body || {};
    const orderId = body.order_id || body.orderId || '';
    const status = body.status || '';
    const sdkStatus = body.sdk_status || body.sdkStatus || '';
    const statusId = body.status_id || body.statusId || '';

    // Build query string with all available params
    const params = new URLSearchParams();
    if (orderId) params.append('order_id', orderId);
    if (status) params.append('status', status);
    if (sdkStatus) params.append('sdk_status', sdkStatus);
    if (statusId) params.append('status_id', statusId);

    // Redirect to GET with params so React app can handle it
    const redirectUrl = `/customer/app/payment-callback?${params.toString()}`;
    res.redirect(303, redirectUrl);
  } else {
    // For non-POST requests, redirect to React app
    res.redirect(303, '/customer/app/payment-callback');
  }
}
