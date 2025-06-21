export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const authorization = req.headers.authorization;
    
    if (!authorization) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    console.log('🏛️ Fyers market status request');
    console.log('🔑 Using auth:', authorization.substring(0, 30) + '...');

    // Make request to Fyers API
    const fyersResponse = await fetch('https://api-t1.fyers.in/api/v3/market-status', {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      }
    });

    console.log('📥 Fyers market status response status:', fyersResponse.status);

    const data = await fyersResponse.json();
    console.log('📥 Fyers market status response:', JSON.stringify(data, null, 2));

    // Return the response from Fyers API
    res.status(fyersResponse.status).json(data);

  } catch (error) {
    console.error('💥 Market status fetch error:', error);
    res.status(500).json({ 
      error: 'Market status fetch failed', 
      message: error.message 
    });
  }
} 