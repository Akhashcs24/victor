// Test script to fetch market quotes through our backend API with additional debugging
const axios = require('axios');
const fs = require('fs');

// Configuration
const config = {
  appId: 'MSEL25Z2K9-100',
  symbol: 'NSE:NIFTY50-INDEX',
  backendUrl: 'http://localhost:5000'
};

// Read the auth code from file or use the one provided
let authCode;
try {
  authCode = fs.readFileSync('auth-code.txt', 'utf8').trim();
} catch (error) {
  console.error('❌ Could not read auth code from file. Please provide it as a command line argument.');
  process.exit(1);
}

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
    
    console.log('📥 Raw response:', JSON.stringify(response.data, null, 2));
    
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

// Step 2: Test the backend /api/market-data/quotes endpoint
const testBackendQuotesEndpoint = async (accessToken) => {
  try {
    console.log(`Step 2: Testing backend quotes endpoint for ${config.symbol}...`);
    console.log('🔑 Using access token:', accessToken.substring(0, 20) + '...');
    
    // First try with appId:token format
    try {
      console.log('🔍 Trying with appId:token format...');
      const formattedToken = `${config.appId}:${accessToken}`;
      
      const response = await axios.get(`${config.backendUrl}/api/market-data/quotes`, {
        params: { symbols: config.symbol },
        headers: { 
          Authorization: formattedToken 
        }
      });
      
      console.log('✅ Backend quotes endpoint test successful with appId:token format');
      console.log('📊 Response data:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.warn('⚠️ First attempt failed:', error.response?.data || error.message);
      
      // Try with just the token
      console.log('🔍 Trying with just the token...');
      const response = await axios.get(`${config.backendUrl}/api/market-data/quotes`, {
        params: { symbols: config.symbol },
        headers: { 
          Authorization: accessToken 
        }
      });
      
      console.log('✅ Backend quotes endpoint test successful with just the token');
      console.log('📊 Response data:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    }
  } catch (error) {
    console.error('❌ Error testing backend quotes endpoint:', error.response?.data || error.message);
    throw error;
  }
};

// Step 3: Test direct Fyers API call for comparison
const testDirectFyersCall = async (accessToken) => {
  try {
    console.log('Step 3: Testing direct Fyers API call...');
    console.log('🔑 Using access token:', accessToken.substring(0, 20) + '...');
    
    // First try with appId:token format
    try {
      console.log('🔍 Trying with appId:token format...');
      const formattedToken = `${config.appId}:${accessToken}`;
      
      const response = await axios.get('https://api-t1.fyers.in/data/quotes', {
        params: { symbols: config.symbol },
        headers: { 
          Authorization: formattedToken 
        }
      });
      
      console.log('✅ Direct Fyers API call successful with appId:token format');
      console.log('📊 Response data:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    } catch (error) {
      console.warn('⚠️ First attempt failed:', error.response?.data || error.message);
      
      // Try with just the token
      console.log('🔍 Trying with just the token...');
      const response = await axios.get('https://api-t1.fyers.in/data/quotes', {
        params: { symbols: config.symbol },
        headers: { 
          Authorization: accessToken 
        }
      });
      
      console.log('✅ Direct Fyers API call successful with just the token');
      console.log('📊 Response data:');
      console.log(JSON.stringify(response.data, null, 2));
      
      return response.data;
    }
  } catch (error) {
    console.error('❌ Error testing direct Fyers API call:', error.response?.data || error.message);
    throw error;
  }
};

// Main function
const main = async () => {
  try {
    // If auth code is provided as command line argument, use it
    if (process.argv[2]) {
      authCode = process.argv[2];
    }
    
    // Step 1: Validate auth code and get access token
    const accessToken = await validateAuthCode();
    
    // Step 2: Test the backend quotes endpoint
    await testBackendQuotesEndpoint(accessToken);
    
    // Step 3: Test direct Fyers API call
    await testDirectFyersCall(accessToken);
    
    console.log('✅ All tests completed successfully');
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
};

// Run the main function
main(); 