// Test script to check if the access token is valid
const axios = require('axios');
const fs = require('fs');

// Configuration
const config = {
  appId: 'MSEL25Z2K9-100',
  apiUrl: 'https://api-t1.fyers.in'
};

// Read the access token from auth-code.txt
let accessToken;
try {
  accessToken = fs.readFileSync('auth-code.txt', 'utf8').trim();
  console.log('🔑 Access token read from file:', accessToken.substring(0, 20) + '...');
} catch (error) {
  console.error('❌ Could not read access token from file:', error.message);
  process.exit(1);
}

// Test token validity by calling the profile endpoint
const testTokenValidity = async () => {
  try {
    console.log('Testing token validity by calling the profile endpoint...');
    
    // Try with both token formats
    const tokenFormats = [
      `${config.appId}:${accessToken}`, // Format 1: appId:token
      accessToken // Format 2: just token
    ];
    
    for (const token of tokenFormats) {
      try {
        console.log(`\n🔍 Trying with token format: ${token.substring(0, 20)}...`);
        
        const response = await axios.get(`${config.apiUrl}/api/v3/profile`, {
          headers: {
            'Authorization': token
          }
        });
        
        console.log('✅ API call successful');
        console.log(`📊 Response status: ${response.status}`);
        console.log(`📊 Response data:`, JSON.stringify(response.data, null, 2));
        
        if (response.data.s === 'ok') {
          console.log('✅ Token is valid!');
          console.log('👤 User name:', response.data.data.name);
          console.log('\n✅ This token format works! Use it in your app.');
          return;
        } else {
          console.log('⚠️ Unexpected response format:', response.data);
        }
      } catch (error) {
        console.error(`❌ Error with token format "${token.substring(0, 10)}...":`, 
          error.response?.data || error.message);
      }
    }
    
    console.error('❌ All token formats failed. The token might be expired or invalid.');
  } catch (error) {
    console.error('❌ Error testing token validity:', error.message);
  }
};

// Run the test
testTokenValidity(); 