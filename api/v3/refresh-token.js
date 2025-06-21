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
    const { refresh_token, appIdHash } = req.body;
    
    if (!refresh_token || !appIdHash) {
      return res.status(400).json({ error: 'refresh_token and appIdHash are required' });
    }

    console.log('🔄 Fyers refresh token request');
    console.log('🔑 Using appIdHash:', appIdHash.substring(0, 20) + '...');

    // Make request to Fyers API
    const fyersResponse = await fetch('https://api-t1.fyers.in/api/v3/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refresh_token,
        appIdHash
      })
    });

    console.log('📥 Fyers refresh token response status:', fyersResponse.status);

    const data = await fyersResponse.json();
    console.log('📥 Fyers refresh token response:', data);

    // Return the response from Fyers API
    res.status(fyersResponse.status).json(data);

  } catch (error) {
    console.error('💥 Refresh token error:', error);
    res.status(500).json({ 
      error: 'Refresh token failed', 
      message: error.message 
    });
  }
} 