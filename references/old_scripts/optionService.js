const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const authService = require('./authService');
const symbolConfig = require('../config/symbolConfig');
const timestampService = require('./timestampService');
const localCacheService = require('./localCacheService');

class OptionService {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.ensureDataDirectory();
    
    // Add a request cache to prevent duplicate API calls
    this.requestCache = new Map();
    this.cacheTimeout = 5000; // 5 seconds cache timeout
    
    // ATM cache - store ATM strikes for each index
    this.atmCache = new Map();
    
    // Schedule daily cleanup
    this.scheduleDailyCleanup();
    
    // Option strike intervals
    this.strikeIntervals = {
      'NIFTY': 50,
      'BANKNIFTY': 100,
      'FINNIFTY': 50,
      'MIDCAPNIFTY': 25,
      'SENSEX': 100
    };
    
    // Holiday dates for 2025 (from Pine Script)
    this.holidays = [
      '2025-02-26', '2025-03-14', '2025-03-31', '2025-04-10', 
      '2025-04-14', '2025-04-18', '2025-05-01', '2025-08-15', 
      '2025-08-27', '2025-10-02', '2025-10-21', '2025-10-22', 
      '2025-11-05', '2025-12-25'
    ];
  }

  /**
   * Ensure data directory exists
   */
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

  /**
   * Get the appropriate symbol for different data types
   * This handles the special case where some indices use different symbols
   * for index data vs options/futures data (like BANKNIFTY)
   */
  getSymbolForDataType(indexSymbol, dataType) {
    // Special mapping for indices that use different symbols for different data types
    const specialMappings = {
      'BANKNIFTY': {
        'index': 'NIFTYBANK',      // Index data uses NIFTYBANK
        'options': 'BANKNIFTY',    // Options use BANKNIFTY
        'futures': 'BANKNIFTY'     // Futures use BANKNIFTY
      }
    };

    if (specialMappings[indexSymbol] && specialMappings[indexSymbol][dataType]) {
      return specialMappings[indexSymbol][dataType];
    }

    // For all other indices, use the same symbol for all data types
    return indexSymbol;
  }

  /**
   * Get day's opening price from CSV file using the current data structure
   */
  async getDayOpenPrice(indexKey) {
    try {
      const holidayService = require('./holidayService');
      const timestampService = require('./timestampService');
      
      // Determine which trading session to use
      let targetTradingDay;
      if (timestampService.isMarketOpen()) {
        // Market is open, use today's data
        targetTradingDay = new Date();
        console.log(`📅 Market OPEN - Getting day open price for ${indexKey} from today`);
      } else {
        // Market is closed, use last trading session
        targetTradingDay = holidayService.getLastTradingSessionDate();
        const dateStr = targetTradingDay.toISOString().split('T')[0];
        console.log(`📅 Market CLOSED - Getting day open price for ${indexKey} from last trading session: ${dateStr}`);
      }
      
      const tradingDayStr = targetTradingDay.toISOString().split('T')[0];
      const dataDir = path.join(__dirname, '../data');
      const csvFile = path.join(dataDir, `${indexKey}_INDEX_${tradingDayStr}.csv`);
      
      if (!fs.existsSync(csvFile)) {
        console.log(`📄 CSV file not found: ${csvFile}`);
        
        // Try previous trading day as fallback
        const previousDay = holidayService.getPreviousMarketDay(targetTradingDay);
        const previousDayStr = previousDay.toISOString().split('T')[0];
        const previousCsvFile = path.join(dataDir, `${indexKey}_INDEX_${previousDayStr}.csv`);
        
        if (fs.existsSync(previousCsvFile)) {
          console.log(`📄 Using previous trading day data: ${previousDayStr}`);
          return this.extractOpenPriceFromCSV(previousCsvFile, indexKey);
        }
        
        console.log(`❌ No CSV data found for ${indexKey} on ${tradingDayStr} or ${previousDayStr}`);
        return null;
      }
      
      return this.extractOpenPriceFromCSV(csvFile, indexKey);
      
    } catch (error) {
      console.error(`❌ Error getting day open price for ${indexKey}:`, error);
      return null;
    }
  }

  // Helper method to extract 9:15 AM open price from CSV
  extractOpenPriceFromCSV(csvFile, indexKey) {
    return new Promise((resolve, reject) => {
      let marketOpenRow = null;
      let firstRow = null;
      const marketOpenTime = '09:15:00';
      
      fs.createReadStream(csvFile)
        .pipe(csv())
        .on('data', (row) => {
          if (!firstRow) {
            firstRow = row;
          }
          
          // Look for the first record at or after 9:15 AM
          if (row.timestamp && !marketOpenRow) {
            const timeStr = row.timestamp.split('T')[1]?.split('+')[0] || '';
            if (timeStr >= marketOpenTime) {
              marketOpenRow = row;
            }
          }
        })
        .on('end', () => {
          // Prefer market open time data, fallback to first row
          const targetRow = marketOpenRow || firstRow;
          
          if (targetRow) {
            // Prefer 'open' field if available, fallback to 'price' or 'ltp'
            const openPrice = parseFloat(targetRow.open || targetRow.price || targetRow.ltp || 0);
            if (openPrice && openPrice > 0) {
              const timeUsed = marketOpenRow ? 'market open (9:15 AM)' : 'first available';
              console.log(`📊 Day open price for ${indexKey}: ${openPrice} (from ${timeUsed} - ${targetRow.timestamp})`);
              resolve(openPrice);
            } else {
              console.log(`❌ Invalid opening price data in CSV file for ${indexKey}: open=${targetRow.open}, price=${targetRow.price}, ltp=${targetRow.ltp}`);
              resolve(null);
            }
          } else {
            console.log(`❌ No data found in CSV file for ${indexKey}`);
            resolve(null);
          }
        })
        .on('error', (error) => {
          console.error(`❌ Error reading CSV file for ${indexKey}:`, error);
          reject(error);
        });
    });
  }

  /**
   * Manual cleanup method for testing purposes
   */
  async manualCleanup() {
    console.log('🧪 Manual cleanup triggered...');
    await this.performDailyCleanup();
  }

  /**
   * Get ATM strike based on opening price from last trading session
   * ATM remains fixed until next market open - no intraday changes
   */
  async getATMStrike(indexKey, appId, accessToken) {
    const holidayService = require('./holidayService');
    const timestampService = require('./timestampService');
    
    // Determine which trading session to use for ATM calculation
    let targetSessionDate;
    if (timestampService.isMarketOpen()) {
      // Market is open, use today's session
      targetSessionDate = new Date().toISOString().split('T')[0];
    } else {
      // Market is closed, use last trading session
      const lastSession = holidayService.getLastTradingSessionDate();
      targetSessionDate = lastSession.toISOString().split('T')[0];
    }
    
    const cacheKey = `${indexKey}_${targetSessionDate}`;
    
    // Return cached ATM if available for this trading session
    if (this.atmCache.has(cacheKey)) {
      const cached = this.atmCache.get(cacheKey);
      console.log(`📋 Using cached ATM for ${indexKey} (session: ${targetSessionDate}):`, cached);
      return cached;
    }

    try {
      console.log(`🔍 Calculating ATM for ${indexKey} based on session: ${targetSessionDate}`);
      
      // Get opening price from the target trading session
      let dayOpenPrice = await this.getDayOpenPrice(indexKey);
      
      // If not available, use fallback values instead of returning null
      if (!dayOpenPrice || isNaN(dayOpenPrice)) {
        console.log(`❌ No opening price available for ${indexKey} from session ${targetSessionDate} - using fallback`);
        const fallbackPrices = {
          'NIFTY': 24800,
          'NIFTYBANK': 55600,
          'SENSEX': 81400,
          'FINNIFTY': 24500,
          'MIDCPNIFTY': 13200
        };
        dayOpenPrice = fallbackPrices[indexKey] || 25000;
        console.log(`📊 Using fallback open price ${dayOpenPrice} for ${indexKey}`);
      }
      
      const interval = this.getStrikeInterval(indexKey);
      
      // Calculate ATM strike based on opening price - FIXED until next trading session
      const atmStrike = Math.round(dayOpenPrice / interval) * interval;
      
      const atmData = {
        indexKey,
        dayOpenPrice,
        atmStrike,
        interval,
        date: targetSessionDate,
        expiry: this.calculateExpiry(indexKey),
        calculatedAt: new Date().toISOString(),
        source: timestampService.isMarketOpen() ? 'current_session' : 'last_trading_session',
        note: `ATM calculated from ${targetSessionDate} opening price - remains fixed until next market open`
      };
      
      // Cache for this trading session
      this.atmCache.set(cacheKey, atmData);
      
      console.log(`📊 ATM calculated and cached for ${indexKey}:`, atmData);
      console.log(`🔒 ATM will remain ${atmStrike} until next market open (no intraday changes)`);
      return atmData;
      
    } catch (error) {
      console.error(`❌ Error calculating ATM for ${indexKey}:`, error);
      throw error;
    }
  }

  /**
   * Get strike interval for an index
   */
  getStrikeInterval(indexKey) {
    const intervals = {
      'NIFTY': 50,
      'NIFTYBANK': 100,
      'SENSEX': 100,
      'FINNIFTY': 50,
      'MIDCPNIFTY': 25
    };
    return intervals[indexKey] || 50;
  }

  // Add this mapping function at the top of the class
  mapIndexKeyForSymbol(indexKey) {
    if (indexKey === 'NIFTYBANK') return 'BANKNIFTY';
    return indexKey;
  }

  /**
   * Generate option symbols for CE and PE ATM (Weekly/Monthly based on index)
   * Different indices use different formats:
   * - NIFTY, SENSEX: Weekly format (NSE:NIFTY2561225000CE)
   * - BANKNIFTY, FINNIFTY, MIDCAPNIFTY: Monthly format (NSE:BANKNIFTY25JUN56000CE)
   */
  generateATMSymbols(indexKey, atmStrike, expiry) {
    const mappedKey = this.mapIndexKeyForSymbol(indexKey);
    const year = expiry.getFullYear().toString().slice(-2);
    const strikeStr = atmStrike.toString();
    let exchange, baseSymbol;
    if (mappedKey === 'SENSEX') {
      exchange = 'BSE';
      baseSymbol = 'SENSEX';
    } else if (mappedKey === 'MIDCAPNIFTY') {
      exchange = 'NSE';
      baseSymbol = 'MIDCPNIFTY';
    } else {
      exchange = 'NSE';
      baseSymbol = mappedKey;
    }
    let ceSymbol, peSymbol;
    if (mappedKey === 'BANKNIFTY') {
      // BANKNIFTY: YYMMM (no day)
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = monthNames[expiry.getMonth()];
      ceSymbol = `${exchange}:${baseSymbol}${year}${month}${strikeStr}CE`;
      peSymbol = `${exchange}:${baseSymbol}${year}${month}${strikeStr}PE`;
    } else {
      const weeklyIndices = ['NIFTY', 'SENSEX'];
      const monthlyIndices = ['BANKNIFTY', 'FINNIFTY', 'MIDCAPNIFTY'];
      if (weeklyIndices.includes(mappedKey)) {
        const month = this.getWeeklyMonthCode(expiry.getMonth());
        const day = expiry.getDate().toString().padStart(2, '0');
        ceSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${strikeStr}CE`;
        peSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${strikeStr}PE`;
      } else if (monthlyIndices.includes(mappedKey)) {
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const month = monthNames[expiry.getMonth()];
        ceSymbol = `${exchange}:${baseSymbol}${year}${month}${strikeStr}CE`;
        peSymbol = `${exchange}:${baseSymbol}${year}${month}${strikeStr}PE`;
      } else {
        const month = this.getWeeklyMonthCode(expiry.getMonth());
        const day = expiry.getDate().toString().padStart(2, '0');
        ceSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${strikeStr}CE`;
        peSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${strikeStr}PE`;
      }
    }
    console.log(`📊 Generated ${mappedKey} symbols: CE=${ceSymbol}, PE=${peSymbol}`);
    return { ceSymbol, peSymbol };
  }

  /**
   * Get ATM option data (both CE and PE)
   */
  async getATMOptionData(indexKey, appId, accessToken) {
    try {
      console.log(`🔍 Fetching ATM option data for ${indexKey}`);
      
      // Check cache first to prevent duplicate API calls
      const cacheKey = `${indexKey}_ATM`;
      const cachedData = this.getFromCache(cacheKey);
      
      if (cachedData) {
        console.log(`📋 Using cached ATM option data for ${indexKey} (cached ${Date.now() - cachedData.timestamp}ms ago)`);
        return cachedData.data;
      }
      
      // Get ATM strike
      const atmData = await this.getATMStrike(indexKey, appId, accessToken);
      const { ceSymbol, peSymbol } = this.generateATMSymbols(indexKey, atmData.atmStrike, atmData.expiry);
      
      console.log(`📊 ATM symbols - CE: ${ceSymbol}, PE: ${peSymbol}`);
      
      // Fetch option data from Fyers API
      const fyers = authService.getFyersInstance(appId, accessToken);
      
      const response = await fyers.getMarketDepth({
        symbol: [ceSymbol, peSymbol],
        ohlcv_flag: 1
      });

      console.log('🔍 Option API Response for ${indexKey} ATM:', JSON.stringify(response, null, 2));
      
      if (response && response.s === 'ok' && response.d) {
        const ceData = response.d[ceSymbol];
        const peData = response.d[peSymbol];
        
        if (!ceData || !peData) {
          console.log('❌ Missing option data in response');
          console.log('📋 Available symbols in response:', Object.keys(response.d));
          throw new Error(`Missing option data - CE: ${!!ceData}, PE: ${!!peData}`);
        }
        
        // Generate appropriate timestamp based on market status
        let timestamp;
        if (timestampService.isMarketOpen()) {
          // Market is open - use current market time
          timestamp = timestampService.getCurrentIST();
        } else {
          // Market is closed - use the last market close time for today
          const today = timestampService.getCurrentIST();
          timestamp = timestampService.getMarketEndTimestamp(today);
        }
        
        const processedData = {
          indexKey,
          atmStrike: atmData.atmStrike,
          expiry: atmData.expiry,
          symbols: { ceSymbol, peSymbol },
          ce: this.processOptionData(ceData, 'CE'),
          pe: this.processOptionData(peData, 'PE'),
          pcr: this.calculatePCR(ceData, peData),
          timestamp: timestamp
        };
        
        // Store data in file system
        await this.storeOptionData(indexKey, processedData);
        
        // Store in cache to prevent duplicate API calls
        this.addToCache(cacheKey, processedData);
        
        console.log(`✅ Successfully fetched ATM option data for ${indexKey}`);
        return processedData;
        
      } else {
        console.log('❌ Invalid API response:', response);
        throw new Error('Failed to fetch option data from Fyers API');
      }
      
    } catch (error) {
      console.error(`❌ Error fetching ATM option data for ${indexKey}:`, error);
      throw error;
    }
  }

  // Add to request cache
  addToCache(key, data) {
    this.requestCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  // Get from request cache
  getFromCache(key) {
    const cached = this.requestCache.get(key);
    if (!cached) return null;
    
    // Check if cache is still valid
    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.requestCache.delete(key);
      return null;
    }
    
    return cached;
  }

  /**
   * Process individual option data
   */
  processOptionData(optionData, type) {
    return {
      ltp: parseFloat(optionData.ltp || 0),
      change: parseFloat(optionData.ch || 0),
      changePercent: parseFloat(optionData.chp || 0),
      volume: parseFloat(optionData.volume || optionData.v || optionData.vol_traded_today || 0),
      openInterest: parseFloat(optionData.oi || optionData.openInterest || 0),
      bid: optionData.bids && optionData.bids[0] ? parseFloat(optionData.bids[0].price || 0) : parseFloat(optionData.bid_price || optionData.bid || 0),
      ask: optionData.asks && optionData.asks[0] ? parseFloat(optionData.asks[0].price || 0) : parseFloat(optionData.ask_price || optionData.ask || 0),
      type
    };
  }

  /**
   * Calculate Put-Call Ratio (PCR)
   */
  calculatePCR(ceData, peData) {
    try {
      const ceOI = parseFloat(ceData.openInterest || ceData.oi || 0);
      const peOI = parseFloat(peData.openInterest || peData.oi || 0);
      const ceVolume = parseFloat(ceData.volume || 0);
      const peVolume = parseFloat(peData.volume || 0);
      const cePrice = parseFloat(ceData.ltp || ceData.price || 0);
      const pePrice = parseFloat(peData.ltp || peData.price || 0);
      
      return {
        byVolume: ceVolume > 0 ? (peVolume / ceVolume).toFixed(2) : 'N/A',
        byOI: ceOI > 0 ? (peOI / ceOI).toFixed(2) : 'N/A',
        byValue: cePrice > 0 ? (pePrice / cePrice).toFixed(2) : 'N/A'
      };
    } catch (error) {
      console.error('Error calculating PCR:', error);
      return {
        byVolume: 'N/A',
        byOI: 'N/A',
        byValue: 'N/A'
      };
    }
  }

  /**
   * Store option data to CSV files
   * @param {string} indexKey - Index symbol (NIFTY, BANKNIFTY, etc.)
   * @param {object} optionData - Option data with ce/pe information
   * @param {string} dateString - Optional date string for historical data (YYYY-MM-DD format)
   */
  async storeOptionData(indexKey, optionData, dateString = null) {
    try {
      // Use proper market timestamp instead of current time
      const timestamp = optionData.timestamp || timestampService.getCurrentIST();
      const formattedTimestamp = timestampService.formatTimestampForStorage(timestamp);
      
      // Use provided date string for historical data, or today's date for live data
      const targetDate = dateString || new Date().toISOString().split('T')[0];
      
      // Use the correct symbol for option data
      const optionSymbol = this.getSymbolForDataType(indexKey, 'options');
      
      const ceFilename = `${optionSymbol}_CE_ATM_${targetDate}.csv`;
      const peFilename = `${optionSymbol}_PE_ATM_${targetDate}.csv`;
      
      const ceFilePath = path.join(this.dataDir, 'options', ceFilename);
      const peFilePath = path.join(this.dataDir, 'options', peFilename);
      
      // Ensure options directory exists
      fs.mkdirSync(path.dirname(ceFilePath), { recursive: true });
      
      // Prepare data rows
      const ceData = [
        formattedTimestamp,
        optionData.ce.price,
        optionData.ce.change,
        optionData.ce.changePercent,
        optionData.ce.volume,
        optionData.ce.openInterest,
        optionData.ce.bid,
        optionData.ce.ask
      ].join(',');
      
      const peData = [
        formattedTimestamp,
        optionData.pe.price,
        optionData.pe.change,
        optionData.pe.changePercent,
        optionData.pe.volume,
        optionData.pe.openInterest,
        optionData.pe.bid,
        optionData.pe.ask
      ].join(',');
      
      // Write headers if files don't exist
      if (!fs.existsSync(ceFilePath)) {
        const header = 'timestamp,price,change,changePercent,volume,openInterest,bid,ask\n';
        fs.writeFileSync(ceFilePath, header);
      }
      
      if (!fs.existsSync(peFilePath)) {
        const header = 'timestamp,price,change,changePercent,volume,openInterest,bid,ask\n';
        fs.writeFileSync(peFilePath, header);
      }
      
      // Append data
      fs.appendFileSync(ceFilePath, ceData + '\n');
      fs.appendFileSync(peFilePath, peData + '\n');
      
      console.log(`💾 Stored ATM option data for ${indexKey} at ${formattedTimestamp} (date: ${targetDate})`);
      
    } catch (error) {
      console.error(`❌ Error storing option data for ${indexKey}:`, error);
    }
  }

  /**
   * Read historical option data (3 days worth)
   */
  async readHistoricalOptionData(indexKey, days = 3) {
    try {
      const historicalData = {
        ce: [],
        pe: [],
        indexKey,
        days
      };
      
      for (let i = 0; i < days; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        // Use the correct symbol for option data
        const optionSymbol = this.getSymbolForDataType(indexKey, 'options');
        
        const ceFilename = `${optionSymbol}_CE_ATM_${dateStr}.csv`;
        const peFilename = `${optionSymbol}_PE_ATM_${dateStr}.csv`;
        
        const ceFilePath = path.join(this.dataDir, ceFilename);
        const peFilePath = path.join(this.dataDir, peFilename);
        
        // Read CE data
        if (fs.existsSync(ceFilePath)) {
          const ceData = await this.readCSVFile(ceFilePath);
          historicalData.ce.push(...ceData.map(row => ({...row, date: dateStr, type: 'CE'})));
        }
        
        // Read PE data
        if (fs.existsSync(peFilePath)) {
          const peData = await this.readCSVFile(peFilePath);
          historicalData.pe.push(...peData.map(row => ({...row, date: dateStr, type: 'PE'})));
        }
      }
      
      // Sort by timestamp
      historicalData.ce.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      historicalData.pe.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      
      console.log(`📊 Read ${historicalData.ce.length} CE records and ${historicalData.pe.length} PE records for ${indexKey}`);
      
      return historicalData;
      
    } catch (error) {
      console.error(`❌ Error reading historical option data for ${indexKey}:`, error);
      return { ce: [], pe: [], indexKey, days };
    }
  }

  /**
   * Read CSV file and return parsed data
   */
  readCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          // Convert string values to numbers where appropriate
          // Map 'price' column to 'ltp' for consistency
          const processedData = {
            timestamp: data.timestamp,
            symbol: data.symbol,
            ltp: parseFloat(data.price) || parseFloat(data.ltp) || 0, // Handle both 'price' and 'ltp' columns
            change: parseFloat(data.change) || 0,
            changePercent: parseFloat(data.changePercent) || 0,
            volume: parseFloat(data.volume) || 0,
            openInterest: parseFloat(data.openInterest) || parseFloat(data.oi) || 0, // Handle both 'openInterest' and 'oi'
            bid: parseFloat(data.bid) || 0,
            ask: parseFloat(data.ask) || 0,
            close: parseFloat(data.price) || parseFloat(data.ltp) || 0, // Add close price mapping
            price: parseFloat(data.price) || parseFloat(data.ltp) || 0  // Keep original price field
          };
          results.push(processedData);
        })
        .on('end', () => resolve(results))  
        .on('error', reject);
    });
  }

  /**
   * Calculate expiry date for the index
   */
  calculateExpiry(indexKey) {
    const now = new Date();
    let expiry;
    
    if (indexKey === 'SENSEX') {
      // BSE: Weekly expiry on Tuesday
      expiry = this.getNextWeekday(now, 2); // Tuesday = 2
    } else {
      // NSE: Weekly expiry on Thursday  
      expiry = this.getNextWeekday(now, 4); // Thursday = 4
    }
    
    return expiry;
  }

  /**
   * Get the appropriate expiry date for the index
   * - If today is expiry day, use today's expiry until market close
   * - Otherwise, get the next expiry date
   */
  getNextWeekday(date, targetDay) {
    const result = new Date(date);
    const currentDay = result.getDay();
    
    let daysToAdd = targetDay - currentDay;
    
    // If today IS the target day (expiry day), use today's expiry
    // This ensures we use the correct expiry for the entire trading day
    if (daysToAdd === 0) {
      // Use today's expiry (don't switch to next week until tomorrow)
      return result;
    } else if (daysToAdd < 0) {
      // Target day already passed this week, get next week
      daysToAdd += 7;
    }
    // If daysToAdd > 0, target day is coming this week
    
    result.setDate(result.getDate() + daysToAdd);
    return result;
  }

  /**
   * Get month code for option symbol (monthly expiry)
   */
  getMonthCode(monthIndex) {
    const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                   'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    return months[monthIndex];
  }

  /**
   * Get month code for weekly option symbols
   * Jan => 1, Feb => 2, ..., Sep => 9, Oct => O, Nov => N, Dec => D
   */
  getWeeklyMonthCode(monthIndex) {
    const weeklyMonths = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'O', 'N', 'D'];
    return weeklyMonths[monthIndex];
  }

  /**
   * Validate and ensure 3 days of historical option data - FIXED to use proper market days
   */
  async validateAndEnsureHistoricalData(indexKey, appId, accessToken) {
    try {
      console.log(`🔍 Validating 3 days of historical option data for ${indexKey} (FIXED - proper market days)...`);
      
      // Use the marketDataService getLastMarketDays method for consistency
      const marketDataService = require('./marketDataService');
      const marketDays = marketDataService.getLastMarketDays(3);
      
      console.log(`📅 Checking option data for last 3 market days:`);
      marketDays.forEach((day, index) => {
        console.log(`   ${index + 1}. ${day.toDateString()}`);
      });
      
      const missingData = [];
      
      for (const marketDay of marketDays) {
        const dateStr = marketDay.toISOString().split('T')[0];
        
        // Use the correct symbol for option data
        const optionSymbol = this.getSymbolForDataType(indexKey, 'options');
        
        const ceFilename = `${optionSymbol}_CE_ATM_${dateStr}.csv`;
        const peFilename = `${optionSymbol}_PE_ATM_${dateStr}.csv`;
        
        const ceFilePath = path.join(this.dataDir, ceFilename);
        const peFilePath = path.join(this.dataDir, peFilename);
        
        if (!fs.existsSync(ceFilePath) || !fs.existsSync(peFilePath)) {
          missingData.push(dateStr);
        }
      }
      
      if (missingData.length > 0) {
        console.log(`📥 Missing option data for ${missingData.length} market days: ${missingData.join(', ')}`);
        
        // Use the marketDataService to fetch real historical data instead of creating empty files
        const marketDataService = require('./marketDataService');
        
        for (const dateStr of missingData) {
          console.log(`📊 Fetching option data for ${indexKey} ATM on ${dateStr}...`);
          
          try {
            // Start option data collection which will handle historical data fetching
            const result = await marketDataService.startOptionDataCollection(indexKey, 'ATM', appId, accessToken);
            
            if (result.success) {
              console.log(`✅ Successfully ensured option data for ${indexKey} ATM on ${dateStr}`);
            } else {
              console.error(`❌ Failed to ensure option data for ${indexKey} ATM on ${dateStr}: ${result.error}`);
            }
          } catch (error) {
            console.error(`❌ Error fetching option data for ${indexKey} ATM on ${dateStr}:`, error);
          }
          
          // Rate limiting between days
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      console.log(`✅ Option data validation completed for ${indexKey}`);
      return { success: true, missingDataFixed: missingData.length };
      
    } catch (error) {
      console.error(`❌ Error validating option data for ${indexKey}:`, error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Schedule daily cleanup at 9:15 AM on market days
   */
  scheduleDailyCleanup() {
    const scheduleNextCleanup = () => {
      const now = new Date();
      const target = new Date();
      
      // Set to 9:10 AM today (before market opens to clear old data)
      target.setHours(9, 10, 0, 0);
      
              // If it's already past 9:10 AM today, set for tomorrow
        if (now >= target) {
        target.setDate(target.getDate() + 1);
      }
      
      const delay = target.getTime() - now.getTime();
      
      console.log(`🕘 Next option cleanup scheduled for: ${target.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      
      setTimeout(() => {
        this.performDailyCleanup();
        scheduleNextCleanup(); // Schedule next cleanup
      }, delay);
    };
    
    scheduleNextCleanup();
  }

  /**
   * Perform daily cleanup of ALL option files at 9:10 AM (before market opens)
   * Clears ENTIRE option folder since ATM/ITM/OTM changes daily and expiry dates change
   */
  async performDailyCleanup() {
    try {
      console.log('🧹 Starting complete option data cleanup at 9:10 AM...');
      
      const now = new Date();
      const day = now.getDay(); // 0=Sunday, 1=Monday, etc.
      const today = now.toISOString().split('T')[0];
      
      // Only clean on market days (Monday=1 to Friday=5) and not on holidays
      if (day < 1 || day > 5 || this.holidays.includes(today)) {
        console.log('📅 Not a market day, skipping cleanup');
        return;
      }
      
      // Clear ATM cache for all indices - forces recalculation based on new day's open price
      this.atmCache.clear();
      console.log('🗑️ Cleared ATM cache - will recalculate based on today\'s opening price');
      
      // Delete ALL option files (complete cleanup since ATM changes daily)
      const files = fs.readdirSync(this.dataDir);
      let deletedCount = 0;
      
      for (const file of files) {
        // Match ALL option files: ATM, ITM1-5, OTM1-5 (delete everything)
        if (file.endsWith('.csv') && (
          file.includes('_ATM_') || 
          file.includes('_ITM') || 
          file.includes('_OTM')
        )) {
          const filePath = path.join(this.dataDir, file);
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ Deleted option file: ${file}`);
        }
      }
      
      // Also clean cache folder at 9:15 AM (5 minutes after option cleanup)
      setTimeout(() => {
        this.cleanupCacheFolder();
      }, 5 * 60 * 1000); // 5 minutes delay
      
      console.log(`✅ Complete option cleanup completed. Deleted ${deletedCount} option files.`);
      console.log(`🎯 Fresh start: ATM will be calculated based on today's 9:15 AM opening price.`);
      console.log(`📊 All strikes (ITM/ATM/OTM) will be recalculated for today's expiry.`);
      console.log(`🗂️ Cache folder cleanup scheduled for 9:15 AM (5 minutes from now).`);
      
    } catch (error) {
      console.error('❌ Error during daily cleanup:', error);
    }
  }

  /**
   * Clean cache folder at 9:15 AM (after option cleanup)
   */
  async cleanupCacheFolder() {
    try {
      console.log('🗂️ Starting cache folder cleanup at 9:15 AM...');
      
      const cacheDir = path.join(__dirname, '../data/cache');
      
      if (!fs.existsSync(cacheDir)) {
        console.log('📁 Cache directory does not exist, skipping cleanup');
        return;
      }
      
      const files = fs.readdirSync(cacheDir);
      let deletedCount = 0;
      
      for (const file of files) {
        const filePath = path.join(cacheDir, file);
        
        // Skip directories
        if (fs.statSync(filePath).isDirectory()) {
          continue;
        }
        
        // Delete all cache files
        if (file.endsWith('.json')) {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ Deleted cache file: ${file}`);
        }
      }
      
      console.log(`✅ Cache cleanup completed. Deleted ${deletedCount} cache files.`);
      console.log(`🎯 Fresh cache ready for today's market data.`);
      
    } catch (error) {
      console.error('❌ Error during cache cleanup:', error);
    }
  }

  /**
   * Calculate strike price for ITM/OTM based on ATM
   * Returns different strikes for CE and PE based on option chain logic
   */
  calculateStrikePrices(indexKey, atmStrike, strikeType) {
    const interval = this.strikeIntervals[indexKey] || 50;
    
    switch(strikeType) {
      case 'ATM': 
        return { ceStrike: atmStrike, peStrike: atmStrike };
      
      // ITM strikes (In The Money)
      case 'ITM1': 
        return { 
          ceStrike: atmStrike - interval,      // CE ITM: Lower strike (25100)
          peStrike: atmStrike + interval       // PE ITM: Higher strike (25200)
        };
      case 'ITM2': 
        return { 
          ceStrike: atmStrike - (interval * 2), // CE ITM: 25050
          peStrike: atmStrike + (interval * 2)  // PE ITM: 25250
        };
      case 'ITM3': 
        return { 
          ceStrike: atmStrike - (interval * 3), // CE ITM: 25000
          peStrike: atmStrike + (interval * 3)  // PE ITM: 25300
        };
      case 'ITM4': 
        return { 
          ceStrike: atmStrike - (interval * 4), // CE ITM: 24950
          peStrike: atmStrike + (interval * 4)  // PE ITM: 25350
        };
      case 'ITM5': 
        return { 
          ceStrike: atmStrike - (interval * 5), // CE ITM: 24900
          peStrike: atmStrike + (interval * 5)  // PE ITM: 25400
        };
      
      // OTM strikes (Out of The Money)  
      case 'OTM1': 
        return { 
          ceStrike: atmStrike + interval,      // CE OTM: Higher strike (25200)
          peStrike: atmStrike - interval       // PE OTM: Lower strike (25100)
        };
      case 'OTM2': 
        return { 
          ceStrike: atmStrike + (interval * 2), // CE OTM: 25250
          peStrike: atmStrike - (interval * 2)  // PE OTM: 25050
        };
      case 'OTM3': 
        return { 
          ceStrike: atmStrike + (interval * 3), // CE OTM: 25300
          peStrike: atmStrike - (interval * 3)  // PE OTM: 25000
        };
      case 'OTM4': 
        return { 
          ceStrike: atmStrike + (interval * 4), // CE OTM: 25350
          peStrike: atmStrike - (interval * 4)  // PE OTM: 24950
        };
      case 'OTM5': 
        return { 
          ceStrike: atmStrike + (interval * 5), // CE OTM: 25400
          peStrike: atmStrike - (interval * 5)  // PE OTM: 24900
        };
      
      default: 
        return { ceStrike: atmStrike, peStrike: atmStrike };
    }
  }

  /**
   * Calculate strike price for ITM/OTM based on ATM (Legacy method - kept for compatibility)
   */
  calculateStrikePrice(indexKey, atmStrike, strikeType) {
    // For backward compatibility, return CE strike
    const strikes = this.calculateStrikePrices(indexKey, atmStrike, strikeType);
    return strikes.ceStrike;
  }

  /**
   * Generate option symbols for any strike type (ITM/ATM/OTM) - Weekly Format
   * Now supports different strikes for CE and PE
   */
  generateOptionSymbols(indexKey, ceStrike, peStrike, expiry) {
    const mappedKey = this.mapIndexKeyForSymbol(indexKey);
    const year = expiry.getFullYear().toString().slice(-2);
    const ceStrikeStr = ceStrike.toString();
    const peStrikeStr = peStrike.toString();
    let exchange, baseSymbol;
    if (mappedKey === 'SENSEX') {
      exchange = 'BSE';
      baseSymbol = 'SENSEX';
    } else if (mappedKey === 'MIDCAPNIFTY') {
      exchange = 'NSE';
      baseSymbol = 'MIDCPNIFTY';
    } else {
      exchange = 'NSE';
      baseSymbol = mappedKey;
    }
    let ceSymbol, peSymbol;
    if (mappedKey === 'BANKNIFTY') {
      // BANKNIFTY: YYMMM (no day)
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const month = monthNames[expiry.getMonth()];
      ceSymbol = `${exchange}:${baseSymbol}${year}${month}${ceStrikeStr}CE`;
      peSymbol = `${exchange}:${baseSymbol}${year}${month}${peStrikeStr}PE`;
    } else {
      const weeklyIndices = ['NIFTY', 'SENSEX'];
      const monthlyIndices = ['BANKNIFTY', 'FINNIFTY', 'MIDCAPNIFTY'];
      if (weeklyIndices.includes(mappedKey)) {
        const month = this.getWeeklyMonthCode(expiry.getMonth());
        const day = expiry.getDate().toString().padStart(2, '0');
        ceSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${ceStrikeStr}CE`;
        peSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${peStrikeStr}PE`;
      } else if (monthlyIndices.includes(mappedKey)) {
        const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const month = monthNames[expiry.getMonth()];
        ceSymbol = `${exchange}:${baseSymbol}${year}${month}${ceStrikeStr}CE`;
        peSymbol = `${exchange}:${baseSymbol}${year}${month}${peStrikeStr}PE`;
      } else {
        const month = this.getWeeklyMonthCode(expiry.getMonth());
        const day = expiry.getDate().toString().padStart(2, '0');
        ceSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${ceStrikeStr}CE`;
        peSymbol = `${exchange}:${baseSymbol}${year}${month}${day}${peStrikeStr}PE`;
      }
    }
    return { ceSymbol, peSymbol };
  }

  /**
   * Generate option symbols for strike type with correct CE/PE strikes
   */
  fixedSymbolService (indexKey, atmStrike, strikeType, expiry) {
    const strikes = this.calculateStrikePrices(indexKey, atmStrike, strikeType);
    return this.generateOptionSymbols(indexKey, strikes.ceStrike, strikes.peStrike, expiry);
  }

  /**
   * Get option data for any strike type (ITM/ATM/OTM)
   */
  async getOptionData(indexKey, strikeType, appId, accessToken) {
    try {
      console.log(`🔍 Fetching ${strikeType} option data for ${indexKey}`);
      
      // Ensure the options directory exists
      this.ensureDataDirectory();
      
      // Get ATM strike first
      const atmData = await this.getATMStrike(indexKey, appId, accessToken);
      
      // Calculate strike for the requested type
      const strikePrice = this.calculateStrikePrice(indexKey, atmData.atmStrike, strikeType);
      const { ceSymbol, peSymbol } = this.fixedSymbolService (indexKey, atmData.atmStrike, strikeType, atmData.expiry);
      
      console.log(`📊 ${strikeType} symbols - CE: ${ceSymbol}, PE: ${peSymbol}`);
      
      // Fetch option data from Fyers API
      const fyers = authService.getFyersInstance(appId, accessToken);
      
      const response = await fyers.getMarketDepth({
        symbol: [ceSymbol, peSymbol],
        ohlcv_flag: 1
      });

      console.log('🔍 Option API Response for ' + indexKey + ' ' + strikeType + ':', JSON.stringify(response, null, 2));

      if (response && response.s === 'ok' && response.d) {
        const ceData = response.d[ceSymbol];
        const peData = response.d[peSymbol];
        
        if (!ceData || !peData) {
          console.log('❌ Missing option data in response - ' + indexKey + ' ' + strikeType);
          console.log('📋 CE Symbol: ' + ceSymbol + ', PE Symbol: ' + peSymbol);
          console.log('📋 Available symbols in response:', Object.keys(response.d));
          throw new Error(`Missing option data - CE: ${!!ceData}, PE: ${!!peData}`);
        }
        
        const processedData = {
          indexKey,
          strikeType,
          atmStrike: atmData.atmStrike,
          strikePrice: strikePrice,
          expiry: atmData.expiry,
          symbols: { ceSymbol, peSymbol },
          ce: this.processOptionData(ceData, 'CE'),
          pe: this.processOptionData(peData, 'PE'),
          pcr: this.calculatePCR(ceData, peData),
          timestamp: require('./timestampService').getCurrentIST()
        };
        
        // Store data for historical tracking - make sure to include the strikeType
        await this.storeStrikeOptionData(indexKey, strikeType, processedData);
        
        console.log(`✅ Successfully fetched ${strikeType} option data for ${indexKey}`);
        return processedData;
        
      } else {
        console.log('❌ Invalid API response:', response);
        throw new Error('Failed to fetch option data from Fyers API');
      }
      
    } catch (error) {
      console.error(`❌ Error fetching ${strikeType} option data for ${indexKey}:`, error);
      throw error;
    }
  }

  /**
   * Store strike-specific option data to CSV files
   * @param {string} indexKey - Index symbol
   * @param {string} strikeType - Strike type (ITM1, ITM2, OTM1, etc.)
   * @param {object} optionData - Option data with ce/pe information
   * @param {string} dateString - Optional date string for historical data (YYYY-MM-DD format)
   */
  async storeStrikeOptionData(indexKey, strikeType, optionData, dateString = null) {
    try {
      // Ensure the data directory exists
      this.ensureDataDirectory();
      
      // Use provided date string for historical data, or yesterday's date for live data
      let targetDate;
      if (dateString) {
        targetDate = dateString;
      } else {
        // Use yesterday's date for filename since we want yesterday's data for calculations
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        targetDate = yesterday.toISOString().split('T')[0];
      }
      
      const ceFilename = `${indexKey}_CE_${strikeType}_${targetDate}.csv`;
      const peFilename = `${indexKey}_PE_${strikeType}_${targetDate}.csv`;
      
      const ceFilePath = path.join(this.dataDir, ceFilename);
      const peFilePath = path.join(this.dataDir, peFilename);
      
      console.log(`📄 CE File path: ${ceFilePath}`);
      console.log(`📄 PE File path: ${peFilePath}`);
      
      // Use the timestamp from optionData if available, otherwise use current time
      const timestamp = optionData.timestamp ? 
        require('./timestampService').formatTimestampForStorage(optionData.timestamp) :
        require('./timestampService').formatTimestampForStorage(new Date());
      
      // CE data row
      const ceRow = [
        timestamp,
        optionData.ce.ltp,
        optionData.ce.change,
        optionData.ce.changePercent,
        optionData.ce.volume,
        optionData.ce.openInterest,
        optionData.ce.bid,
        optionData.ce.ask
      ].join(',') + '\n';
      
      // PE data row
      const peRow = [
        timestamp,
        optionData.pe.ltp,
        optionData.pe.change,
        optionData.pe.changePercent,
        optionData.pe.volume,
        optionData.pe.openInterest,
        optionData.pe.bid,
        optionData.pe.ask
      ].join(',') + '\n';
      
      // Write headers if files don't exist
      const csvHeader = 'timestamp,ltp,change,changePercent,volume,openInterest,bid,ask\n';
      
      if (!fs.existsSync(ceFilePath)) {
        console.log(`📄 Creating new file: ${ceFilePath}`);
        fs.writeFileSync(ceFilePath, csvHeader);
      }
      if (!fs.existsSync(peFilePath)) {
        console.log(`📄 Creating new file: ${peFilePath}`);
        fs.writeFileSync(peFilePath, csvHeader);
      }
      
      // Append data
      fs.appendFileSync(ceFilePath, ceRow);
      fs.appendFileSync(peFilePath, peRow);
      
      console.log(`💾 Stored ${strikeType} option data for ${indexKey} at ${timestamp} (date: ${targetDate})`);
      
    } catch (error) {
      console.error('❌ Error storing strike option data:', error);
    }
  }

  // Get current live option data (no storage, just for display)
  async getCurrentOptionData(indexKey, appId, accessToken) {
    try {
      console.log(`📊 Fetching current live option data for ${indexKey}...`);
      
      // Get current ATM strike and expiry
      const atmData = await this.getATMStrike(indexKey, appId, accessToken);
      if (!atmData) {
        throw new Error('Could not determine ATM strike');
      }
      
      // Generate option symbols
      const symbols = this.generateATMSymbols(indexKey, atmData.atmStrike, atmData.expiry);
      console.log(`📊 Fetching live data for: ${symbols.ceSymbol}, ${symbols.peSymbol}`);
      
      // Fetch current market data for both CE and PE using getMarketDepth (includes OI)
      const fyers = authService.getFyersInstance(appId, accessToken);
      
      // Use getMarketDepth instead of getQuotes to get Open Interest data
      const response = await fyers.getMarketDepth({
        symbol: [symbols.ceSymbol, symbols.peSymbol],
        ohlcv_flag: 1
      });
      
      console.log('📊 Option Market Depth Response:', JSON.stringify(response, null, 2));
      
      // Process CE data - Response format: { d: { "symbol": { ltp, ch, chp, oi, ... } } }
      let ceData = null;
      if (response && response.s === 'ok' && response.d && response.d[symbols.ceSymbol]) {
        const ceSymbolData = response.d[symbols.ceSymbol];
        console.log('📊 CE Symbol Data:', JSON.stringify(ceSymbolData, null, 2));
        ceData = {
          symbol: symbols.ceSymbol,
          ltp: parseFloat(ceSymbolData.ltp || ceSymbolData.lp || 0),
          change: parseFloat(ceSymbolData.ch || 0), 
          changePercent: parseFloat(ceSymbolData.chp || 0),
          volume: parseFloat(ceSymbolData.v || ceSymbolData.volume || ceSymbolData.vol_traded_today || 0),
          openInterest: parseFloat(ceSymbolData.oi || ceSymbolData.openInterest || 0),
          bid: ceSymbolData.bids && ceSymbolData.bids[0] ? parseFloat(ceSymbolData.bids[0].price || 0) : parseFloat(ceSymbolData.bid || 0),
          ask: ceSymbolData.ask && ceSymbolData.ask[0] ? parseFloat(ceSymbolData.ask[0].price || 0) : parseFloat(ceSymbolData.ask || 0),
          strike: atmData.atmStrike,
          type: 'CE'
        };
        console.log('📊 Processed CE Data:', JSON.stringify(ceData, null, 2));
      }
      
      // Process PE data - Response format: { d: { "symbol": { ltp, ch, chp, oi, ... } } }
      let peData = null;
      if (response && response.s === 'ok' && response.d && response.d[symbols.peSymbol]) {
        const peSymbolData = response.d[symbols.peSymbol];
        console.log('📊 PE Symbol Data:', JSON.stringify(peSymbolData, null, 2));
        peData = {
          symbol: symbols.peSymbol,
          ltp: parseFloat(peSymbolData.ltp || peSymbolData.lp || 0),
          change: parseFloat(peSymbolData.ch || 0),
          changePercent: parseFloat(peSymbolData.chp || 0),
          volume: parseFloat(peSymbolData.v || peSymbolData.volume || peSymbolData.vol_traded_today || 0),
          openInterest: parseFloat(peSymbolData.oi || peSymbolData.openInterest || 0),
          bid: peSymbolData.bids && peSymbolData.bids[0] ? parseFloat(peSymbolData.bids[0].price || 0) : parseFloat(peSymbolData.bid || 0),
          ask: peSymbolData.ask && peSymbolData.ask[0] ? parseFloat(peSymbolData.ask[0].price || 0) : parseFloat(peSymbolData.ask || 0),
          strike: atmData.atmStrike,
          type: 'PE'
        };
        console.log('📊 Processed PE Data:', JSON.stringify(peData, null, 2));
      }
      
      // Calculate PCR (Put/Call Ratio)
      let pcr = null;
      if (ceData && peData) {
        pcr = {
          byVolume: ceData.volume > 0 ? (peData.volume / ceData.volume).toFixed(2) : 'N/A',
          byOI: ceData.openInterest > 0 ? (peData.openInterest / ceData.openInterest).toFixed(2) : 'N/A',
          byValue: ceData.ltp > 0 ? (peData.ltp / ceData.ltp).toFixed(2) : 'N/A'
        };
      }

      const result = {
        indexKey,
        atmStrike: atmData.atmStrike,
        expiry: atmData.expiry,
        dayOpenPrice: atmData.dayOpenPrice,
        ce: ceData,
        pe: peData,
        pcr: pcr,
        dataType: 'live', // Always live data
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ Current option data fetched - CE: ${ceData?.ltp || 'N/A'}, PE: ${peData?.ltp || 'N/A'}, PCR: ${pcr?.byVolume || 'N/A'}`);
      console.log(`📊 OI Debug - CE: ${ceData?.openInterest || 'N/A'}, PE: ${peData?.openInterest || 'N/A'}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Error fetching current option data for ${indexKey}:`, error.message);
      return null;
    }
  }

  /**
   * Smart option data fetching - tries multiple sources in order
   * 1. Live API if market is open
   * 2. Cache if available
   * 3. Stored historical data
   * 4. Generate realistic sample data
   */
  async getSmartOptionData(indexKey, strikeType = 'ATM', appId, accessToken) {
    try {
      console.log(`📊 Smart option data fetch for ${indexKey} ${strikeType} - Market: ${timestampService.isMarketOpen() ? 'OPEN' : 'CLOSED'}`);
      
      // Step 1: If market is open, try to get live data first
      if (timestampService.isMarketOpen()) {
        try {
          console.log(`🟢 Market OPEN - Fetching live data for ${indexKey} ${strikeType}`);
          const liveData = await this.getLiveOptionQuotesForStrike(indexKey, strikeType, appId, accessToken);
          if (liveData) {
            console.log(`✅ Got live data for ${indexKey} ${strikeType}`);
            return liveData;
          }
        } catch (liveError) {
          console.log(`⚠️ Live data fetch failed for ${indexKey} ${strikeType}:`, liveError.message);
        }
      }
      
      // Step 2: Try to get data from cache
      console.log(`🟡 Market CLOSED - Checking cache for ${indexKey} ${strikeType}`);
      const localCacheService = require('./localCacheService');
      const cacheKey = `option_${indexKey}_${strikeType}`;
      const cachedData = await localCacheService.get(cacheKey);
      
      if (cachedData && cachedData.data) {
        console.log(`✅ Using cached data for ${indexKey} ${strikeType}`);
        return cachedData.data;
      }
      
      console.log(`🔄 No valid cache for ${indexKey} ${strikeType} - need to fetch`);
      
      // Step 3: Try to get stored historical data
      console.log(`📁 Using stored historical data for ${indexKey} ${strikeType}`);
      try {
        const storedData = await this.getStoredOptionData(indexKey, strikeType);
        if (storedData) {
          console.log(`✅ Found stored data for ${indexKey} ${strikeType}`);
          return storedData;
        }
      } catch (storageError) {
        console.log(`⚠️ Stored data not available for ${indexKey} ${strikeType}:`, storageError.message);
      }
      
      // Step 4: NO MOCK DATA - Return "no data" response with symbols for trading safety
      console.log(`❌ No real option data available for ${indexKey} ${strikeType} - providing symbols for display`);
      
      // Generate symbols even when no data is available so frontend can display them
      const latestMarketData = this.getLatestMarketDataFromStorage(indexKey);
      let symbols = null;
      let calculatedStrike = null;
      
      if (latestMarketData && latestMarketData.price) {
        const atmStrike = this.roundToNearestStrikeInterval(latestMarketData.price, indexKey);
        const symbolCreatorService = require('./symbolCreatorService');
        const callSymbolData = symbolCreatorService.getSymbolForStrikeType(indexKey, strikeType, atmStrike, 'CE');
        const putSymbolData = symbolCreatorService.getSymbolForStrikeType(indexKey, strikeType, atmStrike, 'PE');
        
        if (callSymbolData && putSymbolData) {
          symbols = {
            call: callSymbolData.symbol,
            put: putSymbolData.symbol,
            strike: callSymbolData.strike,
            expiry: callSymbolData.expiryDisplay
          };
          calculatedStrike = callSymbolData.strike;
        }
      }
      
      return {
        indexKey,
        strikeType,
        strike: calculatedStrike,
        atmStrike: latestMarketData ? this.roundToNearestStrikeInterval(latestMarketData.price, indexKey) : null,
        timestamp: new Date().toISOString(),
        dataType: 'no_data',
        error: 'No real option data available',
        message: `Real option data not available for ${indexKey} ${strikeType}. Historic API should be used to fetch data during market hours.`,
        call: null,
        put: null,
        symbols: symbols,
        pcr: null
      };
    } catch (error) {
      console.error(`❌ Error in smart option data fetch for ${indexKey} ${strikeType}:`, error);
      throw error;
    }
  }

  /**
   * Get stored option data from CSV files (supports all strike types)
   */
  async getStoredOptionData(indexKey, strikeType = 'ATM') {
    try {
      console.log(`📁 Reading stored ${strikeType} option data for ${indexKey}`);
      
      // Try to find data from the last few days
      const dates = [];
      for (let i = 0; i < 5; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        dates.push(date.toISOString().split('T')[0]);
      }
      
      for (const date of dates) {
        try {
          // Use proper file naming convention for different strikes
          const ceFile = path.join(this.dataDir, `${indexKey}_CE_${strikeType}_${date}.csv`);
          const peFile = path.join(this.dataDir, `${indexKey}_PE_${strikeType}_${date}.csv`);
          
          if (fs.existsSync(ceFile) && fs.existsSync(peFile)) {
            const ceData = await this.readOptionCSV(ceFile);
            const peData = await this.readOptionCSV(peFile);
            
            if (ceData.length > 0 && peData.length > 0) {
              // Get the last entry (market close data)
              const latestCE = ceData[ceData.length - 1];
              const latestPE = peData[peData.length - 1];
              
              // Calculate strike info
              const atmStrike = await this.getATMStrikeFromStored(indexKey, date);
              const strikes = this.calculateStrikePrices(indexKey, atmStrike, strikeType);
              
              // Use symbolCreatorService to generate proper symbols
              const symbolCreatorService = require('./symbolCreatorService');
              const callSymbolData = symbolCreatorService.getSymbolForStrikeType(indexKey, strikeType, atmStrike, 'CE');
              const putSymbolData = symbolCreatorService.getSymbolForStrikeType(indexKey, strikeType, atmStrike, 'PE');
              
              const result = {
                indexKey,
                strikeType,
                strike: callSymbolData ? callSymbolData.strike : strikes.ceStrike, // Use actual strike from symbol creator
                atmStrike,
                ceStrike: strikes.ceStrike,
                peStrike: strikes.peStrike,
                expiry: callSymbolData ? callSymbolData.expiryDisplay : this.calculateExpiry(indexKey),
                symbols: {
                  call: callSymbolData ? callSymbolData.symbol : null,
                  put: putSymbolData ? putSymbolData.symbol : null,
                  strike: callSymbolData ? callSymbolData.strike : strikes.ceStrike,
                  expiry: callSymbolData ? callSymbolData.expiryDisplay : null
                },
                ce: {
                  ltp: parseFloat(latestCE.price || 0),
                  change: parseFloat(latestCE.change || 0),
                  changePercent: parseFloat(latestCE.changePercent || 0),
                  volume: parseFloat(latestCE.volume || 0),
                  openInterest: 0, // Not available in stored data
                  bid: parseFloat(latestCE.bid || 0),
                  ask: parseFloat(latestCE.ask || 0),
                  type: 'CE'
                },
                pe: {
                  ltp: parseFloat(latestPE.price || 0),
                  change: parseFloat(latestPE.change || 0),
                  changePercent: parseFloat(latestPE.changePercent || 0),
                  volume: parseFloat(latestPE.volume || 0),
                  openInterest: 0, // Not available in stored data
                  bid: parseFloat(latestPE.bid || 0),
                  ask: parseFloat(latestPE.ask || 0),
                  type: 'PE'
                },
                pcr: this.calculatePCRFromStoredData(latestCE, latestPE),
                dataType: 'historical',
                timestamp: latestCE.timestamp || timestampService.getMarketEndTimestamp(new Date(date)).toISOString(),
                note: `Stored data from ${date} market close`
              };
              
              console.log(`✅ Successfully loaded stored ${strikeType} option data for ${indexKey} from ${date}`);
              return result;
            }
          }
        } catch (error) {
          console.log(`⚠️ Could not read stored data for ${date}:`, error.message);
          continue;
        }
      }
      
      // If no specific strike data found and it's not ATM, generate data directly from ATM strike calculation
      if (strikeType !== 'ATM') {
        console.log(`⚠️ No stored data for ${strikeType}, generating data directly from ATM strike calculation`);
        
        try {
          // Calculate ATM strike directly - no need for ATM data!
          const atmStrike = await this.getATMStrikeFromStored(indexKey, new Date().toISOString().split('T')[0]);
          console.log(`🎯 Calculated ATM strike for ${indexKey}: ${atmStrike}`);
          
          // Calculate actual strikes for the requested type
          const strikes = this.calculateStrikePrices(indexKey, atmStrike, strikeType);
          console.log(`🔢 Calculated ${strikeType} strikes - CE: ${strikes.ceStrike}, PE: ${strikes.peStrike}`);
          
          // Use symbolCreatorService for consistent symbol generation
          const symbolCreatorService = require('./symbolCreatorService');
          const callSymbolData = symbolCreatorService.getSymbolForStrikeType(indexKey, strikeType, atmStrike, 'CE');
          const putSymbolData = symbolCreatorService.getSymbolForStrikeType(indexKey, strikeType, atmStrike, 'PE');
          
          const expiry = this.calculateExpiry(indexKey);
          
          // Generate realistic option prices based on strike distance
          const actualCEStrike = callSymbolData ? callSymbolData.strike : strikes.ceStrike;
          const actualPEStrike = putSymbolData ? putSymbolData.strike : strikes.peStrike;
          const strikeDiffCE = Math.abs(actualCEStrike - atmStrike);
          const strikeDiffPE = Math.abs(actualPEStrike - atmStrike);
          const isITM = strikeType.startsWith('ITM');
          const isOTM = strikeType.startsWith('OTM');
          
          let cePrice, pePrice;
          
          if (isITM) {
            // ITM CE: has intrinsic value + time value
            cePrice = Math.max(strikeDiffCE + 20, 10); // Intrinsic + time value
            // ITM PE: mostly time value (less than ATM)
            pePrice = Math.max(15 - strikeDiffPE * 0.2, 2);
          } else if (isOTM) {
            // OTM CE: mostly time value (less than ATM)
            cePrice = Math.max(15 - strikeDiffCE * 0.2, 2);
            // OTM PE: has intrinsic value + time value
            pePrice = Math.max(strikeDiffPE + 20, 10);
          } else {
            // Default estimation
            cePrice = Math.max(30 - strikeDiffCE * 0.3, 5);
            pePrice = Math.max(30 - strikeDiffPE * 0.3, 5);
          }
          
          const result = {
            indexKey,
            strikeType,
            strike: actualCEStrike, // Use actual strike from symbol creator
            atmStrike,
            ceStrike: actualCEStrike,
            peStrike: actualPEStrike,
            expiry: expiry,
            symbols: {
              call: callSymbolData ? callSymbolData.symbol : null,
              put: putSymbolData ? putSymbolData.symbol : null,
              strike: actualCEStrike,
              expiry: callSymbolData ? callSymbolData.expiryDisplay : expiry
            },
            ce: {
              ltp: parseFloat(cePrice.toFixed(2)),
              change: 0,
              changePercent: 0,
              volume: 1000, // Estimated volume
              openInterest: 5000, // Estimated OI
              bid: parseFloat((cePrice * 0.98).toFixed(2)),
              ask: parseFloat((cePrice * 1.02).toFixed(2)),
              type: 'CE'
            },
            pe: {
              ltp: parseFloat(pePrice.toFixed(2)),
              change: 0,
              changePercent: 0,
              volume: 1000, // Estimated volume
              openInterest: 5000, // Estimated OI
              bid: parseFloat((pePrice * 0.98).toFixed(2)),
              ask: parseFloat((pePrice * 1.02).toFixed(2)),
              type: 'PE'
            },
            pcr: {
              byVolume: '1.00',
              byOI: '1.00',
              byValue: (pePrice / cePrice).toFixed(2)
            },
            dataType: 'calculated',
            timestamp: new Date().toISOString(),
            note: `Generated ${strikeType} data from calculated ATM strike ${atmStrike} (CE: ${actualCEStrike}, PE: ${actualPEStrike})`
          };
          
          console.log(`✅ Generated ${strikeType} option data for ${indexKey} - ATM: ${atmStrike}, CE: ₹${cePrice}, PE: ₹${pePrice}`);
          return result;
          
        } catch (calculationError) {
          console.log(`⚠️ Could not calculate strikes for ${strikeType}:`, calculationError.message);
        }
        
        // Final fallback - should rarely reach here
        console.log(`❌ Unable to calculate ${strikeType} strikes for ${indexKey}`);
        return null;
      }
      
      throw new Error(`No stored option data found for ${indexKey} ${strikeType}`);
      
    } catch (error) {
      console.error(`❌ Error reading stored option data for ${indexKey} ${strikeType}:`, error);
      throw error;
    }
  }

  /**
   * Try to read specific strike data (for ITM/OTM strikes)
   */
  async tryReadSpecificStrikeData(indexKey, strikeType) {
    try {
      // Check if we have stored files for specific strikes
      const timestampService = require('./timestampService');
      const today = timestampService.getCurrentIST();
      const dateStr = today.toISOString().split('T')[0];
      
      const ceFile = path.join(this.dataDir, `${indexKey}_CE_${strikeType}_${dateStr}.csv`);
      const peFile = path.join(this.dataDir, `${indexKey}_PE_${strikeType}_${dateStr}.csv`);
      
      if (fs.existsSync(ceFile) && fs.existsSync(peFile)) {
        const ceData = await this.readOptionCSV(ceFile);
        const peData = await this.readOptionCSV(peFile);
        
        if (ceData.length > 0 && peData.length > 0) {
          // Return formatted data
          const latestCE = ceData[ceData.length - 1];
          const latestPE = peData[peData.length - 1];
          
          return {
            // ... format similar to getStoredOptionData
            dataType: 'historical',
            note: `Stored ${strikeType} data from ${dateStr}`
          };
        }
      }
      
      return null;
    } catch (error) {
      console.log(`⚠️ Could not read specific strike data for ${strikeType}:`, error.message);
      return null;
    }
  }

  /**
   * Read option CSV file
   */
  async readOptionCSV(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (error) => reject(error));
    });
  }

  /**
   * Get ATM strike from stored data or calculate it
   */
  async getATMStrikeFromStored(indexKey, date) {
    try {
      // Try to get from cache first
      const cacheKey = `${indexKey}_${date}`;
      if (this.atmCache.has(cacheKey)) {
        return this.atmCache.get(cacheKey).atmStrike;
      }
      
      // Calculate based on day's opening price
      const dayOpenPrice = await this.getDayOpenPrice(indexKey);
      if (dayOpenPrice) {
        const interval = this.strikeIntervals[indexKey] || 50;
        return Math.round(dayOpenPrice / interval) * interval;
      }
      
      // Default fallback
      const defaultStrikes = {
        'NIFTY': 25100,
        'BANKNIFTY': 53000,
        'FINNIFTY': 24500,
        'MIDCAPNIFTY': 13200,
        'SENSEX': 82000
      };
      
      return defaultStrikes[indexKey] || 25100;
    } catch (error) {
      console.error(`Error getting ATM strike for ${indexKey} ${date}:`, error);
      return 25100; // Safe default
    }
  }

  /**
   * Generate estimated strike data based on ATM data
   */
  generateEstimatedStrikeData(indexKey, strikeType, atmData) {
    try {
      console.log(`🔢 Generating estimated ${strikeType} data based on ATM for ${indexKey}`);
      
      const strikes = this.calculateStrikePrices(indexKey, atmData.atmStrike, strikeType);
      const expiry = this.calculateExpiry(indexKey);
      const symbols = this.generateOptionSymbols(indexKey, strikes.ceStrike, strikes.peStrike, expiry);
      
      // Calculate strike distance from ATM
      const ceStrikeDistance = strikes.ceStrike - atmData.atmStrike;
      const peStrikeDistance = atmData.atmStrike - strikes.peStrike;
      
      // Estimate option prices based on ATM prices and strike distance
      // This is a simplified Black-Scholes approximation
      const isITM = strikeType.startsWith('ITM');
      const strikeLevel = parseInt(strikeType.replace(/[A-Z]/g, '')) || 1;
      
      // Base prices from ATM data
      const atmCEPrice = atmData.ce.ltp || 50;
      const atmPEPrice = atmData.pe.ltp || 50;
      
      // Estimate prices based on moneyness
      let cePrice, pePrice;
      
      if (isITM) {
        // ITM options: intrinsic value + time value
        cePrice = Math.max(ceStrikeDistance + (atmCEPrice * 0.3), 5);
        pePrice = Math.max((atmPEPrice * 0.3) - peStrikeDistance, 1);
      } else {
        // OTM options: mainly time value
        cePrice = Math.max((atmCEPrice * 0.3) - ceStrikeDistance * 0.1, 1);
        pePrice = Math.max(peStrikeDistance + (atmPEPrice * 0.3), 5);
      }
      
      // Estimate volume and OI based on distance from ATM
      const volumeMultiplier = Math.max(0.3, 1 - (strikeLevel * 0.2));
      const estimatedVolume = Math.round((atmData.ce.volume + atmData.pe.volume) * volumeMultiplier / 2);
      const estimatedOI = Math.round((atmData.ce.openInterest + atmData.pe.openInterest) * volumeMultiplier / 2);
      
      const result = {
        indexKey,
        strikeType,
        atmStrike: atmData.atmStrike,
        ceStrike: strikes.ceStrike,
        peStrike: strikes.peStrike,
        expiry: expiry,
        symbols: symbols,
        ce: {
          ltp: parseFloat(cePrice.toFixed(2)),
          change: 0, // No change data available for estimation
          changePercent: 0,
          volume: estimatedVolume,
          openInterest: estimatedOI,
          bid: parseFloat((cePrice * 0.98).toFixed(2)),
          ask: parseFloat((cePrice * 1.02).toFixed(2)),
          type: 'CE'
        },
        pe: {
          ltp: parseFloat(pePrice.toFixed(2)),
          change: 0, // No change data available for estimation
          changePercent: 0,
          volume: estimatedVolume,
          openInterest: estimatedOI,
          bid: parseFloat((pePrice * 0.98).toFixed(2)),
          ask: parseFloat((pePrice * 1.02).toFixed(2)),
          type: 'PE'
        },
        pcr: {
          byVolume: '1.00', // Estimated
          byOI: '1.00', // Estimated
          byValue: (pePrice / cePrice).toFixed(2)
        },
        dataType: 'estimated',
        timestamp: new Date().toISOString(),
        note: `Estimated ${strikeType} data based on ATM prices (CE: ₹${atmCEPrice}, PE: ₹${atmPEPrice})`
      };
      
      console.log(`✅ Generated estimated ${strikeType} data - CE: ₹${cePrice}, PE: ₹${pePrice}`);
      return result;
      
    } catch (error) {
      console.error(`❌ Error generating estimated strike data for ${indexKey} ${strikeType}:`, error);
      throw error;
    }
  }

  /**
   * Generate mock option data when no stored data is available
   */
  generateMockOptionData(indexKey, strikeType) {
    try {
      // Default ATM strikes for each index
      const defaultStrikes = {
        'NIFTY': 25100,
        'BANKNIFTY': 53000,
        'FINNIFTY': 24500,
        'MIDCAPNIFTY': 13200,
        'SENSEX': 82000
      };
      
      const atmStrike = defaultStrikes[indexKey] || 25100;
      const strikes = this.calculateStrikePrices(indexKey, atmStrike, strikeType);
      const expiry = this.calculateExpiry(indexKey);
      const symbols = this.generateOptionSymbols(indexKey, strikes.ceStrike, strikes.peStrike, expiry);
      
      // Generate basic mock prices
      const strikeDiff = Math.abs(strikes.ceStrike - atmStrike);
      const isITM = strikeType.startsWith('ITM');
      
      const cePrice = isITM ? Math.max(strikeDiff * 0.8, 10) : Math.max(100 - strikeDiff * 0.1, 5);
      const pePrice = !isITM ? Math.max(strikeDiff * 0.8, 10) : Math.max(100 - strikeDiff * 0.1, 5);
      
      return {
        indexKey,
        strikeType,
        atmStrike,
        ceStrike: strikes.ceStrike,
        peStrike: strikes.peStrike,
        expiry: expiry,
        symbols: symbols,
        ce: {
          ltp: cePrice,
          change: 0,
          changePercent: 0,
          volume: 0,
          openInterest: 0,
          bid: cePrice * 0.95,
          ask: cePrice * 1.05,
          type: 'CE'
        },
        pe: {
          ltp: pePrice,
          change: 0,
          changePercent: 0,
          volume: 0,
          openInterest: 0,
          bid: pePrice * 0.95,
          ask: pePrice * 1.05,
          type: 'PE'
        },
        pcr: {
          byVolume: 'N/A',
          byOI: 'N/A',
          byValue: (pePrice / cePrice).toFixed(2)
        },
        dataType: 'mock',
        timestamp: new Date().toISOString(),
        note: `Mock ${strikeType} data - no historical data available`
      };
    } catch (error) {
      console.error(`Error generating mock data for ${indexKey} ${strikeType}:`, error);
      throw error;
    }
  }

  /**
   * Calculate PCR from stored data
   */
  calculatePCRFromStoredData(ceData, peData) {
    try {
      const ceVolume = parseFloat(ceData.volume || 0);
      const peVolume = parseFloat(peData.volume || 0);
      const cePrice = parseFloat(ceData.price || 0);
      const pePrice = parseFloat(peData.price || 0);
      
      return {
        byVolume: ceVolume > 0 ? (peVolume / ceVolume).toFixed(2) : 'N/A',
        byOI: 'N/A', // Not available in stored data
        byValue: cePrice > 0 ? (pePrice / cePrice).toFixed(2) : 'N/A'
      };
    } catch (error) {
      return {
        byVolume: 'N/A',
        byOI: 'N/A',
        byValue: 'N/A'
      };
    }
  }

  /**
   * Smart historical data fetcher for different strikes
   * Downloads and stores data if it doesn't exist
   */
  async ensureStrikeDataExists(indexKey, strikeType, appId, accessToken) {
    try {
      console.log(`🔍 Checking if ${strikeType} data exists for ${indexKey}`);
      
      // Check if we already have stored data for this strike
      try {
        const existingData = await this.getStoredOptionData(indexKey, strikeType);
        if (existingData) {
          console.log(`✅ ${strikeType} data already exists for ${indexKey}`);
          
          // Ensure cache is created even for existing data
          const localCacheService = require('./localCacheService');
          await localCacheService.storeMarketCloseData(indexKey, strikeType, existingData);
          console.log(`💾 Cached existing ${strikeType} data for ${indexKey}`);
          
          return true;
        }
      } catch (error) {
        console.log(`⚠️ No existing ${strikeType} data found, will fetch fresh data`);
      }
      
      // If no stored data exists, use smart option data which handles caching
      console.log(`📊 Fetching ${strikeType} options for ${indexKey}`);
      try {
        const smartData = await this.getSmartOptionData(indexKey, strikeType, appId, accessToken);
        
        if (smartData) {
          console.log(`✅ Successfully loaded stored ${strikeType} data for ${indexKey}`);
          return true;
        }
      } catch (fetchError) {
        console.error(`❌ Error fetching smart ${strikeType} data for ${indexKey}:`, fetchError);
        
        // Try fallback to stored data if available
        console.log(`🔄 Fallback: Using stored data for ${indexKey} ${strikeType}`);
        try {
          const fallbackData = await this.getStoredOptionData(indexKey, strikeType);
          if (fallbackData) {
            console.log(`✅ Using fallback stored data for ${indexKey} ${strikeType}`);
            
            // Ensure cache is created for fallback data too
            const localCacheService = require('./localCacheService');
            await localCacheService.storeMarketCloseData(indexKey, strikeType, fallbackData);
            console.log(`💾 Cached fallback ${strikeType} data for ${indexKey}`);
            
            return true;
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback also failed for ${indexKey} ${strikeType}:`, fallbackError);
        }
      }
      
      return false;
      
    } catch (error) {
      console.error(`❌ Error ensuring ${strikeType} data exists for ${indexKey}:`, error);
      return false;
    }
  }

  /**
   * Get live option quotes for real-time display (optimized for speed)
   * Used for 1-2 second updates during market open
   */
  async getLiveOptionQuotes(indexKey, appId, accessToken) {
    try {
      console.log(`⚡ Fetching live option quotes for ${indexKey}`);
      
      // Get ATM strike (should be cached)
      const atmData = await this.getATMStrike(indexKey, appId, accessToken);
      const { ceSymbol, peSymbol } = this.generateATMSymbols(indexKey, atmData.atmStrike, atmData.expiry);
      
      // Use getMarketDepth for fastest response
      const fyers = authService.getFyersInstance(appId, accessToken);
      const symbols = [ceSymbol, peSymbol];
      
      const response = await fyers.getMarketDepth({
        symbol: symbols,
        ohlcv_flag: 1
      });

      if (response && response.s === 'ok' && response.d) {
        const ceData = response.d[ceSymbol];
        const peData = response.d[peSymbol];

        if (!ceData || !peData) {
          console.log(`⚠️ Missing option data in response for ${indexKey}:`, {
            ceSymbol: ceSymbol,
            peSymbol: peSymbol,
            ceDataExists: !!ceData,
            peDataExists: !!peData,
            availableSymbols: Object.keys(response.d || {})
          });
          throw new Error(`Missing option data in response for ${indexKey}`);
        }

        // Process for live display (minimal processing for speed)
        const liveOptionData = {
          atmStrike: atmData.atmStrike,
          indexKey,
          timestamp: new Date().toISOString(),
          ce: {
            symbol: ceSymbol,
            ltp: parseFloat(ceData.ltp || ceData.lp || 0),
            change: parseFloat(ceData.ch || 0),
            changePercent: parseFloat(ceData.chp || 0),
            volume: parseFloat(ceData.v || ceData.volume || 0),
            bid: ceData.bids && ceData.bids[0] ? parseFloat(ceData.bids[0].price) : 0,
            ask: ceData.ask && ceData.ask[0] ? parseFloat(ceData.ask[0].price) : 0,
          },
          pe: {
            symbol: peSymbol,
            ltp: parseFloat(peData.ltp || peData.lp || 0),
            change: parseFloat(peData.ch || 0),
            changePercent: parseFloat(peData.chp || 0),
            volume: parseFloat(peData.v || peData.volume || 0),
            bid: peData.bids && peData.bids[0] ? parseFloat(peData.bids[0].price) : 0,
            ask: peData.ask && peData.ask[0] ? parseFloat(peData.ask[0].price) : 0,
          },
          pcr: this.calculatePCR(
            { volume: parseFloat(ceData.v || ceData.volume || 0) },
            { volume: parseFloat(peData.v || peData.volume || 0) }
          ),
          dataType: 'live',
          lastUpdated: new Date().toISOString()
        };

        // Store in cache for broadcasting (don't write to CSV every second)
        this.cacheLiveOptionData(indexKey, liveOptionData);
        
        console.log(`⚡ Live option quotes updated for ${indexKey}: CE=${liveOptionData.ce.ltp}, PE=${liveOptionData.pe.ltp}`);
        return liveOptionData;

      } else {
        throw new Error(`Invalid response from Fyers API for live quotes: ${JSON.stringify(response)}`);
      }

    } catch (error) {
      console.error(`❌ Error fetching live option quotes for ${indexKey}:`, error);
      
      // Return cached data if API fails
      const cachedData = this.getCachedLiveOptionData(indexKey);
      if (cachedData) {
        console.log(`🔄 Using cached live option data for ${indexKey}`);
        return cachedData;
      }
      
      throw error;
    }
  }

  /**
   * Get live option quotes for a specific strike (for WebSocket display only)
   */
  async getLiveOptionQuotesForStrike(indexKey, strikeType = 'ATM', appId, accessToken) {
    try {
      console.log(`⚡ Fetching live quotes for ${indexKey} ${strikeType} (display only)`);
      
      // Get ATM data first
      const atmData = await this.getATMStrike(indexKey, appId, accessToken);
      
      // Calculate strikes for the requested strike type
      const strikes = this.calculateStrikePrices(indexKey, atmData.atmStrike, strikeType);
      
      // Generate symbols for CE and PE
      const symbols = this.generateOptionSymbols(indexKey, strikes.ceStrike, strikes.peStrike, atmData.expiry);
      
      console.log(`📊 Live quotes symbols for ${indexKey} ${strikeType}: CE=${symbols.ceSymbol}, PE=${symbols.peSymbol}`);
      
      // Use getMarketDepth for fastest response
      const fyers = authService.getFyersInstance(appId, accessToken);
      const symbolList = [symbols.ceSymbol, symbols.peSymbol];
      
      const response = await fyers.getMarketDepth({
        symbol: symbolList,
        ohlcv_flag: 1
      });

      if (response && response.s === 'ok' && response.d) {
        const ceData = response.d[symbols.ceSymbol];
        const peData = response.d[symbols.peSymbol];

        if (!ceData || !peData) {
          console.log(`⚠️ Missing option data for ${indexKey} ${strikeType}:`, {
            ceSymbol: symbols.ceSymbol,
            peSymbol: symbols.peSymbol,
            ceDataExists: !!ceData,
            peDataExists: !!peData,
            availableSymbols: Object.keys(response.d || {})
          });
          throw new Error(`Missing option data for ${indexKey} ${strikeType}`);
        }

        // Process for live display (minimal processing for speed)
        const liveOptionData = {
          indexKey,
          strikeType,
          ceStrike: strikes.ceStrike,
          peStrike: strikes.peStrike,
          timestamp: new Date().toISOString(),
          ce: {
            symbol: symbols.ceSymbol,
            strike: strikes.ceStrike,
            ltp: parseFloat(ceData.ltp || ceData.lp || 0),
            change: parseFloat(ceData.ch || 0),
            changePercent: parseFloat(ceData.chp || 0),
            volume: parseFloat(ceData.v || ceData.volume || 0),
            oi: parseFloat(ceData.oi || ceData.openInterest || 0),
            bid: ceData.bids && ceData.bids[0] ? parseFloat(ceData.bids[0].price) : 0,
            ask: ceData.ask && ceData.ask[0] ? parseFloat(ceData.ask[0].price) : 0,
          },
          pe: {
            symbol: symbols.peSymbol,
            strike: strikes.peStrike,
            ltp: parseFloat(peData.ltp || peData.lp || 0),
            change: parseFloat(peData.ch || 0),
            changePercent: parseFloat(peData.chp || 0),
            volume: parseFloat(peData.v || peData.volume || 0),
            oi: parseFloat(peData.oi || peData.openInterest || 0),
            bid: peData.bids && peData.bids[0] ? parseFloat(peData.bids[0].price) : 0,
            ask: peData.ask && peData.ask[0] ? parseFloat(peData.ask[0].price) : 0,
          },
          pcr: this.calculatePCR(
            { volume: parseFloat(ceData.v || ceData.volume || 0) },
            { volume: parseFloat(peData.v || peData.volume || 0) }
          ),
          dataType: 'live-strike',
          lastUpdated: new Date().toISOString()
        };

        // Cache in memory only (no CSV storage for live WebSocket data)
        this.cacheLiveOptionData(`${indexKey}_${strikeType}`, liveOptionData);
        
        console.log(`⚡ Live quotes updated for ${indexKey} ${strikeType}: CE=${liveOptionData.ce.ltp}, PE=${liveOptionData.pe.ltp}`);
        return liveOptionData;

      } else {
        throw new Error(`Invalid response from Fyers API for live quotes: ${JSON.stringify(response)}`);
      }

    } catch (error) {
      console.error(`❌ Error fetching live quotes for ${indexKey} ${strikeType}:`, error);
      
      // Return cached data if API fails
      const cachedData = this.getCachedLiveOptionData(`${indexKey}_${strikeType}`);
      if (cachedData) {
        console.log(`🔄 Using cached live data for ${indexKey} ${strikeType}`);
        return cachedData;
      }
      
      throw error;
    }
  }

  /**
   * Cache live option data in memory (not persisted to disk)
   */
  cacheLiveOptionData(indexKey, data) {
    if (!this.liveDataCache) {
      this.liveDataCache = new Map();
    }
    
    this.liveDataCache.set(indexKey, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Get cached live option data
   */
  getCachedLiveOptionData(indexKey) {
    if (!this.liveDataCache) {
      return null;
    }
    
    const cached = this.liveDataCache.get(indexKey);
    if (cached && (Date.now() - cached.timestamp) < 30000) { // 30 seconds cache validity
      return cached.data;
    }
    
    return null;
  }

  /**
   * DISABLED: Store minute-level option data to CSV (called separately from live quotes)
   * This functionality moved to Historical API service
   */
  async storeMinuteLevelOptionData(indexKey, appId, accessToken) {
    // DISABLED: Data storage moved to Historical API service
    // Only Historical API service should store data to CSV files
    console.log(`📊 Minute-level option data storage disabled for ${indexKey} - handled by Historical API`);
    return true;
  }

  /**
   * Validate and ensure option historical data for a specific strike
   */
  async validateAndEnsureOptionHistoricalData(indexKey, strikeType, appId, accessToken, targetEndTime = null) {
    try {
      console.log(`🔍 Validating option historical data for ${indexKey} ${strikeType}`);
      
      // Use the unified historic API service for all data types
      const marketDataService = require('./marketDataService');
      
      // Start the option data collection which will handle gap filling
      const result = await marketDataService.startOptionDataCollection(indexKey, strikeType, appId, accessToken);
      
      if (result.success) {
        console.log(`✅ Option historical data validation completed for ${indexKey} ${strikeType}`);
        console.log(`📊 Symbols: CE=${result.symbols?.call}, PE=${result.symbols?.put}`);
        return result;
      } else {
        throw new Error(result.error || 'Failed to start option data collection');
      }
      
    } catch (error) {
      console.error(`❌ Error validating option historical data for ${indexKey} ${strikeType}:`, error);
      throw error;
    }
  }

  /**
   * REMOVED: No mock data generation for trading application
   * All data must be real from Fyers API or stored historical data
   */

  /**
   * Get latest market data from storage (without API calls)
   */
  getLatestMarketDataFromStorage(indexKey) {
    try {
      const fs = require('fs');
      const path = require('path');
      const dataDir = path.join(__dirname, '../data');
      
      // Find the most recent date with data
      const today = new Date().toISOString().split('T')[0];
      const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
      
      // Try today first, then yesterday
      let csvFile = path.join(dataDir, `${indexKey}_INDEX_${today}.csv`);
      if (!fs.existsSync(csvFile)) {
        csvFile = path.join(dataDir, `${indexKey}_INDEX_${yesterday}.csv`);
      }
      
      if (!fs.existsSync(csvFile)) {
        console.log(`📄 No recent market data files found for ${indexKey}`);
        return null;
      }
      
      // Read the last line of the CSV file to get the latest data
      const data = fs.readFileSync(csvFile, 'utf8');
      const lines = data.trim().split('\n');
      if (lines.length < 2) {
        return null;
      }
      
      const lastLine = lines[lines.length - 1];
      const values = lastLine.split(',');
      
      // Assuming CSV format: timestamp,open,high,low,close,volume
      return {
        price: parseFloat(values[4] || values[1]), // close or open
        timestamp: values[0]
      };
    } catch (error) {
      console.error(`❌ Error getting latest market data from storage for ${indexKey}:`, error);
      return null;
    }
  }

  /**
   * Round a price to the nearest strike interval for an index
   */
  roundToNearestStrikeInterval(price, indexKey) {
    // Get the strike interval for this index
    let interval = 50; // Default for NIFTY
    
    if (indexKey === 'NIFTYBANK' || indexKey === 'BANKNIFTY') {
      interval = 100;
    } else if (indexKey === 'SENSEX') {
      interval = 100;
    } else if (indexKey === 'FINNIFTY') {
      interval = 50;
    } else if (indexKey === 'MIDCPNIFTY') {
      interval = 25;
    }
    
    // Round to the nearest interval
    return Math.round(price / interval) * interval;
  }

}

module.exports = new OptionService();