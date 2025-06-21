const fs = require('fs');
const path = require('path');

class LocalCacheService {
  constructor() {
    this.cacheDir = path.join(__dirname, '../data/cache');
    this.ensureCacheDirectory();
  }

  ensureCacheDirectory() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log('📁 Created cache directory');
    }
  }

  /**
   * Store market close data for quick access during market closed hours
   * @param {string} indexKey - Index symbol (NIFTY, BANKNIFTY, etc.)
   * @param {string} strikeType - Strike type (ATM, ITM1, OTM1, etc.)
   * @param {object} data - Market data to cache
   */
  async storeMarketCloseData(indexKey, strikeType, data) {
    try {
      const timestampService = require('./timestampService');
      const currentTime = timestampService.getCurrentIST();
      const dateString = currentTime.toISOString().split('T')[0];
      
      const cacheKey = `${indexKey}_${strikeType}_${dateString}`;
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      const cacheData = {
        indexKey,
        strikeType,
        data,
        timestamp: currentTime.toISOString(),
        marketCloseTime: this.getMarketCloseTime(currentTime),
        isMarketCloseData: true
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      console.log(`💾 Cached market close data: ${cacheKey}`);
      
      return true;
    } catch (error) {
      console.error('❌ Error storing market close data:', error);
      return false;
    }
  }

  /**
   * Get cached market close data
   * @param {string} indexKey - Index symbol
   * @param {string} strikeType - Strike type
   * @returns {object|null} Cached data or null if not found
   */
  async getMarketCloseData(indexKey, strikeType) {
    try {
      const timestampService = require('./timestampService');
      const currentTime = timestampService.getCurrentIST();
      const dateString = currentTime.toISOString().split('T')[0];
      const lastMarketDay = timestampService.getLastMarketDay();
      const lastMarketDate = lastMarketDay.toISOString().split('T')[0];
      
      // Try today's cache first
      let cacheKey = `${indexKey}_${strikeType}_${dateString}`;
      let cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (this.isCacheValid(cacheData, currentTime)) {
          console.log(`✅ Using cached market close data: ${cacheKey}`);
          return cacheData.data;
        }
      }
      
      // Try last market day cache
      if (lastMarketDate !== dateString) {
        cacheKey = `${indexKey}_${strikeType}_${lastMarketDate}`;
        cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
        
        if (fs.existsSync(cacheFile)) {
          const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          if (this.isCacheValid(cacheData, currentTime)) {
            console.log(`✅ Using cached market close data from last market day: ${cacheKey}`);
            return cacheData.data;
          }
        }
      }
      
      console.log(`📂 No valid cache found for ${indexKey} ${strikeType}`);
      return null;
    } catch (error) {
      console.error('❌ Error reading market close data:', error);
      return null;
    }
  }

  /**
   * Store websocket data during market hours for later use
   * @param {string} indexKey - Index symbol
   * @param {string} strikeType - Strike type
   * @param {object} data - Live websocket data
   */
  async storeWebsocketData(indexKey, strikeType, data) {
    try {
      const timestampService = require('./timestampService');
      const currentTime = timestampService.getCurrentIST();
      
      // Only store if market is open
      if (!timestampService.isMarketOpen()) {
        return false;
      }
      
      const dateString = currentTime.toISOString().split('T')[0];
      const cacheKey = `${indexKey}_${strikeType}_websocket_${dateString}`;
      const cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      const cacheData = {
        indexKey,
        strikeType,
        data,
        timestamp: currentTime.toISOString(),
        isWebsocketData: true,
        marketTime: this.formatMarketTime(currentTime)
      };
      
      fs.writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2));
      console.log(`📡 Cached websocket data: ${cacheKey} at ${cacheData.marketTime}`);
      
      return true;
    } catch (error) {
      console.error('❌ Error storing websocket data:', error);
      return false;
    }
  }

  /**
   * Check if we should fetch new data or use cache
   * @param {string} indexKey - Index symbol
   * @param {string} strikeType - Strike type
   * @returns {boolean} True if should fetch new data
   */
  async shouldFetchNewData(indexKey, strikeType) {
    try {
      const timestampService = require('./timestampService');
      const currentTime = timestampService.getCurrentIST();
      const isMarketOpen = timestampService.isMarketOpen();
      
      if (isMarketOpen) {
        // Market is open - always fetch new data
        return true;
      }
      
      // Market is closed - check if we have recent cache
      const dateString = currentTime.toISOString().split('T')[0];
      const lastMarketDay = timestampService.getLastMarketDay();
      const lastMarketDate = lastMarketDay.toISOString().split('T')[0];
      
      // Check cache for today first
      let cacheKey = `${indexKey}_${strikeType}_${dateString}`;
      let cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
      
      if (fs.existsSync(cacheFile)) {
        const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
        if (this.isCacheValid(cacheData, currentTime)) {
          console.log(`📂 Using existing cache for ${cacheKey} - no need to fetch`);
          return false;
        }
      }
      
      // Check cache for last market day
      if (lastMarketDate !== dateString) {
        cacheKey = `${indexKey}_${strikeType}_${lastMarketDate}`;
        cacheFile = path.join(this.cacheDir, `${cacheKey}.json`);
        
        if (fs.existsSync(cacheFile)) {
          const cacheData = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
          if (this.isCacheValid(cacheData, currentTime)) {
            console.log(`📂 Using existing cache from last market day for ${cacheKey} - no need to fetch`);
            return false;
          }
        }
      }
      
      // No valid cache found - need to fetch
      console.log(`🔄 No valid cache for ${indexKey} ${strikeType} - need to fetch`);
      return true;
    } catch (error) {
      console.error('❌ Error checking cache validity:', error);
      return true; // Default to fetching on error
    }
  }

  /**
   * Generic get method for backward compatibility
   * @param {string} cacheKey - Cache key in format "indexKey_strikeType"
   * @returns {object|null} Cached data or null if not found
   */
  async get(cacheKey) {
    try {
      const [indexKey, strikeType] = cacheKey.split('_');
      if (!indexKey || !strikeType) {
        console.log(`❌ Invalid cache key format: ${cacheKey}`);
        return null;
      }
      
      return await this.getMarketCloseData(indexKey, strikeType);
    } catch (error) {
      console.error(`❌ Error getting cache for key ${cacheKey}:`, error);
      return null;
    }
  }

  /**
   * Generic set method for backward compatibility
   * @param {string} cacheKey - Cache key in format "indexKey_strikeType"
   * @param {object} data - Data to cache
   * @returns {boolean} Success status
   */
  async set(cacheKey, data) {
    try {
      const [indexKey, strikeType] = cacheKey.split('_');
      if (!indexKey || !strikeType) {
        console.log(`❌ Invalid cache key format: ${cacheKey}`);
        return false;
      }
      
      return await this.storeMarketCloseData(indexKey, strikeType, data);
    } catch (error) {
      console.error(`❌ Error setting cache for key ${cacheKey}:`, error);
      return false;
    }
  }

  /**
   * Clean up cache files from previous days
   */
  async cleanupOldCache() {
    try {
      const timestampService = require('./timestampService');
      const currentTime = timestampService.getCurrentIST();
      const currentDate = currentTime.toISOString().split('T')[0];
      
      const files = fs.readdirSync(this.cacheDir);
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.cacheDir, file);
          
          // Extract date from filename or check file modification time
          const stats = fs.statSync(filePath);
          const fileDate = stats.mtime.toISOString().split('T')[0];
          
          if (fileDate < currentDate) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`🗑️ Deleted old cache file: ${file}`);
          }
        }
      }
      
      console.log(`✅ Cache cleanup completed: ${deletedCount} files deleted`);
      return deletedCount;
    } catch (error) {
      console.error('❌ Error cleaning up cache:', error);
      return 0;
    }
  }

  /**
   * Get market close time for a given date
   */
  getMarketCloseTime(date) {
    const marketClose = new Date(date);
    marketClose.setHours(15, 30, 0, 0);
    return marketClose.toISOString();
  }

  /**
   * Format market time for display
   */
  formatMarketTime(date) {
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid(cacheData, currentTime) {
    try {
      const cacheTime = new Date(cacheData.timestamp);
      const currentDate = currentTime.toISOString().split('T')[0];
      const cacheDate = cacheTime.toISOString().split('T')[0];
      
      // Get the last market day
      const timestampService = require('./timestampService');
      const lastMarketDay = timestampService.getLastMarketDay();
      const lastMarketDate = lastMarketDay.toISOString().split('T')[0];
      
      // Cache is valid if:
      // 1. It's from today and after market close (3:30 PM), OR
      // 2. It's from the last market day and after market close
      if (cacheDate === currentDate) {
        const marketCloseTime = new Date(currentTime);
        marketCloseTime.setHours(15, 30, 0, 0);
        return cacheTime >= marketCloseTime;
      } else if (cacheDate === lastMarketDate) {
        const marketCloseTime = new Date(cacheTime);
        marketCloseTime.setHours(15, 30, 0, 0);
        return cacheTime >= marketCloseTime;
      }
      
      return false;
    } catch (error) {
      console.error('❌ Error validating cache:', error);
      return false;
    }
  }

  /**
   * Get cache status for debugging
   */
  async getCacheStatus() {
    try {
      const files = fs.readdirSync(this.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      
      const status = {
        totalFiles: cacheFiles.length,
        files: cacheFiles.map(file => {
          const filePath = path.join(this.cacheDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            size: stats.size,
            modified: stats.mtime.toISOString()
          };
        })
      };
      
      return status;
    } catch (error) {
      console.error('❌ Error getting cache status:', error);
      return { totalFiles: 0, files: [], error: error.message };
    }
  }
}

module.exports = new LocalCacheService(); 