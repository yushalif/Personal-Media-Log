// Vercel Serverless Function: /api/auth
// Validates admin password against ADMIN_PASSWORD env var

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const { password } = body;

    const expectedPassword = process.env.ADMIN_PASSWORD || 'Celluloid-35mm-Odyssey#24';
    const isDefaultPassword = !process.env.ADMIN_PASSWORD;

    if (!password) {
      return res.status(400).json({ ok: false, error: 'Password required' });
    }

    if (password === expectedPassword) {
      // Generate a lightweight session token
      const timestamp = Date.now();
      const expiresAt = timestamp + (24 * 60 * 60 * 1000); // 24 hours
      // Simple signature token for single-user admin
      const tokenPayload = `${timestamp}:${expiresAt}:medialog-admin`;
      const token = Buffer.from(tokenPayload).toString('base64');

      return res.status(200).json({
        ok: true,
        token: `Bearer ${token}`,
        expiresAt,
        isDefaultPassword,
        message: 'Authentication successful.'
      });
    } else {
      return res.status(401).json({
        ok: false,
        error: 'Invalid password.'
      });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Server error' });
  }
}
