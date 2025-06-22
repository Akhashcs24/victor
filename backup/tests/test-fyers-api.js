const fetch = require('node-fetch');

// Configuration - using the provided app ID
const APP_ID = 'MSEL25Z2K9-100';
const TEST_SYMBOL = 'NSE:NIFTY50-INDEX';

// Function to test the Fyers API with a token
async function testFyersApi(accessToken) {
  console.log(`\n=== Testing Fyers API with symbol: ${TEST_SYMBOL} ===`);
  
  try {
    console.log(`Using access token: ${accessToken.substring(0, 10)}...`);
    
    const response = await fetch(`https://api-t1.fyers.in/data-rest/v2/quotes?symbols=${TEST_SYMBOL}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.s === 'ok' && data.d && data.d.length > 0) {
      console.log('\n✅ Fyers API test successful!');
      
      // Extract and display the market data
      const quote = data.d[0];
      if (quote.s === 'ok' && quote.v) {
        console.log('\nMarket data:');
        console.log(`Symbol: ${quote.n}`);
        console.log(`LTP: ${quote.v.lp}`);
        console.log(`Open: ${quote.v.open_price}`);
        console.log(`High: ${quote.v.high_price}`);
        console.log(`Low: ${quote.v.low_price}`);
        console.log(`Previous Close: ${quote.v.prev_close_price}`);
        console.log(`Volume: ${quote.v.volume}`);
        console.log(`Change: ${quote.v.ch} (${quote.v.chp}%)`);
      }
      
      return true;
    } else {
      console.log('\n❌ Fyers API test failed!');
      
      if (data.code === 401) {
        console.log('Authentication error - token may be expired or invalid');
      } else if (data.code === 429) {
        console.log('Rate limit exceeded - too many requests');
      }
      
      return false;
    }
  } catch (error) {
    console.error(`Error testing Fyers API: ${error.message}`);
    return false;
  }
}

// Function to test our backend API
async function testBackendApi(accessToken) {
  console.log(`\n=== Testing Backend API with symbol: ${TEST_SYMBOL} ===`);
  
  try {
    const response = await fetch(`http://localhost:5000/api/market-data/quotes?symbols=${TEST_SYMBOL}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.length > 0) {
      console.log('\n✅ Backend API test successful!');
      return true;
    } else {
      console.log('\n❌ Backend API test failed!');
      return false;
    }
  } catch (error) {
    console.error(`Error testing backend API: ${error.message}`);
    return false;
  }
}

// Main function
async function main() {
  console.log('=== Fyers API Test ===');
  console.log(`Using App ID: ${APP_ID}`);
  
  // Ask for access token
  console.log('\nPlease provide your access token when running this script:');
  console.log('node test-fyers-api.js YOUR_ACCESS_TOKEN');
  
  // Get access token from command line argument
  const accessToken = process.argv[2];
  
  if (!accessToken) {
    console.error('\n❌ No access token provided!');
    console.log('Usage: node test-fyers-api.js YOUR_ACCESS_TOKEN');
    return;
  }
  
  // Test direct Fyers API
  const directApiSuccess = await testFyersApi(accessToken);
  
  // Test backend API
  const backendApiSuccess = await testBackendApi(accessToken);
  
  // Summary
  console.log('\n=== Test Summary ===');
  console.log(`Direct Fyers API: ${directApiSuccess ? '✅ Working' : '❌ Not Working'}`);
  console.log(`Backend API: ${backendApiSuccess ? '✅ Working' : '❌ Not Working'}`);
  
  if (!directApiSuccess) {
    console.log('\nRecommendation: Your access token may be invalid or expired.');
    console.log('Get a new access token and try again.');
  } else if (!backendApiSuccess) {
    console.log('\nRecommendation: The backend API is not working correctly.');
    console.log('Check the server logs for error messages.');
    console.log('Verify that the server is correctly forwarding the token to Fyers.');
  }
}

main().catch(error => {
  console.error(`Unhandled error: ${error.message}`);
}); 