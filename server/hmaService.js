const axios = require('axios');
const config = require('./config');

// Cache for storing candles per option symbol
const candleCache = new Map();

// HMA constants
const HMA_PERIOD = 55;
const REQUIRED_CANDLES = 60; // 300 market minutes = 60 x 5-min candles
const TRADING_START_HOUR = 9;
const TRADING_START_MINUTE = 15;
const TRADING_END_HOUR = 15;
const TRADING_END_MINUTE = 30;
const MARKET_START_MINUTES = 555; // 9:15 AM
const MARKET_END_MINUTES = 930; // 3:30 PM

/**
 * Format date for API
 */
function formatDateForAPI(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Calculate HMA from candles array using Pine Script logic
 */
function calculateHMAFromCandles(candles) {
  if (candles.length < HMA_PERIOD) {
    throw new Error(`Insufficient data. Need at least ${HMA_PERIOD} candles for HMA-${HMA_PERIOD}`);
  }

  const hmaData = candles.map(candle => ({
    timestamp: candle.timestamp,
    close: candle.close,
    hma: 0 // Will be calculated
  }));

  // Calculate HMA for each point starting from period-1
  for (let i = HMA_PERIOD - 1; i < hmaData.length; i++) {
    hmaData[i].hma = calculateHMAForPoint(hmaData, i, HMA_PERIOD);
  }

  const currentHMA = hmaData[hmaData.length - 1]?.hma || 0;

  return {
    period: HMA_PERIOD,
    data: hmaData,
    currentHMA,
    lastUpdate: new Date()
  };
}

/**
 * Calculate HMA for a specific point using Pine Script logic
 */
function calculateHMAForPoint(data, index, period) {
  if (index < period - 1) return 0;
  
  const halfPeriod = Math.floor(period / 2);
  const sqrtPeriod = Math.floor(Math.sqrt(period));
  
  // Calculate WMA with period/2
  let wma1 = 0;
  let weightSum1 = 0;
  
  for (let i = 0; i < halfPeriod; i++) {
    const weight = halfPeriod - i;
    wma1 += data[index - i].close * weight;
    weightSum1 += weight;
  }
  
  wma1 = wma1 / weightSum1;
  
  // Calculate WMA with period
  let wma2 = 0;
  let weightSum2 = 0;
  
  for (let i = 0; i < period; i++) {
    const weight = period - i;
    wma2 += data[index - i].close * weight;
    weightSum2 += weight;
  }
  
  wma2 = wma2 / weightSum2;
  
  // Calculate raw HMA value: 2 * WMA(n/2) - WMA(n)
  const rawHma = 2 * wma1 - wma2;
  
  // Apply final WMA with sqrt(n) to raw values
  if (index < period + sqrtPeriod - 2) return rawHma;
  
  let finalHma = 0;
  let weightSum3 = 0;
  
  for (let i = 0; i < sqrtPeriod; i++) {
    const pos = index - i;
    const rawPos = pos - (period - 1);
    if (rawPos < 0) continue;
    
    const rawValue = 2 * calculateWMA(data, pos, halfPeriod) - calculateWMA(data, pos, period);
    const weight = sqrtPeriod - i;
    
    finalHma += rawValue * weight;
    weightSum3 += weight;
  }
  
  return finalHma / weightSum3;
}

/**
 * Calculate WMA (Weighted Moving Average)
 */
function calculateWMA(data, index, period) {
  if (index < period - 1) return 0;
  
  let wma = 0;
  let weightSum = 0;
  
  for (let i = 0; i < period; i++) {
    const weight = period - i;
    wma += data[index - i].close * weight;
    weightSum += weight;
  }
  
  return wma / weightSum;
}

/**
 * Convert historical data to candles and filter for trading hours
 */
function convertAndFilterTradingHoursCandles(historicalData) {
  return historicalData
    .map(candle => {
      // Convert to our candle format
      const timestamp = candle[0];
      const date = new Date(timestamp * 1000);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      
      return {
        timestamp,
        date,
        totalMinutes,
        open: candle[1],
        high: candle[2],
        low: candle[3],
        close: candle[4],
        volume: candle[5]
      };
    })
    .filter(candle => {
      // Filter for trading hours (9:15 AM to 3:30 PM)
      return candle.totalMinutes >= MARKET_START_MINUTES && 
             candle.totalMinutes <= MARKET_END_MINUTES;
    });
}

/**
 * Fetch historical data from Fyers API
 */
async function fetchHistoricalData(symbol, resolution, fromDate, toDate, accessToken) {
  try {
    if (!accessToken) {
      throw new Error('No valid authentication token found');
    }

    const params = {
      symbol,
      resolution,
      date_format: '1',
      range_from: fromDate,
      range_to: toDate,
      cont_flag: '1'
    };

    // Use the updated Fyers API v3 endpoint for historical data
    const url = `https://api-t1.fyers.in/data/history`;
    
    console.log(`📊 Fetching historical data for ${symbol} from ${url}`);
    
    const response = await axios.get(url, {
      params,
      headers: {
        'Authorization': accessToken
      }
    });

    if (response.data.s === 'ok' && response.data.candles) {
      return response.data.candles;
    } else if (response.data.s === 'no_data') {
      return [];
    } else {
      throw new Error(response.data.message || 'Failed to fetch historical data');
    }
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Main entry point: Fetch and calculate HMA
 */
async function fetchAndCalculateHMA(symbol, accessToken) {
  console.log(`🎯 Fetching HMA for symbol: ${symbol}`);
  
  try {
    // Check cache first
    const cached = candleCache.get(symbol);
    const now = new Date();
    
    if (cached && 
        cached.candles.length >= REQUIRED_CANDLES && 
        (now.getTime() - cached.lastUpdate.getTime()) < 5 * 60 * 1000) { // 5 minutes cache
      console.log(`📊 Using cached HMA data for ${symbol}`);
      return {
        currentHMA: cached.candles[cached.candles.length - 1].hma,
        data: cached.candles.map(c => ({ timestamp: c.timestamp, close: c.close, hma: c.hma })),
        period: HMA_PERIOD,
        lastUpdate: cached.lastUpdate
      };
    }
    
    // Calculate date range for fetching data (last trading day + today)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 2); // Get 2 days of data to ensure we have enough
    
    const fromDate = formatDateForAPI(startDate);
    const toDate = formatDateForAPI(endDate);
    
    console.log(`📅 Fetching data from ${fromDate} to ${toDate}`);
    
    // Fetch historical data
    const historicalData = await fetchHistoricalData(symbol, '5', fromDate, toDate, accessToken);
    
    if (!historicalData || historicalData.length === 0) {
      throw new Error(`No historical data available for ${symbol}`);
    }
    
    console.log(`📊 Fetched ${historicalData.length} candles for ${symbol}`);
    
    // Convert and filter candles for trading hours
    const candles = convertAndFilterTradingHoursCandles(historicalData);
    
    if (candles.length < REQUIRED_CANDLES) {
      throw new Error(`Insufficient data for HMA calculation. Need ${REQUIRED_CANDLES} candles, got ${candles.length}`);
    }
    
    // Calculate HMA
    const hmaConfig = calculateHMAFromCandles(candles);
    
    // Update cache with HMA values
    const candlesWithHMA = candles.map((candle, index) => ({
      ...candle,
      hma: index >= HMA_PERIOD - 1 ? hmaConfig.data[index].hma : null
    }));
    
    // Store in cache
    candleCache.set(symbol, {
      candles: candlesWithHMA,
      lastUpdate: new Date(),
      symbol,
      isLiveMonitoring: false
    });
    
    console.log(`✅ HMA calculation completed for ${symbol}: ${hmaConfig.currentHMA.toFixed(2)}`);
    
    return hmaConfig;
  } catch (error) {
    console.error(`❌ Error calculating HMA for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  const stats = [];
  
  for (const [symbol, cache] of candleCache.entries()) {
    stats.push({
      symbol,
      candleCount: cache.candles.length,
      lastUpdate: cache.lastUpdate
    });
  }
  
  return stats;
}

/**
 * Clear cache for a symbol
 */
function clearCache(symbol) {
  if (symbol) {
    candleCache.delete(symbol);
    console.log(`🧹 Cleared cache for ${symbol}`);
    return true;
  }
  return false;
}

module.exports = {
  fetchAndCalculateHMA,
  getCacheStats,
  clearCache
};
