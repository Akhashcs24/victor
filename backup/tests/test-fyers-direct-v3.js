// Test script to directly call Fyers API v3 without going through our backend
const axios = require('axios');
const fs = require('fs');

// Configuration
const config = {
  appId: 'MSEL25Z2K9-100',
  symbol: 'NSE:NIFTY50-INDEX',
  fyersApiUrl: 'https://api-t1.fyers.in'
};

// Read the auth code from file
const authCode = fs.readFileSync('auth-code.txt', 'utf8').trim();

// Step 1: Validate auth code and get access token
const validateAuthCode = async () => {
  try {
    console.log('Step 1: Validating auth code...');
    console.log('🔑 Auth code:', authCode.substring(0, 20) + '...');
    
    const appIdHash = require('crypto-js/sha256')(`${config.appId}:0O9FRN8DY0`).toString();
    console.log('🔑 App ID Hash:', appIdHash);
    
    const response = await axios.post(`${config.fyersApiUrl}/api/v3/validate-authcode`, {
      grant_type: 'authorization_code',
      appIdHash: appIdHash,
      code: authCode
    }, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('📥 Response:', response.data);
    
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

// Step 2: Fetch market quote using the quotes endpoint
const fetchMarketQuote = async (accessToken) => {
  try {
    console.log(`Step 2: Fetching market quote for ${config.symbol}...`);
    
    // Format the authorization header
    const authHeader = `${config.appId}:${accessToken}`;
    console.log('🔑 Authorization header:', authHeader.substring(0, 20) + '...');
    
    // First try with data-rest/v2/quotes
    try {
      console.log('🔍 Trying with data-rest/v2/quotes endpoint...');
      const response = await axios.get(`${config.fyersApiUrl}/data-rest/v2/quotes`, {
        params: { symbols: config.symbol },
        headers: {
          'Authorization': authHeader
        }
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.warn('⚠️ First endpoint failed:', error.message);
      
      // Try with api/v2/quotes
      console.log('🔍 Trying with api/v2/quotes endpoint...');
      const response = await axios.get(`${config.fyersApiUrl}/api/v2/quotes`, {
        params: { symbols: config.symbol },
        headers: {
          'Authorization': authHeader
        }
      });
      
      console.log('📥 Response status:', response.status);
      console.log('📥 Response data:', JSON.stringify(response.data, null, 2));
      
      return response.data;
    }
  } catch (error) {
    console.error('❌ Error fetching market quote:', error.response?.data || error.message);
    throw error;
  }
};

// Step 3: Try to fetch profile as a test
const fetchProfile = async (accessToken) => {
  try {
    console.log('Step 3: Fetching user profile...');
    
    // Format the authorization header
    const authHeader = `${config.appId}:${accessToken}`;
    
    const response = await axios.get(`${config.fyersApiUrl}/api/v3/profile`, {
      headers: {
        'Authorization': authHeader
      }
    });
    
    console.log('📥 Profile response status:', response.status);
    console.log('📥 Profile data:', JSON.stringify(response.data, null, 2));
    
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching profile:', error.response?.data || error.message);
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    const accessToken = await validateAuthCode();
    
    // Try to fetch profile first as a test
    await fetchProfile(accessToken);
    
    // Then try to fetch market quote
    await fetchMarketQuote(accessToken);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the main function
main(); 