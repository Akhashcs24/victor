// Backend MarketDataService for Victor
// Handles fetching historical data from Fyers API
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class MarketDataService {
  static async getHistoricalData({ symbol, resolution, rangeFrom, rangeTo, accessToken }) {
    try {
      // Extract appId from accessToken (format is "appId:token")
      const [appId, token] = accessToken.split(':');
      
      if (!appId || !token) {
        throw new Error('Invalid access token format - expected appId:token');
      }
      
      // Format dates if they are timestamps
      let formattedRangeFrom = rangeFrom;
      let formattedRangeTo = rangeTo;
      
      // If rangeFrom and rangeTo are numbers (timestamps), convert to YYYY-MM-DD format
      if (typeof rangeFrom === 'number' && !isNaN(rangeFrom)) {
        formattedRangeFrom = MarketDataService.formatDate(new Date(rangeFrom * 1000));
      }
      
      if (typeof rangeTo === 'number' && !isNaN(rangeTo)) {
        formattedRangeTo = MarketDataService.formatDate(new Date(rangeTo * 1000));
      }
      
      // Build Fyers API URL
      const params = new URLSearchParams({
        symbol,
        resolution,
        date_format: '1',
        cont_flag: '1',
      });
      if (formattedRangeFrom) params.append('range_from', formattedRangeFrom);
      if (formattedRangeTo) params.append('range_to', formattedRangeTo);
      
      // Use the updated Fyers API v3 endpoint for historical data
      const url = `https://api-t1.fyers.in/data/history?${params.toString()}`;
      
      console.log(`📊 Fetching historical data for ${symbol} from ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': accessToken
        }
      });
      
      const data = await response.json();
      
      if (data.s !== 'ok') {
        throw new Error(`Historical data API error: ${data.message || 'Unknown error'}`);
      }
      
      return {
        symbol,
        resolution,
        candles: data.candles || [],
        timeFrom: formattedRangeFrom,
        timeTo: formattedRangeTo
      };
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      throw error;
    }
  }
  
  // Helper function to format date as YYYY-MM-DD
  static formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}

module.exports = MarketDataService; 