// Simple test script to fetch market quotes from Fyers API through our backend
const axios = require('axios');
const fs = require('fs');

// Configuration
const config = {
  appId: 'MSEL25Z2K9-100',
  symbol: 'NSE:NIFTY50-INDEX',
  backendUrl: 'http://localhost:5000'
};

// Read the auth code from file
const authCode = fs.readFileSync('auth-code.txt', 'utf8').trim();

// Step 1: Validate auth code and get access token
const validateAuthCode = async () => {
  try {
    console.log('Step 1: Validating auth code...');
    console.log('🔑 Auth code:', authCode.substring(0, 20) + '...');
    
    const response = await axios.post(`${config.backendUrl}/api/fyers-callback`, {
      code: authCode,
      appId: config.appId,
      secret: '0O9FRN8DY0',
      redirectUri: 'https://trade.fyers.in/api-login/redirect-uri/index.html'
    });
    
    if (response.data && response.data.access_token) {
      console.log('✅ Auth code validated successfully');
      console.log('🔑 Access token:', response.data.access_token.substring(0, 20) + '...');
      return response.data.access_token;
    } else {
      throw new Error('Failed to validate auth code');
    }
  } catch (error) {
    console.error('❌ Error validating auth code:', error.response?.data || error.message);
    throw error;
  }
};

// Step 2: Fetch market quote
const fetchMarketQuote = async (accessToken) => {
  try {
    console.log(`Step 2: Fetching market quote for ${config.symbol}...`);
    
    // Format the access token correctly by adding the appId prefix if it's not already there
    let formattedToken = accessToken;
    if (!accessToken.includes(':')) {
      formattedToken = `${config.appId}:${accessToken}`;
      console.log('🔄 Reformatted token to include appId:', formattedToken.substring(0, 20) + '...');
    }
    
    const response = await axios.get(`${config.backendUrl}/api/market-data/quotes`, {
      params: { symbols: config.symbol },
      headers: { Authorization: formattedToken }
    });
    
    if (response.data && response.data.success) {
      console.log('✅ Market quote fetched successfully');
      console.log('📊 Quote data:');
      console.log(JSON.stringify(response.data.data, null, 2));
      return response.data;
    } else {
      throw new Error('Failed to fetch market quote');
    }
  } catch (error) {
    console.error('❌ Error fetching market quote:', error.response?.data || error.message);
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    const accessToken = await validateAuthCode();
    await fetchMarketQuote(accessToken);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the main function
main(); 