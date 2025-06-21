const authService = require('./authService');
const storageService = require('./storageService');
const symbolConfig = require('../config/symbolConfig');

class MarketService {
  constructor() {
    this.marketDataCache = new Map();
    this.premiumHistory = new Map();
    this.cacheTimeout = 15000; // 15 seconds cache to allow fresh timestamps while respecting API limits
    this.lastApiCall = 0;
    this.apiCallMinInterval = 10000; // Minimum 10 seconds between API calls
    this.lastOptionDataCall = 0; // Track option data calls separately
    this.optionDataInterval = 30000; // 30 seconds for option data
    this.lastLiveOptionData = new Map(); // Cache last successful live option data
  }

  /**
   * Get available indices
   */
  getAvailableIndices() {
    return symbolConfig.getAvailableIndices();
  }

  /**
   * Get symbol configuration for an index
   */
  getIndexConfig(indexKey) {
    return symbolConfig.getSymbolConfig(indexKey);
  }

  /**
   * Get market data for specified index
   * @param {string} appId - Fyers App ID
   * @param {string} accessToken - Access token
   * @param {string} indexKey - Index key (NIFTY, BANKNIFTY, etc.)
   */
  async getMarketData(appId, accessToken, indexKey = symbolConfig.DEFAULT_INDEX) {
    const cacheKey = `${appId}_${indexKey}`;
    const cached = this.marketDataCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }

    // Rate limiting: ensure minimum interval between API calls
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCall;
    if (timeSinceLastCall < this.apiCallMinInterval) {
      console.log(`Rate limiting: waiting ${this.apiCallMinInterval - timeSinceLastCall}ms before API call`);
      await new Promise(resolve => setTimeout(resolve, this.apiCallMinInterval - timeSinceLastCall));
    }

    try {
      const fyers = authService.getFyersInstance(appId, accessToken);
      const config = symbolConfig.getSymbolConfig(indexKey);
      
      // Update last API call time
      this.lastApiCall = Date.now();

      // Fetch spot and futures data using getMarketDepth (more reliable than getQuotes)
      const symbols = symbolConfig.getMarketDepthSymbols(indexKey);
      console.log('Fetching market depth for symbols:', symbols);
      
      const response = await fyers.getMarketDepth({
        symbol: symbols,
        ohlcv_flag: 1
      });

      console.log('Market data response:', JSON.stringify(response, null, 2));

      if (response && response.s === 'ok' && response.d) {
        const spotData = response.d[config.index];
        const futuresData = response.d[config.futures];

        if (!spotData || !futuresData) {
          console.log('Available symbols in response:', Object.keys(response.d));
          throw new Error('Incomplete market data received');
        }

        const marketData = this.processMarketData(spotData, futuresData, config, indexKey);
        
        // Option data will be handled separately to avoid circular dependency
        marketData.optionData = null;
        
        // Cache the data
        this.marketDataCache.set(cacheKey, {
          data: marketData,
          timestamp: Date.now()
        });

        // Store premium history
        this.storePremiumHistory(cacheKey, marketData.premiumAnalysis);

        return marketData;
      } else {
        throw new Error('Failed to fetch market data from Fyers API');
      }
    } catch (error) {
      console.error('Market data fetch error:', error);
      throw error;
    }
  }

  /**
   * Process raw market data into structured format
   */
  processMarketData(spotData, futuresData, config, indexKey) {
    // Handle getMarketDepth response format (different from getQuotes)
    const spot = {
      price: parseFloat(spotData.ltp || spotData.lp || spotData.v?.lp || 0),
      change: parseFloat(spotData.ch || spotData.v?.ch || 0),
      changePercent: parseFloat(spotData.chp || spotData.v?.chp || 0),
      volume: parseFloat(spotData.v || spotData.volume || 0),
      dayHigh: parseFloat(spotData.h || spotData.high || spotData.v?.h || 0),
      dayLow: parseFloat(spotData.l || spotData.low || spotData.v?.l || 0),
      dayRange: `${parseFloat(spotData.l || spotData.low || spotData.v?.l || 0)} - ${parseFloat(spotData.h || spotData.high || spotData.v?.h || 0)}`
    };

    const futures = {
      price: parseFloat(futuresData.ltp || futuresData.lp || futuresData.v?.lp || 0),
      change: parseFloat(futuresData.ch || futuresData.v?.ch || 0),
      changePercent: parseFloat(futuresData.chp || futuresData.v?.chp || 0),
      volume: parseFloat(futuresData.v || futuresData.volume || 0),
      openInterest: parseFloat(futuresData.oi || futuresData.v?.oi || 0)
    };

    const premiumValue = futures.price - spot.price;
    const premiumPercent = spot.price > 0 ? (premiumValue / spot.price) * 100 : 0;

    const premiumAnalysis = {
      premiumValue: parseFloat(premiumValue.toFixed(2)),
      premiumPercent: parseFloat(premiumPercent.toFixed(4)),
      volumeStrength: this.calculateVolumeStrength(futures.volume, spot.volume),
      trend: this.calculatePremiumTrend(config.key + '_premium', premiumPercent)
    };

    // DISABLED: Data storage moved to Historical API service
    // Only Historical API service should store data to CSV files
    // storageService.storeIndexData(indexKey, spot);
    // storageService.storeFuturesData(indexKey, futures);

    // Get actual market data timestamp from the API response
    // Use the last trade time from futures data, or smart timestamp if not available
    const timestampService = require('./timestampService');
    let actualTimestamp = timestampService.formatTimestampForStorage(timestampService.getCurrentIST());
    
    if (futuresData.ltt && futuresData.ltt > 0) {
      // ltt is epoch timestamp in seconds, convert directly to IST
      const date = new Date(futuresData.ltt * 1000);
      // Format as IST using toLocaleString and then convert to ISO format
      const istTime = date.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
      actualTimestamp = istTime.replace(' ', 'T') + '.000+05:30';
    } else if (spotData.ltt && spotData.ltt > 0) {
      // ltt is epoch timestamp in seconds, convert directly to IST
      const date = new Date(spotData.ltt * 1000);
      // Format as IST using toLocaleString and then convert to ISO format
      const istTime = date.toLocaleString('sv-SE', { timeZone: 'Asia/Kolkata' });
      actualTimestamp = istTime.replace(' ', 'T') + '.000+05:30';
    }

    return {
      index: config,
      spot,
      futures,
      premiumAnalysis,
      lastUpdated: actualTimestamp
    };
  }

  /**
   * Calculate volume strength
   */
  calculateVolumeStrength(futuresVolume, spotVolume) {
    if (spotVolume === 0) return 'N/A';
    
    const ratio = futuresVolume / spotVolume;
    if (ratio > 2) return 'Very High';
    if (ratio > 1.5) return 'High';
    if (ratio > 1) return 'Moderate';
    if (ratio > 0.5) return 'Low';
    return 'Very Low';
  }

  /**
   * Calculate premium trend
   */
  calculatePremiumTrend(key, currentPercent) {
    const history = this.premiumHistory.get(key) || [];
    
    if (history.length === 0) {
      return { direction: 'Neutral', duration: 'N/A' };
    }

    // Find trend direction and duration
    let trendStart = history.length - 1;
    const isUptrend = currentPercent > history[history.length - 1].percent;
    
    for (let i = history.length - 1; i >= 0; i--) {
      const prevIsUp = i === 0 ? isUptrend : history[i].percent > history[i - 1].percent;
      if (prevIsUp !== isUptrend) {
        trendStart = i;
        break;
      }
    }

    const duration = history.length - trendStart;
    const direction = isUptrend ? 'Uptrend' : 'Downtrend';
    
    return {
      direction,
      duration: `${duration} min ago`,
      percentHistory: history.slice(-6).map(h => ({
        timeAgo: `${Math.floor((Date.now() - h.timestamp) / 60000)} min ago`,
        percent: h.percent
      }))
    };
  }

  /**
   * Store premium history for trend analysis
   */
  storePremiumHistory(key, premiumAnalysis) {
    const historyKey = key + '_premium';
    let history = this.premiumHistory.get(historyKey) || [];
    
    history.push({
      timestamp: Date.now(),
      percent: premiumAnalysis.premiumPercent
    });

    // Keep only last 60 minutes of data (assuming 1-minute intervals)
    if (history.length > 60) {
      history = history.slice(-60);
    }

    this.premiumHistory.set(historyKey, history);
  }

  /**
   * Get premium history for a user
   */
  async getPremiumHistory(appId, accessToken, indexKey = symbolConfig.DEFAULT_INDEX) {
    const historyKey = `${appId}_${indexKey}_premium`;
    const history = this.premiumHistory.get(historyKey) || [];
    
    return {
      current: indexKey,
      history: history.slice(-60).map(h => ({
        timestamp: h.timestamp,
        percent: h.percent,
        timeAgo: `${Math.floor((Date.now() - h.timestamp) / 60000)} min ago`
      }))
    };
  }

  /**
   * Calculate ATM strike price (simplified - can be enhanced per index if needed)
   */
  calculateATMStrike(ltp, indexKey = symbolConfig.DEFAULT_INDEX) {
    // Default strike interval - can be made configurable per index in symbol config if needed
    const interval = indexKey === 'BANKNIFTY' ? 100 : 50;
    return Math.round(ltp / interval) * interval;
  }

  /**
   * Get expiry date for options (simplified - can be enhanced per index if needed)
   */
  getExpiryDate(indexKey = symbolConfig.DEFAULT_INDEX) {
    // Default to next Thursday for most indices
    // Can be made configurable per index in symbol config if needed
    switch (indexKey) {
      case 'BANKNIFTY':
        return this.getLastWeekdayInMonth(4); // Last Thursday
      case 'FINNIFTY':
        return this.getLastWeekdayInMonth(2); // Last Tuesday
      default:
        return this.getNextWeekdayInMonth(4); // Next Thursday
    }
  }

  /**
   * Get next occurrence of a weekday
   */
  getNextWeekdayInMonth(weekday) {
    const now = new Date();
    const today = now.getDate();
    
    // Find all occurrences of the weekday in current month
    const dates = [];
    for (let day = 1; day <= 31; day++) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      if (date.getMonth() !== now.getMonth()) break;
      if (date.getDay() === weekday) {
        dates.push(day);
      }
    }
    
    // Find next occurrence
    const nextDate = dates.find(day => day >= today);
    return (nextDate || dates[0]).toString().padStart(2, '0');
  }

  /**
   * Get last occurrence of a weekday in current month
   */
  getLastWeekdayInMonth(weekday) {
    const now = new Date();
    const dates = [];
    
    for (let day = 1; day <= 31; day++) {
      const date = new Date(now.getFullYear(), now.getMonth(), day);
      if (date.getMonth() !== now.getMonth()) break;
      if (date.getDay() === weekday) {
        dates.push(day);
      }
    }
    
    return dates[dates.length - 1].toString().padStart(2, '0');
  }

  // Option data methods removed to prevent circular dependency with optionService

  // getClosingOptionData method removed to prevent circular dependency with optionService

  /**
   * Calculate Put-Call Ratio (PCR)
   */
  calculatePCR(ceData, peData) {
    const ceOI = parseFloat(ceData.openInterest || ceData.oi || 0);
    const peOI = parseFloat(peData.openInterest || peData.oi || 0);
    
    if (ceOI === 0) return 0;
    return parseFloat((peOI / ceOI).toFixed(4));
  }
}

module.exports = new MarketService(); 