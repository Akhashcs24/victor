export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { grant_type, appIdHash, code, state } = req.body;

    console.log('🔐 Fyers auth validation request:', {
      grant_type,
      appIdHash: appIdHash?.substring(0, 20) + '...',
      code: code?.substring(0, 50) + '...',
      state
    });

    // Make request to Fyers API
    const fyersResponse = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type,
        appIdHash,
        code,
        state
      })
    });

    console.log('📥 Fyers API response status:', fyersResponse.status);

    const data = await fyersResponse.json();
    console.log('📥 Fyers API response:', data);

    // Return the response from Fyers API
    res.status(fyersResponse.status).json(data);

  } catch (error) {
    console.error('💥 Auth validation error:', error);
    res.status(500).json({ 
      error: 'Authentication failed', 
      message: error.message 
    });
  }
} 