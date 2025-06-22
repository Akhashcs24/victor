const fs = require('fs');
const fetch = require('node-fetch');

// Configuration
const TEST_SYMBOL = 'NSE:NIFTY50-INDEX';

// Main function
async function main() {
  try {
    console.log('=== Direct Fyers API Test ===');
    
    // Get access token from localStorage.json
    if (!fs.existsSync('localStorage.json')) {
      console.error('❌ localStorage.json not found. Please run generate-token.js first.');
      return;
    }
    
    const data = JSON.parse(fs.readFileSync('localStorage.json', 'utf8'));
    if (!data.access_token) {
      console.error('❌ No access token found in localStorage.json');
      return;
    }
    
    const accessToken = data.access_token;
    console.log(`✅ Using access token: ${accessToken.substring(0, 15)}...`);
    
    // Test quotes endpoint
    console.log(`\n📊 Testing quotes endpoint for ${TEST_SYMBOL}...`);
    const quotesResponse = await fetch(`https://api-t1.fyers.in/data-rest/v2/quotes?symbols=${TEST_SYMBOL}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    console.log(`📊 Response status: ${quotesResponse.status}`);
    const quotesData = await quotesResponse.json();
    
    console.log('📊 Response data:');
    console.log(JSON.stringify(quotesData, null, 2));
    
    // Check if the response is valid
    if (quotesData.s === 'ok' && quotesData.d && quotesData.d.length > 0) {
      console.log('\n✅ Direct Fyers API test successful!');
      
      // Extract the actual market data
      const quote = quotesData.d[0];
      if (quote.s === 'ok' && quote.v) {
        console.log('\n📊 Market data:');
        console.log(`Symbol: ${quote.n}`);
        console.log(`LTP: ${quote.v.lp}`);
        console.log(`Open: ${quote.v.open_price}`);
        console.log(`High: ${quote.v.high_price}`);
        console.log(`Low: ${quote.v.low_price}`);
        console.log(`Previous Close: ${quote.v.prev_close_price}`);
        console.log(`Volume: ${quote.v.volume}`);
        console.log(`Change: ${quote.v.ch} (${quote.v.chp}%)`);
      }
    } else {
      console.log('\n❌ Direct Fyers API test failed!');
      
      // Check for specific error codes
      if (quotesData.code === 401 || quotesData.message?.includes('token')) {
        console.log('❌ Authentication error - your token may be expired or invalid');
        console.log('👉 Please run generate-auth-code.js and generate-token.js again');
      } else if (quotesData.code === 429) {
        console.log('❌ Rate limit exceeded - too many requests');
        console.log('👉 Please wait a few minutes and try again');
      } else {
        console.log(`❌ Error code: ${quotesData.code}`);
        console.log(`❌ Error message: ${quotesData.message}`);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

main(); 