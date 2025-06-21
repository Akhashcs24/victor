// Updated: Force deployment refresh
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📋 All request headers:', JSON.stringify(req.headers, null, 2));
    console.log('📋 Request method:', req.method);
    console.log('📋 Request query:', JSON.stringify(req.query, null, 2));
    
    const authorization = req.headers.authorization;
    const { symbols } = req.query;
    
    if (!authorization) {
      console.log('❌ Authorization header missing');
      console.log('📋 Available headers:', Object.keys(req.headers));
      return res.status(401).json({ 
        error: 'Authorization header missing',
        availableHeaders: Object.keys(req.headers),
        allHeaders: req.headers
      });
    }

    if (!symbols) {
      console.log('❌ Symbols parameter missing');
      return res.status(400).json({ error: 'Symbols parameter missing' });
    }

    console.log('📊 Fyers quotes request for symbols:', symbols);
    console.log('🔑 Using auth:', authorization.substring(0, 30) + '...');
    console.log('🌐 Full request URL:', `https://api-t1.fyers.in/api/v3/quotes?symbols=${encodeURIComponent(symbols)}`);

    // Make request to Fyers API with properly encoded symbols
    const fyersResponse = await fetch(`https://api-t1.fyers.in/api/v3/quotes?symbols=${symbols}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      },
      timeout: 8000 // 8 second timeout
    });

    console.log('📥 Fyers quotes response status:', fyersResponse.status);
    console.log('📥 Fyers quotes response headers:', Object.fromEntries(fyersResponse.headers.entries()));

    if (!fyersResponse.ok) {
      const errorText = await fyersResponse.text();
      console.log('❌ Fyers API error response:', errorText);
      return res.status(fyersResponse.status).json({ 
        error: 'Fyers API error', 
        status: fyersResponse.status,
        message: errorText 
      });
    }

    const data = await fyersResponse.json();
    console.log('📥 Fyers quotes response:', JSON.stringify(data, null, 2));

    // Return the response from Fyers API
    res.status(200).json(data);

  } catch (error) {
    console.error('💥 Quotes fetch error:', error);
    res.status(500).json({ 
      error: 'Quotes fetch failed', 
      message: error.message 
    });
  }
} 