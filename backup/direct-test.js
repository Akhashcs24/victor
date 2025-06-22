const fetch = require('node-fetch');
const readline = require('readline');

// Configuration
const APP_ID = 'MSEL25Z2K9-100';
const TEST_SYMBOL = 'NSE:NIFTY50-INDEX';

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Main function
async function main() {
  console.log('=== Direct Fyers API Test ===');
  console.log(`App ID: ${APP_ID}`);
  console.log(`Test Symbol: ${TEST_SYMBOL}`);
  
  // Get access token from command line
  console.log('\nPlease enter your access token:');
  rl.question('> ', async (accessToken) => {
    if (!accessToken || accessToken.trim() === '') {
      console.log('❌ No access token provided. Exiting.');
      rl.close();
      return;
    }
    
    try {
      console.log('\n=== Testing Direct Fyers API ===');
      console.log(`Fetching data for ${TEST_SYMBOL}...`);
      
      const response = await fetch(`https://api-t1.fyers.in/data-rest/v2/quotes?symbols=${TEST_SYMBOL}`, {
        headers: {
          'Authorization': accessToken.trim()
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
      } else {
        console.log('\n❌ Fyers API test failed!');
        
        if (data.code === 401) {
          console.log('Authentication error - token may be expired or invalid');
        } else if (data.code === 429) {
          console.log('Rate limit exceeded - too many requests');
        }
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
    } finally {
      rl.close();
    }
  });
}

main(); 