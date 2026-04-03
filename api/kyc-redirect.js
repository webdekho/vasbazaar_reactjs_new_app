export default function handler(req, res) {
  const { gateway = '', type = '', client_id = '', status = '' } = req.query;

  const deeplink = `vasbazaar://kyc-callback?gateway=${gateway}&type=${type}&client_id=${client_id}&status=${status}`;

  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Opening VasBazaar</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
        .card { text-align: center; padding: 40px; background: white; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .spinner { width: 40px; height: 40px; border: 3px solid #e0e0e0; border-top-color: #6366f1; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
        @keyframes spin { to { transform: rotate(360deg); } }
        h2 { margin: 0 0 10px; color: #333; }
        p { color: #666; margin: 0 0 20px; }
        .btn { display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="spinner"></div>
        <h2>Opening VasBazaar</h2>
        <p>Please wait...</p>
        <a href="${deeplink}" class="btn">Open App</a>
      </div>
      <script>
        setTimeout(function() { window.location.href = "${deeplink}"; }, 100);
      </script>
    </body>
    </html>
  `);
}
