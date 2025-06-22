// Test script to directly test the Fyers API historical data endpoint
const axios = require('axios');
const fs = require('fs');

// Configuration
const config = {
  appId: 'MSEL25Z2K9-100',
  symbol: 'NSE:NIFTY25JUN24800CE',
  resolution: '5', // 5-minute candles
  date_format: '1',
  cont_flag: '1',
  range_from: '2024-06-17',
  range_to: '2024-06-18'
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

// Test direct Fyers API call
const testDirectFyersCall = async () => {
  try {
    console.log('Testing direct Fyers API call for historical data...');
    console.log(`📊 Symbol: ${config.symbol}`);
    console.log(`📊 Resolution: ${config.resolution}`);
    console.log(`📅 Time range: ${config.range_from} to ${config.range_to}`);
    
    // Build Fyers API URL
    const params = new URLSearchParams({
      symbol: config.symbol,
      resolution: config.resolution,
      date_format: config.date_format,
      cont_flag: config.cont_flag,
      range_from: config.range_from,
      range_to: config.range_to
    });
    
    // Try both API endpoints
    const endpoints = [
      'https://api-t1.fyers.in/data/history',
      'https://api.fyers.in/data-rest/v2/history'
    ];
    
    // Try with both token formats
    const tokenFormats = [
      `${config.appId}:${accessToken}`, // Format 1: appId:token
      accessToken // Format 2: just token
    ];
    
    for (const endpoint of endpoints) {
      console.log(`\n🔍 Testing endpoint: ${endpoint}`);
      const url = `${endpoint}?${params.toString()}`;
      console.log(`🔗 URL: ${url}`);
      
      for (const token of tokenFormats) {
        try {
          console.log(`\n🔍 Trying with token format: ${token.substring(0, 20)}...`);
          
          const response = await axios.get(url, {
            headers: {
              'Authorization': token
            }
          });
          
          console.log('✅ API call successful');
          console.log(`📊 Response status: ${response.status}`);
          console.log(`📊 Response data:`, response.data);
          
          if (response.data.s === 'ok' && response.data.candles) {
            console.log(`📊 Received ${response.data.candles.length} candles`);
            
            if (response.data.candles.length > 0) {
              const firstCandle = response.data.candles[0];
              const date = new Date(firstCandle[0] * 1000);
              console.log(`📊 First candle: ${date.toLocaleString()} - Open: ${firstCandle[1]}, Close: ${firstCandle[4]}`);
            }
          } else if (response.data.s === 'no_data') {
            console.log('⚠️ No data available for the specified parameters');
          } else {
            console.log('⚠️ Unexpected response format:', response.data);
          }
          
          console.log('\n✅ This combination works! Use these settings in your app.');
          return;
        } catch (error) {
          console.error(`❌ Error with token format "${token.substring(0, 10)}..." at ${endpoint}:`, 
            error.response?.data || error.message);
        }
      }
    }
    
    console.error('❌ All API endpoint and token format combinations failed');
  } catch (error) {
    console.error('❌ Error testing direct Fyers API call:', error.message);
  }
};

// Run the test
testDirectFyersCall(); 