// Test script to fetch market quotes from Fyers API through our backend
require('dotenv').config();
const axios = require('axios');
const crypto = require('crypto-js');

// Configuration
const config = {
  appId: 'MSEL25Z2K9-100',
  secret: '0O9FRN8DY0',
  redirectUri: 'https://trade.fyers.in/api-login/redirect-uri/index.html',
  symbol: 'NSE:NIFTY50-INDEX',
  backendUrl: 'http://localhost:5000'
};

// Generate app ID hash (SHA-256 of appId:secret)
const generateAppIdHash = () => {
  return crypto.SHA256(`${config.appId}:${config.secret}`).toString();
};

// Step 1: Generate auth URL
const generateAuthUrl = async () => {
  try {
    console.log('Step 1: Generating auth URL...');
    
    const response = await axios.post(`${config.backendUrl}/api/login`, {
      appId: config.appId,
      secret: config.secret,
      redirectUri: config.redirectUri
    });
    
    if (response.data && response.data.url) {
      console.log('✅ Auth URL generated successfully');
      console.log('🔗 Please open this URL in your browser:');
      console.log(response.data.url);
      console.log('\nAfter logging in, you will be redirected to a page with the auth code.');
      console.log('Copy the auth code from the URL parameter "auth_code=" and run this script again with:');
      console.log('node test-fyers-quote.js YOUR_AUTH_CODE_HERE');
      return response.data.url;
    } else {
      throw new Error('Failed to generate auth URL');
    }
  } catch (error) {
    console.error('❌ Error generating auth URL:', error.response?.data || error.message);
    throw error;
  }
};

// Step 2: Validate auth code and get access token
const validateAuthCode = async (authCode) => {
  try {
    console.log('Step 2: Validating auth code...');
    console.log('🔑 Auth code:', authCode);
    
    const response = await axios.post(`${config.backendUrl}/api/fyers-callback`, {
      code: authCode,
      appId: config.appId,
      secret: config.secret,
      redirectUri: config.redirectUri
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

// Step 3: Fetch market quote
const fetchMarketQuote = async (accessToken) => {
  try {
    console.log(`Step 3: Fetching market quote for ${config.symbol}...`);
    
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
    // Check if auth code is provided as command line argument
    const authCode = process.argv[2];
    
    if (!authCode) {
      // If no auth code provided, generate auth URL
      await generateAuthUrl();
    } else {
      // If auth code provided, validate it and fetch market quote
      const accessToken = await validateAuthCode(authCode);
      await fetchMarketQuote(accessToken);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the main function
main(); 