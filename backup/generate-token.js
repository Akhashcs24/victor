const fs = require('fs');
const readline = require('readline');
const fetch = require('node-fetch');
const axios = require('axios');
const crypto = require('crypto');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('=== Fyers Access Token Generator ===');
console.log('This script will generate a Fyers access token using your auth code');

// Configuration
const config = {
  appId: 'MSEL25Z2K9-100',
  secretKey: '0O9FRN8DY0',
  redirectUri: 'https://trade.fyers.in/api-login/redirect-uri/index.html'
};

// Function to get auth code and app ID hash
function getAuthData() {
  return new Promise((resolve) => {
    // Check if we have a stored auth code
    if (fs.existsSync('auth-code.json')) {
      try {
        const data = JSON.parse(fs.readFileSync('auth-code.json', 'utf8'));
        console.log('Found saved auth code and app ID hash');
        rl.question('Use saved auth data? (y/n): ', (answer) => {
          if (answer.toLowerCase() === 'y') {
            resolve({
              code: data.auth_code,
              appIdHash: data.app_id_hash
            });
            return;
          }
          promptForAuthData(resolve);
        });
        return;
      } catch (error) {
        console.log('Error reading saved auth code:', error.message);
      }
    }
    
    promptForAuthData(resolve);
  });
}

// Function to prompt for auth data
function promptForAuthData(resolve) {
  rl.question('Enter your auth code: ', (code) => {
    rl.question('Enter your app ID hash: ', (appIdHash) => {
      resolve({
        code: code.trim(),
        appIdHash: appIdHash.trim()
      });
    });
  });
}

// Function to generate access token
async function generateToken(authData) {
  console.log('\nGenerating access token...');
  
  try {
    const response = await fetch('https://api-t1.fyers.in/api/v3/validate-authcode', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        appIdHash: authData.appIdHash,
        code: authData.code
      })
    });
    
    const data = await response.json();
    console.log('\nAPI Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.s === 'ok' && data.access_token) {
      // Save token to localStorage.json for the test script
      fs.writeFileSync('localStorage.json', JSON.stringify({
        access_token: data.access_token,
        extracted_at: new Date().toISOString()
      }, null, 2));
      
      console.log('\n✅ Access token saved to localStorage.json');
      return data.access_token;
    } else {
      console.log('\n❌ Failed to generate access token');
      return null;
    }
  } catch (error) {
    console.error('\n❌ Error generating token:', error.message);
    return null;
  }
}

// Generate hash of appId:secretKey
function generateAppIdHash() {
  return crypto.createHash('sha256').update(`${config.appId}:${config.secretKey}`).digest('hex');
}

// Generate access token
async function generateAccessToken() {
  try {
    console.log('🔐 Generating access token...');
    
    const appIdHash = generateAppIdHash();
    console.log('🔑 App ID Hash:', appIdHash.substring(0, 20) + '...');
    
    const response = await axios.post('https://api-t1.fyers.in/api/v3/validate-authcode', {
      grant_type: 'authorization_code',
      appIdHash,
      code: authCode
    });
    
    console.log('📥 Response status:', response.status);
    
    if (response.data && response.data.access_token) {
      console.log('✅ Access token generated successfully!');
      console.log('🔑 Access token:', response.data.access_token.substring(0, 20) + '...');
      
      // Save the access token to file
      fs.writeFileSync('access-token.txt', response.data.access_token);
      console.log('💾 Access token saved to access-token.txt');
      
      // Test the token
      await testToken(response.data.access_token);
      
      return response.data.access_token;
    } else {
      console.error('❌ Failed to generate access token:', response.data);
      return null;
    }
  } catch (error) {
    console.error('❌ Error generating access token:', error.response?.data || error.message);
    return null;
  }
}

// Test the token
async function testToken(token) {
  try {
    console.log('\n🔍 Testing the token by calling the profile endpoint...');
    
    const response = await axios.get('https://api-t1.fyers.in/api/v3/profile', {
      headers: {
        'Authorization': token
      }
    });
    
    console.log('✅ Token is valid!');
    console.log('👤 User name:', response.data.data.name);
    return true;
  } catch (error) {
    console.error('❌ Error testing token:', error.response?.data || error.message);
    return false;
  }
}

// Main function
async function main() {
  try {
    const authData = await getAuthData();
    console.log('\nUsing auth data:');
    console.log(`- Auth code: ${authData.code.substring(0, 10)}...`);
    console.log(`- App ID hash: ${authData.appIdHash.substring(0, 10)}...`);
    
    const token = await generateToken(authData);
    
    if (token) {
      console.log('\n🚀 Success! You can now run: node test-market-data.js');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    rl.close();
  }
}

main(); 