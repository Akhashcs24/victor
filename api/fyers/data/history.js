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
    const { symbol, resolution, date_format, cont_flag, range_from, range_to } = req.query;
    
    if (!authorization) {
      return res.status(401).json({ error: 'Authorization header missing' });
    }

    if (!symbol || !resolution) {
      return res.status(400).json({ error: 'Symbol and resolution parameters are required' });
    }

    console.log('📈 Fyers history request for symbol:', symbol, 'resolution:', resolution);
    console.log('🔑 Using auth:', authorization.substring(0, 30) + '...');

    // Build query parameters
    const params = new URLSearchParams({
      symbol,
      resolution,
      date_format: date_format || '1',
      cont_flag: cont_flag || '1'
    });

    if (range_from) params.append('range_from', range_from);
    if (range_to) params.append('range_to', range_to);

    // Make request to Fyers API
    const fyersResponse = await fetch(`https://api-t1.fyers.in/api/v3/history?${params.toString()}`, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      }
    });

    console.log('📥 Fyers history response status:', fyersResponse.status);

    const data = await fyersResponse.json();
    console.log('📥 Fyers history response:', JSON.stringify(data, null, 2));

    // Return the response from Fyers API
    res.status(fyersResponse.status).json(data);

  } catch (error) {
    console.error('💥 History fetch error:', error);
    res.status(500).json({ 
      error: 'History fetch failed', 
      message: error.message 
    });
  }
} 