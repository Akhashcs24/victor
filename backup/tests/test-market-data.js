const fetch = require('node-fetch');
const fs = require('fs');
const readline = require('readline');

// Configuration
const API_URL = 'http://localhost:5000';
const TEST_SYMBOL = 'NSE:NIFTY50-INDEX';
const LOG_FILE = 'market-data-test.log';

// Create a readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper to log to both console and file
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  console.log(logMessage);
  fs.appendFileSync(LOG_FILE, logMessage + '\n');
}

// Clear previous log file
fs.writeFileSync(LOG_FILE, '=== Market Data Test Log ===\n\n');

// Function to get access token
async function getAccessToken() {
  try {
    // Try to read token from localStorage file (if it exists)
    if (fs.existsSync('localStorage.json')) {
      const data = JSON.parse(fs.readFileSync('localStorage.json', 'utf8'));
      if (data.access_token) {
        log('✅ Found access token in localStorage.json');
        return data.access_token;
      }
    }
    
    // If no token found, check if we have auth data in the server
    try {
      const authResponse = await fetch(`${API_URL}/api/auth/check-status`);
      const authData = await authResponse.json();
      
      if (authData.isAuthenticated && authData.accessToken) {
        log('✅ Retrieved access token from auth status endpoint');
        return authData.accessToken;
      }
    } catch (error) {
      log(`⚠️ Could not get token from server: ${error.message}`);
    }
    
    // If we still don't have a token, ask the user
    return new Promise((resolve) => {
      log('⚠️ No access token found automatically');
      console.log('\nPlease enter your access token manually:');
      rl.question('> ', (token) => {
        if (token && token.trim()) {
          log('✅ Using manually provided access token');
          
          // Save it for future use
          const data = {
            access_token: token.trim(),
            extracted_at: new Date().toISOString()
          };
          fs.writeFileSync('localStorage.json', JSON.stringify(data, null, 2));
          log('✅ Token saved to localStorage.json for future use');
          
          resolve(token.trim());
        } else {
          log('❌ No token provided');
          resolve(null);
        }
      });
    });
  } catch (error) {
    log(`❌ Error getting access token: ${error.message}`);
    return null;
  }
}

// Function to test direct Fyers API
async function testDirectFyersApi(accessToken) {
  log('\n=== Testing Direct Fyers API ===');
  try {
    log(`📊 Fetching data for ${TEST_SYMBOL} directly from Fyers API`);
    
    const response = await fetch(`https://api-t1.fyers.in/data-rest/v2/quotes?symbols=${TEST_SYMBOL}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    log(`📊 Response status: ${response.status}`);
    
    const data = await response.json();
    log(`📊 Response data: ${JSON.stringify(data, null, 2)}`);
    
    if (data.s === 'ok' && data.d && data.d.length > 0) {
      log('✅ Direct Fyers API call successful');
    } else {
      log('❌ Direct Fyers API call failed');
    }
    
    return data;
  } catch (error) {
    log(`❌ Error testing direct Fyers API: ${error.message}`);
    return null;
  }
}

// Function to test our backend API
async function testBackendApi(accessToken) {
  log('\n=== Testing Backend API ===');
  try {
    log(`📊 Fetching data for ${TEST_SYMBOL} from our backend API`);
    
    const response = await fetch(`${API_URL}/api/market-data/quotes?symbols=${TEST_SYMBOL}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    log(`📊 Response status: ${response.status}`);
    
    const data = await response.json();
    log(`📊 Response data: ${JSON.stringify(data, null, 2)}`);
    
    if (data.success && data.data && data.data.length > 0) {
      log('✅ Backend API call successful');
    } else {
      log('❌ Backend API call failed');
    }
    
    return data;
  } catch (error) {
    log(`❌ Error testing backend API: ${error.message}`);
    return null;
  }
}

// Function to test symbol validation
async function testSymbolValidation() {
  log('\n=== Testing Symbol Validation ===');
  try {
    const response = await fetch(`${API_URL}/api/symbols/validate?symbol=${TEST_SYMBOL}`);
    const data = await response.json();
    
    log(`📊 Symbol validation result: ${JSON.stringify(data)}`);
    return data;
  } catch (error) {
    log(`❌ Error testing symbol validation: ${error.message}`);
    return null;
  }
}

// Main test function
async function runTests() {
  log('🚀 Starting market data test');
  
  // Get access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    log('❌ Test aborted: No access token available');
    rl.close();
    return;
  }
  
  // Test direct Fyers API
  const directApiResult = await testDirectFyersApi(accessToken);
  
  // Test our backend API
  const backendApiResult = await testBackendApi(accessToken);
  
  // Test symbol validation
  await testSymbolValidation();
  
  // Compare results
  log('\n=== Test Summary ===');
  if (directApiResult && directApiResult.s === 'ok') {
    log('✅ Direct Fyers API: SUCCESS');
  } else {
    log('❌ Direct Fyers API: FAILED');
  }
  
  if (backendApiResult && backendApiResult.success) {
    log('✅ Backend API: SUCCESS');
  } else {
    log('❌ Backend API: FAILED');
  }
  
  log('\n🏁 Test completed');
  rl.close();
}

// Run the tests
runTests().catch(error => {
  log(`❌ Unhandled error in test: ${error.message}`);
  log(error.stack);
  rl.close();
}); 