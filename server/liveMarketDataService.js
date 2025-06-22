const axios = require('axios');
const config = require('./config');

// Valid index symbols that are always allowed
const VALID_INDEX_SYMBOLS = [
  'NSE:NIFTY50-INDEX',
  'NSE:NIFTYBANK-INDEX',
  'BSE:SENSEX-INDEX'
];

// Symbol validation regex
const VALID_SYMBOL_REGEX = {
  INDEX: /^(NSE|BSE):[A-Z0-9]+-INDEX$/,
  OPTION: /^(NSE|BSE):[A-Z0-9]+[0-9]{2}[A-Z]{3}[0-9]{2}[0-9]+(?:CE|PE)$/
};

/**
 * Validate if a symbol is properly formatted
 */
function isValidSymbol(symbol) {
  if (VALID_INDEX_SYMBOLS.includes(symbol)) {
    return true;
  }
  
  return Object.values(VALID_SYMBOL_REGEX).some(regex => regex.test(symbol));
}

/**
 * Fetch market data for a given symbol
 */
async function fetchMarketData(symbol, accessToken) {
  try {
    if (!isValidSymbol(symbol)) {
      throw new Error(`Invalid symbol format: ${symbol}`);
    }
    
    console.log(`📊 Fetching market data for ${symbol}`);
    
    // Use the updated Fyers API v3 endpoint for quotes
    const response = await axios.get('https://api-t1.fyers.in/data/quotes', {
      params: {
        symbols: symbol
      },
      headers: {
        'Authorization': accessToken
      }
    });
    
    if (response.data && response.data.s === 'ok' && response.data.d) {
      // Process the response data to match our expected format
      // The API returns an array in the 'd' property
      const quoteData = response.data.d[0];
      
      if (!quoteData || !quoteData.v) {
        console.warn(`No quote data found for ${symbol}`);
        return {
          symbol: symbol,
          ltp: 0,
          open: 0,
          high: 0,
          low: 0,
          close: 0,
          volume: 0,
          change: 0,
          changePercent: 0,
          timestamp: new Date()
        };
      }
      
      return {
        symbol: quoteData.n || symbol,
        ltp: quoteData.v.lp || 0,
        open: quoteData.v.open_price || 0,
        high: quoteData.v.high_price || 0,
        low: quoteData.v.low_price || 0,
        close: quoteData.v.prev_close_price || 0,
        volume: quoteData.v.volume || 0,
        change: quoteData.v.ch || 0,
        changePercent: quoteData.v.chp || 0,
        timestamp: new Date((quoteData.v.tt || Date.now() / 1000) * 1000)
      };
    } else {
      throw new Error(response.data?.message || 'Failed to fetch market data');
    }
  } catch (error) {
    console.error(`Error fetching market data for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Fetch market data for multiple symbols
 */
async function fetchMultipleMarketData(symbols, accessToken) {
  try {
    // Validate all symbols
    const invalidSymbols = symbols.filter(symbol => !isValidSymbol(symbol));
    if (invalidSymbols.length > 0) {
      throw new Error(`Invalid symbol format for: ${invalidSymbols.join(', ')}`);
    }
    
    console.log(`📊 Fetching market data for ${symbols.length} symbols`);
    
    // Use the updated Fyers API v3 endpoint for quotes
    const response = await axios.get('https://api-t1.fyers.in/data/quotes', {
      params: {
        symbols: symbols.join(',')
      },
      headers: {
        'Authorization': accessToken
      }
    });
    
    if (response.data && response.data.s === 'ok' && response.data.d) {
      // Process the response data to match our expected format
      // The API returns an array in the 'd' property
      const result = [];
      
      // Create a map for quick lookup
      const quoteMap = {};
      response.data.d.forEach(quote => {
        if (quote && quote.v) {
          quoteMap[quote.n] = quote;
        }
      });
      
      // Process each symbol in the original order
      for (const symbol of symbols) {
        const quote = quoteMap[symbol];
        
        if (quote && quote.v) {
          result.push({
            symbol: quote.n || symbol,
            ltp: quote.v.lp || 0,
            open: quote.v.open_price || 0,
            high: quote.v.high_price || 0,
            low: quote.v.low_price || 0,
            close: quote.v.prev_close_price || 0,
            volume: quote.v.volume || 0,
            change: quote.v.ch || 0,
            changePercent: quote.v.chp || 0,
            timestamp: new Date((quote.v.tt || Date.now() / 1000) * 1000)
          });
        } else {
          console.warn(`No quote data found for ${symbol}`);
          result.push({
            symbol: symbol,
            ltp: 0,
            open: 0,
            high: 0,
            low: 0,
            close: 0,
            volume: 0,
            change: 0,
            changePercent: 0,
            timestamp: new Date()
          });
        }
      }
      
      return result;
    } else {
      throw new Error(response.data?.message || 'Failed to fetch market data');
    }
  } catch (error) {
    console.error(`Error fetching market data for multiple symbols:`, error.message);
    throw error;
  }
}

/**
 * Get market depth for a symbol
 */
async function getMarketDepth(symbol, accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }
    
    // Validate symbol format
    if (!isValidSymbol(symbol)) {
      console.warn(`⚠️ Invalid symbol format: ${symbol}`);
      throw new Error(`Invalid symbol format: ${symbol}`);
    }
    
    console.log(`📊 Fetching market depth for ${symbol}`);

    // Extract appId from accessToken (format is "appId:token")
    const [appId, token] = accessToken.split(':');
    
    if (!appId || !token) {
      throw new Error('Invalid access token format - expected appId:token');
    }

    const response = await axios.get(`https://api-t1.fyers.in/data-rest/v2/depth?symbol=${symbol}`, {
      headers: {
        'Authorization': `${appId}:${token}`
      }
    });

    if (response.data.s !== 'ok' || !response.data.d) {
      throw new Error(`Market depth API error: ${response.data.message || 'Unknown error'}`);
    }

    return response.data.d;
  } catch (error) {
    console.error(`❌ Error fetching market depth for ${symbol}:`, error.message);
    throw error;
  }
}

/**
 * Get index symbols for market data
 */
function getIndexSymbols() {
  return VALID_INDEX_SYMBOLS;
}

module.exports = {
  fetchMarketData,
  fetchMultipleMarketData,
  getMarketDepth,
  getIndexSymbols,
  isValidSymbol,
  VALID_INDEX_SYMBOLS
};
