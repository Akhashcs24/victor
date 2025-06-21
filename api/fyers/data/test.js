export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('🧪 Test endpoint called');
    console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
    console.log('📋 Query:', JSON.stringify(req.query, null, 2));
    console.log('📋 Method:', req.method);
    
    const authorization = req.headers.authorization;
    const { symbols } = req.query;
    
    console.log('🔑 Authorization:', authorization ? authorization.substring(0, 30) + '...' : 'MISSING');
    console.log('📊 Symbols:', symbols);
    
    if (!authorization) {
      console.log('❌ No authorization header');
      return res.status(400).json({ error: 'No authorization header' });
    }
    
    if (!symbols) {
      console.log('❌ No symbols parameter');
      return res.status(400).json({ error: 'No symbols parameter' });
    }
    
    // Test the actual Fyers API call
    console.log('🌐 Making test request to Fyers API...');
    const fyersUrl = `https://api-t1.fyers.in/api/v3/quotes?symbols=${encodeURIComponent(symbols)}`;
    console.log('🔗 URL:', fyersUrl);
    
    const fyersResponse = await fetch(fyersUrl, {
      method: 'GET',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
      }
    });
    
    console.log('📥 Fyers response status:', fyersResponse.status);
    console.log('📥 Fyers response headers:', Object.fromEntries(fyersResponse.headers.entries()));
    
    const responseText = await fyersResponse.text();
    console.log('📥 Fyers response text:', responseText);
    
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (e) {
      console.log('❌ Failed to parse response as JSON');
      responseData = { raw: responseText };
    }
    
    res.status(200).json({
      test: 'success',
      fyersStatus: fyersResponse.status,
      fyersResponse: responseData,
      requestInfo: {
        authorization: authorization ? authorization.substring(0, 30) + '...' : 'MISSING',
        symbols,
        url: fyersUrl
      }
    });
    
  } catch (error) {
    console.error('💥 Test endpoint error:', error);
    res.status(500).json({ 
      error: 'Test failed', 
      message: error.message,
      stack: error.stack
    });
  }
} 