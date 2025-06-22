const fs = require('fs');
const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:5000';
const TEST_SYMBOLS = [
  'NSE:NIFTY50-INDEX',
  'NSE:NIFTYBANK-INDEX',
  'BSE:SENSEX-INDEX'
];

// Helper to get access token
async function getAccessToken() {
  try {
    // Try to read token from localStorage file
    if (fs.existsSync('localStorage.json')) {
      const data = JSON.parse(fs.readFileSync('localStorage.json', 'utf8'));
      if (data.access_token) {
        console.log('✅ Found access token in localStorage.json');
        return data.access_token;
      }
    }
    
    console.log('❌ No access token available. Please run generate-token.js first.');
    return null;
  } catch (error) {
    console.error(`❌ Error getting access token: ${error.message}`);
    return null;
  }
}

// Function to test direct Fyers API
async function testDirectFyersApi(accessToken) {
  console.log('\n=== Testing Direct Fyers API ===');
  try {
    const symbol = TEST_SYMBOLS[0]; // Just test the first symbol
    console.log(`📊 Fetching data for ${symbol} directly from Fyers API`);
    
    const response = await fetch(`https://api-t1.fyers.in/data-rest/v2/quotes?symbols=${symbol}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    
    const data = await response.json();
    console.log(`📊 Response data: ${JSON.stringify(data, null, 2)}`);
    
    if (data.s === 'ok' && data.d && data.d.length > 0) {
      console.log('✅ Direct Fyers API call successful');
      return true;
    } else {
      console.log('❌ Direct Fyers API call failed');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing direct Fyers API: ${error.message}`);
    return false;
  }
}

// Function to test our backend API
async function testBackendApi(accessToken) {
  console.log('\n=== Testing Backend API ===');
  try {
    const symbol = TEST_SYMBOLS[0]; // Just test the first symbol
    console.log(`📊 Fetching data for ${symbol} from our backend API`);
    
    const response = await fetch(`${API_URL}/api/market-data/quotes?symbols=${symbol}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    console.log(`📊 Response status: ${response.status}`);
    
    const data = await response.json();
    console.log(`📊 Response data: ${JSON.stringify(data, null, 2)}`);
    
    if (data.success && data.data && data.data.length > 0) {
      console.log('✅ Backend API call successful');
      return true;
    } else {
      console.log('❌ Backend API call failed');
      return false;
    }
  } catch (error) {
    console.error(`❌ Error testing backend API: ${error.message}`);
    return false;
  }
}

// Function to check server health
async function checkServerHealth() {
  console.log('\n=== Checking Server Health ===');
  try {
    const response = await fetch(`${API_URL}/api/health`);
    const data = await response.json();
    
    console.log(`📊 Health check response: ${JSON.stringify(data)}`);
    return response.ok;
  } catch (error) {
    console.error(`❌ Error checking server health: ${error.message}`);
    return false;
  }
}

// Function to check symbol validation
async function testSymbolValidation() {
  console.log('\n=== Testing Symbol Validation ===');
  try {
    const symbol = TEST_SYMBOLS[0];
    const response = await fetch(`${API_URL}/api/symbols/validate?symbol=${symbol}`);
    const data = await response.json();
    
    console.log(`📊 Symbol validation result: ${JSON.stringify(data)}`);
    return data.success && data.isValid;
  } catch (error) {
    console.error(`❌ Error testing symbol validation: ${error.message}`);
    return false;
  }
}

// Function to check server logs
async function checkServerLogs() {
  console.log('\n=== Checking Server Logs ===');
  try {
    console.log('Please check the server console for any error messages.');
    console.log('Look for errors related to:');
    console.log('1. Authentication issues (401 errors)');
    console.log('2. Rate limiting (429 errors)');
    console.log('3. Invalid symbols');
    console.log('4. API response format issues');
    
    return true;
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('🚀 Starting market data diagnosis');
  
  // Check server health
  const serverHealthy = await checkServerHealth();
  if (!serverHealthy) {
    console.error('❌ Server is not healthy. Please make sure the server is running.');
    return;
  }
  
  // Get access token
  const accessToken = await getAccessToken();
  if (!accessToken) {
    console.error('❌ No access token available. Please run generate-token.js first.');
    return;
  }
  
  // Test direct Fyers API
  const directApiSuccess = await testDirectFyersApi(accessToken);
  
  // Test our backend API
  const backendApiSuccess = await testBackendApi(accessToken);
  
  // Test symbol validation
  const symbolValidationSuccess = await testSymbolValidation();
  
  // Check server logs
  await checkServerLogs();
  
  // Summary
  console.log('\n=== Diagnosis Summary ===');
  console.log(`Server Health: ${serverHealthy ? '✅ Good' : '❌ Bad'}`);
  console.log(`Direct Fyers API: ${directApiSuccess ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Backend API: ${backendApiSuccess ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Symbol Validation: ${symbolValidationSuccess ? '✅ Working' : '❌ Not Working'}`);
  
  // Recommendations
  console.log('\n=== Recommendations ===');
  
  if (!directApiSuccess) {
    console.log('❌ The direct Fyers API call failed. This suggests:');
    console.log('  - Your access token may be invalid or expired');
    console.log('  - There may be connectivity issues with the Fyers API');
    console.log('  - The API endpoint or format may have changed');
    console.log('\n👉 Generate a fresh access token using generate-auth-code.js and generate-token.js');
  } else if (!backendApiSuccess) {
    console.log('❌ The backend API call failed but direct API works. This suggests:');
    console.log('  - There may be an issue with how the backend is handling the request');
    console.log('  - The backend may not be correctly passing the token to Fyers');
    console.log('  - There may be an issue with the response parsing in the backend');
    console.log('\n👉 Check the server logs for specific error messages');
    console.log('👉 Make sure the token format is correct in the backend');
  } else {
    console.log('✅ Both direct and backend API calls are working!');
    console.log('If you are still experiencing issues, check:');
    console.log('  - The client-side code for handling the API responses');
    console.log('  - Any caching mechanisms that might be serving stale data');
    console.log('  - Browser console for any JavaScript errors');
  }
  
  console.log('\n🏁 Diagnosis completed');
}

main().catch(error => {
  console.error(`❌ Unhandled error: ${error.message}`);
}); 