const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvStringifier;
const authService = require('./authService');
const timestampService = require('./timestampService');
const symbolConfig = require('../config/symbolConfig');

class MarketDataService {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.ensureDataDirectory();
    this.credentials = null;
    this.intervalIds = {
      minuteData: null,
      fiveMinuteData: null
    };
    this.supportedIndices = ['NIFTY', 'NIFTYBANK', 'SENSEX'];
    this.supportedTimeframes = ['1min', '5min'];
    this.apiCallCount = 0;
    this.dailyLimit = 1000; // API limit per day
    this.lastApiCallTime = null;
    
    // Add request cache to prevent duplicate API calls
    this.requestCache = new Map();
    this.cacheTimeout = 60000; // 1 minute cache timeout
    
    console.log('📊 Market Data Service initialized');
  }

  ensureDataDirectory() {
    const directories = [
      this.dataDir,
      path.join(this.dataDir, 'cache'),
      path.join(this.dataDir, 'options')
    ];
    
    directories.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`📁 Created directory: ${dir}`);
      }
    });
  }

  // Set credentials for API calls
  setCredentials(appId, accessToken) {
    this.credentials = { appId, accessToken };
    console.log('📝 Market Data Service credentials set');
  }

  // Get credentials
  getCredentials() {
    return this.credentials;
  }

  // Start the service
  startService() {
    if (this.intervalIds.minuteData) {
      clearInterval(this.intervalIds.minuteData);
    }
    
    if (this.intervalIds.fiveMinuteData) {
      clearInterval(this.intervalIds.fiveMinuteData);
    }

    // Schedule 1-minute data collection (runs on 10th second of every minute)
    this.intervalIds.minuteData = setInterval(async () => {
      const now = new Date();
      if (now.getSeconds() === 10) {
        if (this.isMarketCurrentlyOpen()) {
          console.log('⏰ Running scheduled 1-minute data collection');
          for (const index of this.supportedIndices) {
            await this.collectCurrentIndexMinuteData(index, '1min');
          }
        }
      }
    }, 1000); // Check every second

    // Schedule 5-minute data collection (runs on 10th second of every 5th minute)
    this.intervalIds.fiveMinuteData = setInterval(async () => {
      const now = new Date();
      if (now.getSeconds() === 10 && now.getMinutes() % 5 === 0) {
        if (this.isMarketCurrentlyOpen()) {
          console.log('⏰ Running scheduled 5-minute data collection');
          for (const index of this.supportedIndices) {
            await this.collectCurrentIndexMinuteData(index, '5min');
          }
        }
      }
    }, 1000); // Check every second

    console.log('🚀 Market Data Service started');
  }

  // Stop the service
  cleanup() {
    if (this.intervalIds.minuteData) {
      clearInterval(this.intervalIds.minuteData);
      this.intervalIds.minuteData = null;
    }
    
    if (this.intervalIds.fiveMinuteData) {
      clearInterval(this.intervalIds.fiveMinuteData);
      this.intervalIds.fiveMinuteData = null;
    }
    
    console.log('🛑 Market Data Service stopped');
  }

  // Check if market is currently open
  isMarketCurrentlyOpen() {
    return timestampService.isMarketOpen();
  }

  // Get usage statistics
  getUsageStats() {
    return {
      dailyCallCount: this.apiCallCount,
      dailyLimit: this.dailyLimit,
      lastApiCall: this.lastApiCallTime
    };
  }

  // Reset API call counter (should be called daily)
  resetApiCallCounter() {
    this.apiCallCount = 0;
    console.log('🔄 API call counter reset');
  }

  // Collect current minute data for an index
  async collectCurrentIndexMinuteData(indexSymbol, timeframe = '1min') {
    try {
      if (!this.credentials) {
        console.log('⚠️ No credentials available for data collection');
        return { success: false, message: 'No credentials available' };
      }

      if (!this.isMarketCurrentlyOpen()) {
        console.log(`⚠️ Market is closed, skipping data collection for ${indexSymbol}`);
        return { success: false, message: 'Market is closed' };
      }

      console.log(`🔄 Collecting ${timeframe} data for ${indexSymbol}...`);

      // Get the current timestamp in IST
      const currentTimestamp = timestampService.getCurrentIST();
      
      // Fetch data from API
      const indexData = await this.fetchHistoricalMinuteData(
        indexSymbol, 
        'INDEX', 
        currentTimestamp, 
        timeframe
      );
      
      const futuresData = await this.fetchHistoricalMinuteData(
        indexSymbol, 
        'FUTURES', 
        currentTimestamp, 
        timeframe
      );

      if (!indexData.success || !futuresData.success) {
        console.log(`⚠️ Failed to fetch data for ${indexSymbol}`);
        return { success: false, message: 'Failed to fetch data' };
      }

      // Store the data
      await this.storeHistoricalData(indexSymbol, 'INDEX', indexData.data, timeframe);
      await this.storeHistoricalData(indexSymbol, 'FUTURES', futuresData.data, timeframe);

      console.log(`✅ Successfully collected and stored ${timeframe} data for ${indexSymbol}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error collecting ${timeframe} data for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Format date for API call
  formatDateForApi(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // The API is expecting YYYY-MM-DD format when date_format is 1
    return `${year}-${month}-${day}`;
  }

  // Add to request cache
  addToCache(key, data, expirationTime = null) {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now(),
      expirationTime: expirationTime || this.cacheTimeout
    });
  }

  // Get from request cache
  getFromCache(key) {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    
    // Check if cache is still valid
    const now = Date.now();
    const expirationTime = cached.expirationTime || this.cacheTimeout;
    
    if (now - cached.timestamp > expirationTime) {
      this.requestCache.delete(key);
      return null;
    }
    
    return cached;
  }

  // Fetch historical minute data from API with caching
  async fetchHistoricalMinuteData(indexSymbol, type, timestamp, timeframe = '1min') {
    try {
      if (!this.credentials) {
        return { success: false, message: 'No credentials available' };
      }

      const { appId, accessToken } = this.credentials;
      const fyers = authService.getFyersInstance(appId, accessToken);

      // Get the symbol based on type
      let symbol;
      if (type === 'INDEX') {
        symbol = this.getIndexSymbol(indexSymbol);
      } else if (type === 'FUTURES') {
        symbol = this.getFuturesSymbol(indexSymbol);
      } else {
        return { success: false, message: 'Invalid type' };
      }

      // Format date for API call
      const date = new Date(timestamp);
      const fromDate = this.formatDateForApi(date);
      
      // Create a cache key for this specific request
      const cacheKey = `${symbol}_${fromDate}_${timeframe}`;
      const cachedData = this.getFromCache(cacheKey);
      
      if (cachedData) {
        console.log(`📋 Using cached data for ${symbol} on ${fromDate} (${timeframe})`);
        return cachedData.data;
      }
      
      // For 1-minute data, we fetch just the last minute
      // For 5-minute data, we fetch the last 5 minutes
      const minutesToFetch = timeframe === '1min' ? 1 : 5;
      
      // Calculate toDate by adding the minutes
      const toDate = new Date(date);
      toDate.setMinutes(date.getMinutes() + minutesToFetch);
      const toDateStr = this.formatDateForApi(toDate);

      console.log(`📊 Fetching ${timeframe} data for ${symbol} from ${fromDate} to ${toDateStr}`);

      // Check rate limiter before making API call
      const rateLimiter = require('./rateLimiter');
      if (!rateLimiter.canMakeCall('historical')) {
        console.log(`⚠️ Rate limit reached for ${symbol}, skipping API call`);
        return { success: false, message: 'Rate limit reached' };
      }

      // Make API call
      this.apiCallCount++;
      this.lastApiCallTime = new Date();
      
      const resolution = timeframe === '1min' ? '1' : '5';
      
      const response = await fyers.getHistory({
        symbol: symbol,
        resolution: resolution,
        date_format: '1',
        range_from: fromDate,
        range_to: toDateStr,
        cont_flag: '1'
      });

      // Record the API call
      rateLimiter.recordCall('historical');

      if (response && response.s === 'ok' && response.candles && response.candles.length > 0) {
        console.log(`✅ Received ${response.candles.length} candles for ${symbol}`);
        
        // Process the candles
        const processedData = response.candles.map(candle => {
          const [timestamp, open, high, low, close, volume] = candle;
          
          return {
            timestamp: new Date(timestamp * 1000),
            open,
            high,
            low,
            close,
            volume,
            // Calculate HMA 55 here if needed
            hma55: this.calculateHMA(symbol, close, 55)
          };
        });
        
        const result = { success: true, data: processedData };
        
        // Store in cache
        this.addToCache(cacheKey, result);
        
        return result;
      } else {
        console.log(`⚠️ No data or error in response for ${symbol}:`, response);
        return { success: false, message: 'No data or error in response' };
      }
    } catch (error) {
      console.error(`❌ Error fetching historical data for ${indexSymbol} ${type}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Calculate Hull Moving Average (HMA)
  calculateHMA(symbol, close, period = 55) {
    try {
      // This is a simplified implementation of HMA
      // In a real implementation, we need historical data for the calculation
      // HMA = WMA(2*WMA(n/2) - WMA(n)), sqrt(n))
      
      // For now, we'll return null as we don't have access to historical data in this function
      // The proper implementation would require loading previous candles
      
      // Store the current close price with the symbol for future calculations
      const key = `${symbol}_close`;
      if (!this.closePrices) {
        this.closePrices = new Map();
      }
      
      if (!this.closePrices.has(key)) {
        this.closePrices.set(key, []);
      }
      
      const prices = this.closePrices.get(key);
      prices.push(close);
      
      // Keep only the required number of prices (period * 2 to have enough data)
      while (prices.length > period * 2) {
        prices.shift();
      }
      
      // If we don't have enough data yet, return null
      if (prices.length < period) {
        return null;
      }
      
      // Calculate HMA
      // Step 1: Calculate WMA with period/2
      const halfPeriod = Math.floor(period / 2);
      const wmaHalf = this.calculateWMA(prices, halfPeriod);
      
      // Step 2: Calculate WMA with full period
      const wmaFull = this.calculateWMA(prices, period);
      
      // Step 3: Calculate 2*WMA(n/2) - WMA(n)
      const diff = [];
      for (let i = 0; i < wmaHalf.length; i++) {
        diff.push(2 * wmaHalf[i] - wmaFull[i]);
      }
      
      // Step 4: Calculate WMA of diff with sqrt(period)
      const sqrtPeriod = Math.floor(Math.sqrt(period));
      const hma = this.calculateWMA(diff, sqrtPeriod);
      
      // Return the last value
      return hma.length > 0 ? hma[hma.length - 1] : null;
    } catch (error) {
      console.error(`Error calculating HMA for ${symbol}:`, error);
      return null;
    }
  }
  
  // Calculate Weighted Moving Average (WMA)
  calculateWMA(prices, period) {
    if (prices.length < period) {
      return [];
    }
    
    const result = [];
    const denominator = (period * (period + 1)) / 2;
    
    for (let i = period - 1; i < prices.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        // Weight is (period - j)
        sum += prices[i - j] * (period - j);
      }
      result.push(sum / denominator);
    }
    
    return result;
  }

  // Store historical data to CSV
  async storeHistoricalData(indexSymbol, type, data, timeframe) {
    try {
      if (!data || data.length === 0) {
        console.log(`⚠️ No data to store for ${indexSymbol} ${type}`);
        return { success: false, message: 'No data to store' };
      }

      const filepath = this.getDataFilePath(indexSymbol, type, timeframe);
      const fileExists = fs.existsSync(filepath);
      
      // Create header for new file
      const csvStringifier = createCsvWriter({
        header: [
          { id: 'timestamp', title: 'timestamp' },
          { id: 'open', title: 'open' },
          { id: 'high', title: 'high' },
          { id: 'low', title: 'low' },
          { id: 'close', title: 'close' },
          { id: 'volume', title: 'volume' },
          { id: 'hma55', title: 'hma55' }
        ]
      });

      // Format data for CSV
      const records = data.map(item => ({
        timestamp: timestampService.formatTimestampForStorage(item.timestamp),
        open: item.open,
        high: item.high,
        low: item.low,
        close: item.close,
        volume: item.volume,
        hma55: item.hma55 || ''
      }));

      // If file doesn't exist, create it with header
      if (!fileExists) {
        const csvHeader = csvStringifier.getHeaderString();
        fs.writeFileSync(filepath, csvHeader);
      }

      // Append data
      const csvRecords = csvStringifier.stringifyRecords(records);
      fs.appendFileSync(filepath, csvRecords);

      console.log(`✅ Stored ${data.length} records for ${indexSymbol} ${type} (${timeframe})`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error storing data for ${indexSymbol} ${type}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get data file path
  getDataFilePath(indexSymbol, type, timeframe) {
    return path.join(this.dataDir, `${indexSymbol}_${type}_${timeframe}.csv`);
  }

  // Get index symbol
  getIndexSymbol(indexSymbol) {
    const config = symbolConfig.getSymbolConfig(indexSymbol);
    return config.index;
  }

  // Get futures symbol
  getFuturesSymbol(indexSymbol) {
    const config = symbolConfig.getSymbolConfig(indexSymbol);
    return config.futures;
  }

  // Check for data gaps and fill them
  async validateAndEnsureHistoricalData(indexSymbol) {
    try {
      if (!this.credentials) {
        console.log('⚠️ No credentials available for data validation');
        return { success: false, message: 'No credentials available' };
      }

      console.log(`🔍 Validating historical data for ${indexSymbol}...`);

      // Get the last 3 market days
      const marketDays = this.getLastMarketDays(3);
      
      for (const day of marketDays) {
        for (const timeframe of this.supportedTimeframes) {
          // Check and fill gaps for INDEX data
          await this.checkAndFillDataGaps(indexSymbol, 'INDEX', day, timeframe);
          
          // Check and fill gaps for FUTURES data
          await this.checkAndFillDataGaps(indexSymbol, 'FUTURES', day, timeframe);
        }
      }

      console.log(`✅ Historical data validation completed for ${indexSymbol}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error validating historical data for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Check for data gaps and fill them
  async checkAndFillDataGaps(indexSymbol, type, date, timeframe) {
    try {
      const filepath = this.getDataFilePath(indexSymbol, type, timeframe);
      
      // If file doesn't exist, create it and fill with data for the entire day
      if (!fs.existsSync(filepath)) {
        console.log(`📁 Creating new file for ${indexSymbol} ${type} (${timeframe})`);
        await this.fetchAndStoreFullDayData(indexSymbol, type, date, timeframe);
        return { success: true };
      }

      // Read existing data
      const existingData = await this.readCSVFile(filepath);
      
      // Generate all expected timestamps for the day
      const expectedTimestamps = this.generateExpectedTimestamps(date, timeframe);
      
      // Find missing timestamps
      const existingTimestamps = new Set(existingData.map(row => row.timestamp));
      const missingTimestamps = expectedTimestamps.filter(ts => !existingTimestamps.has(ts));
      
      if (missingTimestamps.length === 0) {
        console.log(`✅ No data gaps for ${indexSymbol} ${type} (${timeframe}) on ${date.toISOString().split('T')[0]}`);
        return { success: true };
      }
      
      console.log(`🔍 Found ${missingTimestamps.length} data gaps for ${indexSymbol} ${type} (${timeframe})`);
      
      // Fetch and store missing data
      for (const timestamp of missingTimestamps) {
        await this.fetchAndStoreMissingData(indexSymbol, type, new Date(timestamp), timeframe);
      }
      
      return { success: true };
    } catch (error) {
      console.error(`❌ Error checking data gaps for ${indexSymbol} ${type}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Generate expected timestamps for a day
  generateExpectedTimestamps(date, timeframe) {
    const timestamps = [];
    const marketStart = timestampService.getMarketStartTimestamp(date);
    const marketEnd = timestampService.getMarketEndTimestamp(date);
    
    const interval = timeframe === '1min' ? 1 : 5;
    
    const current = new Date(marketStart);
    while (current <= marketEnd) {
      timestamps.push(timestampService.formatTimestampForStorage(current));
      current.setMinutes(current.getMinutes() + interval);
    }
    
    return timestamps;
  }

  // Fetch and store full day data
  async fetchAndStoreFullDayData(indexSymbol, type, date, timeframe) {
    try {
      if (!this.credentials) {
        return { success: false, message: 'No credentials available' };
      }

      const { appId, accessToken } = this.credentials;
      const fyers = authService.getFyersInstance(appId, accessToken);

      // Get the symbol based on type
      let symbol;
      if (type === 'INDEX') {
        symbol = this.getIndexSymbol(indexSymbol);
      } else if (type === 'FUTURES') {
        symbol = this.getFuturesSymbol(indexSymbol);
      } else {
        return { success: false, message: 'Invalid type' };
      }

      // Format date for API call
      const marketStart = timestampService.getMarketStartTimestamp(date);
      const marketEnd = timestampService.getMarketEndTimestamp(date);
      
      const fromDate = this.formatDateForApi(marketStart);
      const toDate = this.formatDateForApi(marketEnd);
      
      // Create a cache key for this specific request
      const cacheKey = `${symbol}_${fromDate}_${timeframe}_fullday`;
      const cachedData = this.getFromCache(cacheKey);
      
      if (cachedData) {
        console.log(`📋 Using cached full day data for ${symbol} on ${fromDate} (${timeframe})`);
        
        // Store the data from cache
        await this.storeHistoricalData(indexSymbol, type, cachedData.data.data, timeframe);
        return cachedData.data;
      }

      console.log(`📊 Fetching full day data for ${symbol} from ${fromDate} to ${toDate}`);

      // Check rate limiter before making API call
      const rateLimiter = require('./rateLimiter');
      if (!rateLimiter.canMakeCall('historical')) {
        console.log(`⚠️ Rate limit reached for ${symbol}, delaying API call`);
        
        // Wait for backoff time
        const backoffTime = rateLimiter.handleRateLimitError('historical');
        console.log(`⏱️ Waiting for ${backoffTime}ms before retrying`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Try again after waiting
        return this.fetchAndStoreFullDayData(indexSymbol, type, date, timeframe);
      }

      // Make API call
      this.apiCallCount++;
      this.lastApiCallTime = new Date();
      
      const resolution = timeframe === '1min' ? '1' : '5';
      
      const response = await fyers.getHistory({
        symbol: symbol,
        resolution: resolution,
        date_format: '1',
        range_from: fromDate,
        range_to: toDate,
        cont_flag: '1'
      });
      
      // Record the API call
      rateLimiter.recordCall('historical');

      if (response && response.s === 'ok' && response.candles && response.candles.length > 0) {
        console.log(`✅ Received ${response.candles.length} candles for ${symbol}`);
        
        // Process the candles
        const processedData = response.candles.map(candle => {
          const [timestamp, open, high, low, close, volume] = candle;
          
          return {
            timestamp: new Date(timestamp * 1000),
            open,
            high,
            low,
            close,
            volume,
            // Calculate HMA 55 here if needed
            hma55: this.calculateHMA(symbol, close, 55)
          };
        });
        
        // Store the data
        await this.storeHistoricalData(indexSymbol, type, processedData, timeframe);
        
        // Store in cache with longer expiration (1 hour)
        this.addToCache(cacheKey, { success: true, data: processedData }, 3600000);
        
        return { success: true };
      } else if (response && response.s === 'error' && response.code === 429) {
        // Handle rate limiting
        console.log(`⚠️ Rate limit reached for ${symbol}, will retry after backoff`);
        rateLimiter.handleRateLimitError('historical');
        
        // Wait for backoff time
        const backoffTime = 5000; // 5 seconds minimum
        console.log(`⏱️ Waiting for ${backoffTime}ms before retrying`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Try again after waiting
        return this.fetchAndStoreFullDayData(indexSymbol, type, date, timeframe);
      } else {
        console.log(`⚠️ No data or error in response for ${symbol}:`, response);
        return { success: false, message: 'No data or error in response' };
      }
    } catch (error) {
      console.error(`❌ Error fetching full day data for ${indexSymbol} ${type}:`, error);
      
      // Check if this is a rate limit error
      if (error.message && (error.message.includes('rate limit') || error.message.includes('429'))) {
        console.log(`⚠️ Rate limit error detected, will retry after backoff`);
        const rateLimiter = require('./rateLimiter');
        rateLimiter.handleRateLimitError('historical');
        
        // Wait for backoff time
        const backoffTime = 5000; // 5 seconds minimum
        console.log(`⏱️ Waiting for ${backoffTime}ms before retrying`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Try again after waiting
        return this.fetchAndStoreFullDayData(indexSymbol, type, date, timeframe);
      }
      
      return { success: false, error: error.message };
    }
  }

  // Fetch and store missing data
  async fetchAndStoreMissingData(indexSymbol, type, timestamp, timeframe) {
    try {
      if (!this.credentials) {
        return { success: false, message: 'No credentials available' };
      }

      console.log(`🔄 Fetching missing data for ${indexSymbol} ${type} at ${timestamp}`);
      
      // Create a cache key for this specific request
      const symbol = type === 'INDEX' ? this.getIndexSymbol(indexSymbol) : this.getFuturesSymbol(indexSymbol);
      const dateStr = this.formatDateForApi(timestamp);
      const cacheKey = `${symbol}_${dateStr}_${timeframe}_${timestamp.getHours()}_${timestamp.getMinutes()}`;
      
      const cachedData = this.getFromCache(cacheKey);
      if (cachedData) {
        console.log(`📋 Using cached data for ${symbol} at ${timestamp}`);
        
        // Store the data from cache
        await this.storeHistoricalData(indexSymbol, type, cachedData.data.data, timeframe);
        return cachedData.data;
      }
      
      // Check rate limiter before making API call
      const rateLimiter = require('./rateLimiter');
      if (!rateLimiter.canMakeCall('historical')) {
        console.log(`⚠️ Rate limit reached for ${symbol}, delaying API call`);
        
        // Wait for backoff time
        const backoffTime = rateLimiter.handleRateLimitError('historical');
        console.log(`⏱️ Waiting for ${backoffTime}ms before retrying`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Try again after waiting
        return this.fetchAndStoreMissingData(indexSymbol, type, timestamp, timeframe);
      }
      
      // Fetch data from API
      const result = await this.fetchHistoricalMinuteData(
        indexSymbol, 
        type, 
        timestamp, 
        timeframe
      );

      if (!result.success) {
        console.log(`⚠️ Failed to fetch missing data for ${indexSymbol} ${type}`);
        
        // If rate limited, retry after backoff
        if (result.error && (result.error.includes('rate limit') || result.error.includes('429'))) {
          console.log(`⚠️ Rate limit error detected, will retry after backoff`);
          rateLimiter.handleRateLimitError('historical');
          
          // Wait for backoff time
          const backoffTime = 5000; // 5 seconds minimum
          console.log(`⏱️ Waiting for ${backoffTime}ms before retrying`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
          
          // Try again after waiting
          return this.fetchAndStoreMissingData(indexSymbol, type, timestamp, timeframe);
        }
        
        return { success: false, message: 'Failed to fetch data' };
      }

      // Store the data
      await this.storeHistoricalData(indexSymbol, type, result.data, timeframe);
      
      // Store in cache with longer expiration (30 minutes)
      this.addToCache(cacheKey, result, 1800000);

      console.log(`✅ Successfully filled missing data for ${indexSymbol} ${type} at ${timestamp}`);
      return { success: true };
    } catch (error) {
      console.error(`❌ Error filling missing data for ${indexSymbol} ${type}:`, error);
      
      // Check if this is a rate limit error
      if (error.message && (error.message.includes('rate limit') || error.message.includes('429'))) {
        console.log(`⚠️ Rate limit error detected, will retry after backoff`);
        const rateLimiter = require('./rateLimiter');
        rateLimiter.handleRateLimitError('historical');
        
        // Wait for backoff time
        const backoffTime = 5000; // 5 seconds minimum
        console.log(`⏱️ Waiting for ${backoffTime}ms before retrying`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Try again after waiting
        return this.fetchAndStoreMissingData(indexSymbol, type, timestamp, timeframe);
      }
      
      return { success: false, error: error.message };
    }
  }

  // Read CSV file
  async readCSVFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const data = fs.readFileSync(filePath, 'utf8');
      const lines = data.trim().split('\n');
      
      if (lines.length <= 1) {
        return []; // Only header or empty
      }

      const header = lines[0].split(',');
      
      return lines.slice(1).map(line => {
        const values = line.split(',');
        const record = {};
        
        header.forEach((key, index) => {
          record[key.trim()] = values[index] ? values[index].trim() : '';
        });
        
        return record;
      });
    } catch (error) {
      console.error(`❌ Error reading CSV file ${filePath}:`, error);
      return [];
    }
  }

  // Get last N market days
  getLastMarketDays(days = 3) {
    const result = [];
    let currentDay = timestampService.getCurrentIST();
    
    while (result.length < days) {
      // Skip weekends
      if (currentDay.getDay() !== 0 && currentDay.getDay() !== 6) {
        result.push(new Date(currentDay));
      }
      
      // Go to previous day
      currentDay.setDate(currentDay.getDate() - 1);
    }
    
    return result;
  }

  // Get latest market data for display
  async getLatestMarketData(indexSymbol) {
    try {
      const result = {
        index: null,
        futures: null
      };
      
      // Try to read from 1min data first
      const indexFilePath = this.getDataFilePath(indexSymbol, 'INDEX', '1min');
      const futuresFilePath = this.getDataFilePath(indexSymbol, 'FUTURES', '1min');
      
      if (fs.existsSync(indexFilePath)) {
        const indexData = await this.readCSVFile(indexFilePath);
        if (indexData.length > 0) {
          result.index = indexData[indexData.length - 1];
        }
      }
      
      if (fs.existsSync(futuresFilePath)) {
        const futuresData = await this.readCSVFile(futuresFilePath);
        if (futuresData.length > 0) {
          result.futures = futuresData[futuresData.length - 1];
        }
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error getting latest market data for ${indexSymbol}:`, error);
      return { index: null, futures: null };
    }
  }

  // Get chart data
  async getChartData(indexSymbol, timeframe = '1min') {
    try {
      const indexFilePath = this.getDataFilePath(indexSymbol, 'INDEX', timeframe);
      const futuresFilePath = this.getDataFilePath(indexSymbol, 'FUTURES', timeframe);
      
      const result = {
        index: [],
        futures: []
      };
      
      if (fs.existsSync(indexFilePath)) {
        result.index = await this.readCSVFile(indexFilePath);
      }
      
      if (fs.existsSync(futuresFilePath)) {
        result.futures = await this.readCSVFile(futuresFilePath);
      }
      
      return result;
    } catch (error) {
      console.error(`❌ Error getting chart data for ${indexSymbol}:`, error);
      return { index: [], futures: [] };
    }
  }
}

module.exports = new MarketDataService();
