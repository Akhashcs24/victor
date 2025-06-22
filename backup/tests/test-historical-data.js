// Test script for historical data API
const axios = require('axios');
const fs = require('fs');

const API_URL = 'http://localhost:5000';
const TEST_SYMBOL = 'NSE:NIFTY25JUN24800CE'; // Option symbol to test
const RESOLUTION = '5'; // 5-minute candles
const FROM_DATE = '2024-06-17'; // Test with a specific date
const TO_DATE = '2024-06-18';
const APP_ID = 'MSEL25Z2K9-100'; // App ID

async function testHistoricalData() {
  try {
    console.log('🧪 Testing historical data API...');
    console.log(`📊 Symbol: ${TEST_SYMBOL}`);
    console.log(`📊 Resolution: ${RESOLUTION}`);
    console.log(`📊 Date range: ${FROM_DATE} to ${TO_DATE}`);
    
    // Read the access token from auth-code.txt
    let accessToken;
    try {
      accessToken = fs.readFileSync('auth-code.txt', 'utf8').trim();
      console.log(`🔑 Read access token from auth-code.txt: ${accessToken.substring(0, 20)}...`);
    } catch (error) {
      console.error('❌ Could not read access token from auth-code.txt:', error.message);
      return;
    }
    
    // Format the token as appId:accessToken
    const formattedToken = `${APP_ID}:${accessToken}`;
    console.log(`🔑 Using formatted token: ${formattedToken.substring(0, 20)}...`);
    
    // Make the API request
    const params = new URLSearchParams({
      symbol: TEST_SYMBOL,
      resolution: RESOLUTION,
      from: FROM_DATE,
      to: TO_DATE
    });
    
    const url = `${API_URL}/api/market-data/historical?${params.toString()}`;
    console.log(`🔗 API URL: ${url}`);
    
    const response = await axios.get(url, {
      headers: {
        'Authorization': formattedToken
      }
    });
    
    console.log(`📥 Response status: ${response.status}`);
    
    if (response.data.success) {
      const candles = response.data.candles || [];
      console.log(`✅ Successfully fetched ${candles.length} candles`);
      
      if (candles.length > 0) {
        console.log('\n📊 Sample candles:');
        candles.slice(0, 3).forEach((candle, index) => {
          const date = new Date(candle[0] * 1000);
          console.log(`Candle ${index + 1}: ${date.toLocaleString()} - Open: ${candle[1]}, Close: ${candle[4]}`);
        });
      } else {
        console.log('⚠️ No candles returned for the specified date range');
      }
    } else {
      console.error('❌ API returned an error:', response.data.error);
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
  }
}

// Run the test
testHistoricalData(); 