const fetch = require('node-fetch');

// Configuration
const API_URL = 'http://localhost:5000';
const TEST_SYMBOL = 'NSE:NIFTY50-INDEX';

// Main function
async function main() {
  console.log('=== Backend API Test ===');
  console.log(`Test Symbol: ${TEST_SYMBOL}`);
  
  // Get access token from command line argument
  const accessToken = process.argv[2];
  
  if (!accessToken) {
    console.error('\n❌ No access token provided!');
    console.log('Usage: node test-backend-cli.js YOUR_ACCESS_TOKEN');
    return;
  }
  
  console.log(`Using access token: ${accessToken.substring(0, 10)}...`);
  
  try {
    // First check if the server is running
    try {
      const healthResponse = await fetch(`${API_URL}/api/health`);
      const healthData = await healthResponse.json();
      console.log(`\nServer health check: ${JSON.stringify(healthData)}`);
    } catch (error) {
      console.error(`\n❌ Server health check failed: ${error.message}`);
      console.error('Make sure the server is running at ' + API_URL);
      return;
    }
    
    console.log('\n=== Testing Backend API ===');
    console.log(`Fetching data for ${TEST_SYMBOL}...`);
    
    const response = await fetch(`${API_URL}/api/market-data/quotes?symbols=${TEST_SYMBOL}`, {
      headers: {
        'Authorization': accessToken
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success && data.data && data.data.length > 0) {
      console.log('\n✅ Backend API test successful!');
      
      // Extract and display the market data
      const quote = data.data[0];
      console.log('\nMarket data:');
      console.log(`Symbol: ${quote.symbol}`);
      console.log(`LTP: ${quote.ltp}`);
      console.log(`Open: ${quote.open}`);
      console.log(`High: ${quote.high}`);
      console.log(`Low: ${quote.low}`);
      console.log(`Close: ${quote.close}`);
      console.log(`Volume: ${quote.volume}`);
      console.log(`Change: ${quote.change} (${quote.changePercent}%)`);
    } else {
      console.log('\n❌ Backend API test failed!');
      
      if (response.status === 401) {
        console.log('Authentication error - token may be expired or invalid');
      } else if (response.status === 429) {
        console.log('Rate limit exceeded - too many requests');
      } else if (data.error) {
        console.log(`Error message: ${data.error}`);
      }
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

main(); 