const axios = require('axios');
const config = require('./config');

/**
 * Fetch market data for a given symbol
 */
async function fetchMarketData(symbol, accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }

    const appId = accessToken.split(':')[0];

    console.log(`📊 Fetching market data for ${symbol}`);

    try {
      // Use the enhanced quotes API endpoint
      const response = await axios.get(`https://api-t1.fyers.in/data-rest/v2/quotes?symbols=${symbol}`, {
        headers: {
          'Authorization': accessToken
        }
      });

      if (response.data.s !== 'ok' || !response.data.d || !response.data.d.length) {
        console.warn(`Market data API warning for ${symbol}: ${response.data.message || 'Unknown error'}`);
        return getMockMarketData(symbol);
      }

      const quote = response.data.d[0];
      if (quote.s !== 'ok' || !quote.v) {
        console.warn(`Invalid quote data for ${symbol}`);
        return getMockMarketData(symbol);
      }

      return {
        symbol: quote.n, // Use `n` for symbol name
        ltp: quote.v.lp || 0,
        open: quote.v.open_price || 0,
        high: quote.v.high_price || 0,
        low: quote.v.low_price || 0,
        close: quote.v.prev_close_price || 0,
        volume: quote.v.volume || 0,
        change: quote.v.ch || 0,
        changePercent: quote.v.chp || 0,
        timestamp: new Date((quote.v.tt || Date.now() / 1000) * 1000) // Use fyers timestamp
      };
    } catch (error) {
      console.error(`Error fetching market data for ${symbol}:`, error.message);
      return getMockMarketData(symbol);
    }
  } catch (error) {
    console.error('❌ Error in fetchMarketData:', error);
    return getMockMarketData(symbol);
  }
}

/**
 * Fetch market data for multiple symbols
 */
async function fetchMultipleMarketData(symbols, accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }

    if (!symbols || !symbols.length) {
      return new Map();
    }

    const appId = accessToken.split(':')[0];
    
    // Join symbols with comma for the API call
    const symbolsParam = Array.isArray(symbols) ? symbols.join(',') : symbols;
    console.log(`📊 Fetching market data for multiple symbols: ${symbolsParam}`);

    try {
      const response = await axios.get(`https://api-t1.fyers.in/data-rest/v2/quotes?symbols=${symbolsParam}`, {
        headers: {
          'Authorization': accessToken
        }
      });

      if (response.data.s !== 'ok' || !response.data.d) {
        console.warn(`Market data API warning for multiple symbols: ${response.data.message || 'Unknown error'}`);
        return getMockMultipleMarketData(symbols);
      }

      const results = new Map();

      response.data.d.forEach((quote) => {
        if (quote.s === 'ok' && quote.v) {
          const marketData = {
            symbol: quote.n, // Use 'n' for symbol name
            ltp: quote.v.lp || 0,
            open: quote.v.open_price || 0,
            high: quote.v.high_price || 0,
            low: quote.v.low_price || 0,
            close: quote.v.prev_close_price || 0,
            volume: quote.v.volume || 0,
            change: quote.v.ch || 0,
            changePercent: quote.v.chp || 0,
            timestamp: new Date((quote.v.tt || Date.now() / 1000) * 1000) // Use fyers timestamp
          };
          results.set(quote.n, marketData);
        } else {
          console.log(`❌ Invalid quote data for ${quote.n}:`, quote.v);
          // Add mock data for this symbol
          const mockData = getMockMarketData(quote.n);
          results.set(quote.n, mockData);
        }
      });

      return results;
    } catch (error) {
      console.error(`Error fetching multiple market data: ${error.message}`);
      return getMockMultipleMarketData(symbols);
    }
  } catch (error) {
    console.error('❌ Error in fetchMultipleMarketData:', error);
    return getMockMultipleMarketData(symbols);
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

    const appId = accessToken.split(':')[0];

    console.log(`📊 Fetching market depth for ${symbol}`);

    try {
      const response = await axios.get(`https://api-t1.fyers.in/data-rest/v2/depth?symbol=${symbol}`, {
        headers: {
          'Authorization': accessToken
        }
      });

      if (response.data.s !== 'ok' || !response.data.d) {
        console.warn(`Market depth API warning for ${symbol}: ${response.data.message || 'Unknown error'}`);
        return getMockMarketDepth(symbol);
      }

      return response.data.d;
    } catch (error) {
      console.error(`Error fetching market depth for ${symbol}:`, error.message);
      return getMockMarketDepth(symbol);
    }
  } catch (error) {
    console.error('❌ Error in getMarketDepth:', error);
    return getMockMarketDepth(symbol);
  }
}

/**
 * Get mock market data for a symbol when market is closed or API fails
 */
function getMockMarketData(symbol) {
  console.log(`📊 Providing mock data for ${symbol} (market closed or API error)`);
  
  // Generate some realistic looking mock data based on the symbol
  const basePrice = symbol.includes('NIFTY') ? 22000 : (symbol.includes('BANK') ? 48000 : 72000);
  const randomFactor = 1 + (Math.random() * 0.1 - 0.05); // +/- 5%
  const price = basePrice * randomFactor;
  
  return {
    symbol: symbol,
    ltp: price,
    open: price * 0.995,
    high: price * 1.01,
    low: price * 0.99,
    close: price * 0.998,
    volume: Math.floor(Math.random() * 1000000),
    change: price * 0.002,
    changePercent: 0.2,
    timestamp: new Date(),
    isMockData: true
  };
}

/**
 * Get mock market data for multiple symbols
 */
function getMockMultipleMarketData(symbols) {
  console.log(`📊 Providing mock data for multiple symbols (market closed or API error)`);
  
  const results = new Map();
  
  if (Array.isArray(symbols)) {
    symbols.forEach(symbol => {
      results.set(symbol, getMockMarketData(symbol));
    });
  } else if (typeof symbols === 'string') {
    const symbolsArray = symbols.split(',');
    symbolsArray.forEach(symbol => {
      results.set(symbol, getMockMarketData(symbol));
    });
  }
  
  return results;
}

/**
 * Get mock market depth data
 */
function getMockMarketDepth(symbol) {
  console.log(`📊 Providing mock market depth for ${symbol} (market closed or API error)`);
  
  // Generate some realistic looking mock depth data
  const basePrice = symbol.includes('NIFTY') ? 22000 : (symbol.includes('BANK') ? 48000 : 72000);
  
  return {
    symbol: symbol,
    bids: [
      { price: basePrice * 0.998, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 0.997, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 0.996, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 0.995, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 0.994, qty: Math.floor(Math.random() * 100) }
    ],
    asks: [
      { price: basePrice * 1.001, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 1.002, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 1.003, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 1.004, qty: Math.floor(Math.random() * 100) },
      { price: basePrice * 1.005, qty: Math.floor(Math.random() * 100) }
    ],
    timestamp: new Date(),
    isMockData: true
  };
}

/**
 * Get index symbols for market data
 */
function getIndexSymbols() {
  return [
    'NSE:NIFTY50-INDEX',
    'NSE:NIFTYBANK-INDEX',
    'BSE:SENSEX-INDEX'
  ];
}

module.exports = {
  fetchMarketData,
  fetchMultipleMarketData,
  getMarketDepth,
  getIndexSymbols
}; 