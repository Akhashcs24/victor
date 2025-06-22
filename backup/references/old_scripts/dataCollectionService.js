const authService = require('./authService');
const storageService = require('./storageService');
const marketDataService = require('./marketDataService');
const symbolConfig = require('../config/symbolConfig');

class DataCollectionService {
  constructor() {
    this.activeIndices = new Set(); // Track which indices are being monitored
    this.collectionIntervals = new Map(); // Store interval IDs for each index
    this.isCollecting = false;
    this.storedCredentials = null; // Store Fyers credentials
    this.storageService = storageService; // Initialize storage service
    this.lastOptionDataCollection = new Map(); // Track last option data collection time per index
  }

  // Start collecting data for a specific index using Historical API approach
  async startDataCollection(indexSymbol, appId = null, accessToken = null) {
    try {
      console.log(`🚀 Data collection starting for ${indexSymbol}...`);
      
      // Store credentials if provided
      if (appId && accessToken) {
        this.storedCredentials = { appId, accessToken };
      }

      if (!this.storedCredentials || !this.storedCredentials.appId || !this.storedCredentials.accessToken) {
        throw new Error('No credentials available for data collection');
      }
      
      // Add to active indices
      this.activeIndices.add(indexSymbol);
      
      // Initialize Market Data Service
      marketDataService.setCredentials(this.storedCredentials.appId, this.storedCredentials.accessToken);
      
      // Start data collection with Historical API
      const isMarketOpen = marketDataService.isMarketCurrentlyOpen();
      
      // Set up interval for data collection (every minute)
      const intervalId = setInterval(async () => {
        if (marketDataService.isMarketCurrentlyOpen()) {
          await marketDataService.collectCurrentIndexMinuteData(indexSymbol, '1min');
          
          // Collect option data only once per minute to avoid excessive API calls
          const now = Date.now();
          const lastCollection = this.lastOptionDataCollection.get(indexSymbol) || 0;
          const timeSinceLastCollection = now - lastCollection;
          
          // Collect option data every 60 seconds (1 minute)
          if (timeSinceLastCollection >= 60000) {
            try {
              const optionService = require('./optionService');
              await optionService.getATMOptionData(indexSymbol, this.storedCredentials.appId, this.storedCredentials.accessToken);
              this.lastOptionDataCollection.set(indexSymbol, now);
              console.log(`📈 Option data collected for ${indexSymbol}`);
            } catch (optionError) {
              console.log(`⚠️ Option data collection failed for ${indexSymbol}:`, optionError.message);
            }
          }
        }
      }, 60000); // Check every minute
      
      this.collectionIntervals.set(indexSymbol, intervalId);

      console.log(`✅ Data collection active for ${indexSymbol} (Market open: ${isMarketOpen})`);
      
      return {
        success: true,
        message: `Data collection initialized for ${indexSymbol}`,
        mode: isMarketOpen ? 'live' : 'historical',
        marketOpen: isMarketOpen,
        apiUsage: marketDataService.getUsageStats()
      };
      
    } catch (error) {
      console.error(`❌ Error starting data collection for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Stop collecting data for a specific index
  async stopDataCollection(indexSymbol) {
    try {
      console.log(`⏹️ Stopping data collection for ${indexSymbol}`);
      
      // Remove from active indices
      this.activeIndices.delete(indexSymbol);
      
      // Clear intervals
      if (this.collectionIntervals.has(indexSymbol)) {
        clearInterval(this.collectionIntervals.get(indexSymbol));
        this.collectionIntervals.delete(indexSymbol);
      }
      
      return { 
        success: true, 
        message: `Data collection stopped for ${indexSymbol}`,
        apiUsage: marketDataService.getUsageStats()
      };
    } catch (error) {
      console.error(`❌ Error stopping data collection for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Collect a single data point for an index
  async collectSingleDataPoint(indexSymbol, appId = null, accessToken = null) {
    try {
      // Skip if markets are closed (basic check - 9:15 AM to 3:30 PM IST on weekdays)
      if (!this.isMarketTime()) {
        return { success: false, message: 'Market is closed' };
      }

      // Use stored credentials if not provided
      if (!appId || !accessToken) {
        if (!this.storedCredentials || !this.storedCredentials.appId || !this.storedCredentials.accessToken) {
          console.log(`⚠️ No credentials available for ${indexSymbol} data collection`);
          return { success: false, message: 'No credentials available' };
        }
        appId = this.storedCredentials.appId;
        accessToken = this.storedCredentials.accessToken;
      }

      const marketDataResponse = await this.getMarketDataForSymbols(indexSymbol, appId, accessToken);
      
      if (!marketDataResponse || !marketDataResponse.spot || !marketDataResponse.futures) {
        console.log(`⚠️ No data available for ${indexSymbol}`);
        return { success: false, message: 'No data available' };
      }

      const { spot: spotData, futures: futuresData } = marketDataResponse;

      const marketData = {
        spot: {
          price: parseFloat(spotData.ltp || spotData.lp || spotData.v?.lp || 0),
          change: parseFloat(spotData.ch || spotData.v?.ch || 0),
          changePercent: parseFloat(spotData.chp || spotData.v?.chp || 0),
          volume: parseFloat(spotData.volume || spotData.v?.volume || 0)
        },
        futures: {
          price: parseFloat(futuresData.ltp || futuresData.lp || futuresData.v?.lp || 0),
          change: parseFloat(futuresData.ch || futuresData.v?.ch || 0),
          changePercent: parseFloat(futuresData.chp || futuresData.v?.chp || 0),
          openInterest: parseFloat(futuresData.oi || futuresData.v?.oi || 0)
        }
      };

      // DISABLED: Data storage moved to Historical API service
      // Only Historical API service should store data to CSV files
      // const result = await storageService.storeMarketData(indexSymbol, marketData);
      
      console.log(`📊 Data collected for ${indexSymbol}: Spot=${marketData.spot.price}, Futures=${marketData.futures.price} (display only)`);
      
      return { success: true, message: 'Data collection completed (storage handled by Historical API)' };
    } catch (error) {
      console.error(`❌ Error collecting data point for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get market data from Fyers API
  async getMarketDataForSymbols(indexSymbol, appId, accessToken) {
    try {
      const fyers = authService.getFyersInstance(appId, accessToken);
      const spotSymbol = this.getSpotSymbol(indexSymbol);
      const futuresSymbol = this.getFuturesSymbol(indexSymbol);
      
      const symbols = [spotSymbol, futuresSymbol];
      console.log(`Fetching market data for ${indexSymbol}:`, symbols);
      
      const response = await fyers.getMarketDepth({
        symbol: symbols,
        ohlcv_flag: 1
      });

      if (response && response.s === 'ok' && response.d) {
        const spotData = response.d[spotSymbol];
        const futuresData = response.d[futuresSymbol];
        
        return {
          spot: spotData,
          futures: futuresData
        };
      } else {
        console.error('Invalid response from Fyers API:', response);
        return null;
      }
    } catch (error) {
      console.error(`Error getting market data for ${indexSymbol}:`, error);
      return null;
    }
  }

  // Get spot symbol for a given index
  getSpotSymbol(indexSymbol) {
    try {
      const config = symbolConfig.getSymbolConfig(indexSymbol);
      return config.index;
    } catch (error) {
      console.warn(`❌ Invalid index symbol ${indexSymbol}, falling back to default`);
      return symbolConfig.getSymbolConfig().index; // Default to NIFTY
    }
  }

  // Get futures symbol for a given index
  getFuturesSymbol(indexSymbol) {
    try {
      const config = symbolConfig.getSymbolConfig(indexSymbol);
      return config.futures;
    } catch (error) {
      console.warn(`❌ Invalid index symbol ${indexSymbol}, falling back to default`);
      return symbolConfig.getSymbolConfig().futures; // Default to NIFTY
    }
  }

  // Generate array of all 1-minute timestamps for a trading day
  generateTradingTimestamps(date) {
    const timestamps = [];
    const startTime = new Date(date);
    startTime.setHours(9, 15, 0, 0); // 9:15 AM
    
    const endTime = new Date(date);
    endTime.setHours(15, 30, 0, 0); // 3:30 PM
    
    const current = new Date(startTime);
    while (current <= endTime) {
      timestamps.push(new Date(current));
      current.setMinutes(current.getMinutes() + 1);
    }
    
    return timestamps;
  }

  // Find missing data periods for a specific date
  async findMissingDataPeriods(indexSymbol, targetDate = null) {
    try {
      const date = targetDate || new Date();
      const dateStr = date.toISOString().split('T')[0];
      
             // Get existing data timestamps
       const existingData = await storageService.readIndexData(indexSymbol, dateStr);
       const existingTimestamps = existingData.map(item => new Date(item.timestamp));
      
      // Generate all required trading timestamps
      const requiredTimestamps = this.generateTradingTimestamps(date);
      
      // Find missing timestamps
      const missingPeriods = [];
      for (const requiredTime of requiredTimestamps) {
        const exists = existingTimestamps.some(existing => 
          Math.abs(existing.getTime() - requiredTime.getTime()) < 30000 // 30 second tolerance
        );
        
        if (!exists) {
          missingPeriods.push(requiredTime);
        }
      }
      
      console.log(`📊 Analysis for ${indexSymbol} on ${dateStr}:`);
      console.log(`   Required periods: ${requiredTimestamps.length}`);
      console.log(`   Existing periods: ${existingTimestamps.length}`);
      console.log(`   Missing periods: ${missingPeriods.length}`);
      
      return {
        missing: missingPeriods,
        existing: existingTimestamps.length,
        required: requiredTimestamps.length,
        completionPercentage: ((existingTimestamps.length / requiredTimestamps.length) * 100).toFixed(1)
      };
    } catch (error) {
      console.error('Error finding missing data periods:', error);
      return { missing: [], existing: 0, required: 0, completionPercentage: 0 };
    }
  }

  // Backfill missing historical data with batching to respect rate limits
  async backfillHistoricalData(indexSymbol, appId, accessToken) {
    try {
      console.log(`🔄 Starting historical data backfill for ${indexSymbol}...`);
      
      const analysis = await this.findMissingDataPeriods(indexSymbol);
      
      if (analysis.missing.length === 0) {
        console.log(`✅ ${indexSymbol} data is complete (${analysis.existing}/${analysis.required} periods)`);
        return { success: true, filled: 0, existing: analysis.existing };
      }
      
      console.log(`⚠️  Found ${analysis.missing.length} missing periods for ${indexSymbol}`);
      console.log(`📈 Current completion: ${analysis.completionPercentage}%`);
      
      // Group missing periods into batches (5 minutes apart to respect rate limits)
      const batches = [];
      let currentBatch = [];
      
      for (let i = 0; i < analysis.missing.length; i++) {
        currentBatch.push(analysis.missing[i]);
        
        // Create batch every 5 periods or at the end
        if (currentBatch.length >= 5 || i === analysis.missing.length - 1) {
          batches.push([...currentBatch]);
          currentBatch = [];
        }
      }
      
      console.log(`📦 Processing ${batches.length} batches of missing data...`);
      
      let filledCount = 0;
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        console.log(`📥 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} periods)...`);
        
        for (const timestamp of batch) {
          try {
            // Collect data point for this specific timestamp
            const success = await this.collectDataPointForTimestamp(indexSymbol, timestamp, appId, accessToken);
            if (success) {
              filledCount++;
              console.log(`✅ Filled data for ${timestamp.toLocaleTimeString('en-IN')}`);
            }
            
            // Small delay between individual requests
            await this.delay(1000);
          } catch (error) {
            console.log(`❌ Failed to fill data for ${timestamp.toLocaleTimeString('en-IN')}: ${error.message}`);
          }
        }
        
        // Longer delay between batches to respect rate limits
        if (batchIndex < batches.length - 1) {
          console.log(`⏳ Waiting 10 seconds before next batch...`);
          await this.delay(10000);
        }
      }
      
      const finalAnalysis = await this.findMissingDataPeriods(indexSymbol); 
      console.log(`🎉 Backfill complete for ${indexSymbol}:`);
      console.log(`   Filled: ${filledCount} periods`);
      console.log(`   Final completion: ${finalAnalysis.completionPercentage}%`);
      
      return { 
        success: true, 
        filled: filledCount, 
        remaining: finalAnalysis.missing.length,
        completionPercentage: finalAnalysis.completionPercentage 
      };
      
    } catch (error) {
      console.error(`Error during historical backfill for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Collect data point for a specific timestamp (used for backfilling)
  async collectDataPointForTimestamp(indexSymbol, timestamp, appId, accessToken) {
    try {
      // Use current market data since historical API might not be available
      // In a real scenario, you would use historical data API if available
      const marketService = require('./marketService');
      
      // Get current market data (this is a limitation - ideally we'd use historical data)
      const marketData = await marketService.getMarketData(appId, accessToken, indexSymbol);
      
      if (marketData && marketData.spot && marketData.futures) {
        // DISABLED: Data storage moved to Historical API service
        // Only Historical API service should store data to CSV files
        // await storageService.storeMarketData(indexSymbol, {
        //   spot: {
        //     price: marketData.spot.price,
        //     change: marketData.spot.change,
        //     changePercent: marketData.spot.changePercent,
        //     volume: marketData.futures.volume || 0
        //   },
        //   futures: {
        //     price: marketData.futures.price,
        //     change: marketData.futures.change,
        //     changePercent: marketData.futures.changePercent,
        //     openInterest: marketData.futures.openInterest || 0
        //   }
        // });
        
        console.log(`📊 Data collected for ${indexSymbol} at ${timestamp.toISOString()} (storage handled by Historical API)`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error collecting data point for ${timestamp}:`, error);
      return false;
    }
  }

  // Check if current time is within market hours
  isMarketTime() {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Skip weekends
    if (day === 0 || day === 6) {
      return false;
    }
    
    const hour = now.getHours();
    const minute = now.getMinutes();
    const currentTime = hour * 100 + minute; // Convert to HHMM format
    
    // Market hours: 9:15 AM to 3:30 PM IST
    const marketOpen = 915;  // 9:15 AM
    const marketClose = 1530; // 3:30 PM
    
    return currentTime >= marketOpen && currentTime <= marketClose;
  }

  // Get status of all active collections
  getCollectionStatus() {
    return {
      activeIndices: Array.from(this.activeIndices),
      isCollecting: this.isCollecting,
      marketOpen: marketDataService.isMarketCurrentlyOpen(),
      apiUsage: marketDataService.getUsageStats(),
    };
  }

  // Resume data collection for an index (useful after switching back)
  async resumeDataCollection(indexSymbol, appId = null, accessToken = null) {
    console.log(`🔄 Resuming data collection for ${indexSymbol}`);
    
    // Stop existing collection if any
    this.stopDataCollection(indexSymbol);
    
    // Start fresh collection with backfill
    return await this.startDataCollection(indexSymbol, appId, accessToken);
  }

  // Cleanup - stop all collections
  cleanup() {
    console.log('🧹 Cleaning up data collection service');
    
    for (const indexSymbol of this.activeIndices) {
      this.stopDataCollection(indexSymbol);
    }
    
    this.activeIndices.clear();
    this.collectionIntervals.clear();
  }

  // Add delay utility method
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // NEW: Start separated live + storage data collection
  async startSeparatedDataCollection(indexSymbol, appId = null, accessToken = null) {
    try {
      console.log(`🚀 Starting separated data collection for ${indexSymbol}...`);
      console.log(`📊 Live: WebSocket every 10s → Frontend display`);
      console.log(`💾 Storage: Historical API every 1min → CSV files`);
      
      // Store credentials if provided
      if (appId && accessToken) {
        this.storedCredentials = { appId, accessToken };
      }

      if (!this.storedCredentials || !this.storedCredentials.appId || !this.storedCredentials.accessToken) {
        throw new Error('No credentials available for data collection');
      }
      
      // Add to active indices
      this.activeIndices.add(indexSymbol);
      
      // 1. Start Live Real-time Service (10-second updates for frontend)
      await marketDataService.setCredentials(this.storedCredentials.appId, this.storedCredentials.accessToken);
      const liveSubscription = await marketDataService.subscribeToIndex(indexSymbol, (marketData) => {
        // Real-time data callback - only for frontend display
        console.log(`📊 Live data for ${indexSymbol}: Spot=${marketData.spot.price}, Futures=${marketData.futures.price}`);
      });

      if (!liveSubscription.success) {
        throw new Error(`Failed to start live data collection: ${liveSubscription.error}`);
      }

      // 2. Start Historical Storage Service (1-minute intervals)
      this.startHistoricalStorageService(indexSymbol);
      
      // 3. Run initial smart backfill for today
      await this.smartBackfillToday(indexSymbol);

      console.log(`✅ Separated data collection active for ${indexSymbol}`);
      console.log(`   - Live: ${liveSubscription.mode}`);
      console.log(`   - Storage: Historical API every minute`);
      
      return {
        success: true,
        message: `Separated data collection initialized for ${indexSymbol}`,
        liveMode: liveSubscription.mode,
        storageMode: 'Historical API every minute',
        marketOpen: marketDataService.isMarketCurrentlyOpen()
      };
      
    } catch (error) {
      console.error(`❌ Error starting separated data collection for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Start historical storage service (runs every minute at :05 seconds)
  startHistoricalStorageService(indexSymbol) {
    const intervalId = setInterval(async () => {
      try {
        const now = new Date();
        const seconds = now.getSeconds();
        
        // Only run at 5th second of each minute
        if (seconds === 5) {
          console.log(`💾 Historical storage trigger for ${indexSymbol} at ${now.toISOString()}`);
          
          // Get previous minute's timestamp
          const prevMinute = new Date(now.getTime() - 60000); // 1 minute ago
          const targetTimestamp = new Date(
            prevMinute.getFullYear(),
            prevMinute.getMonth(), 
            prevMinute.getDate(),
            prevMinute.getHours(),
            prevMinute.getMinutes(),
            0, 0 // Exact minute boundary
          );
          
          await this.fetchAndStoreHistoricalMinute(indexSymbol, targetTimestamp);
        }
      } catch (error) {
        console.error(`❌ Historical storage error for ${indexSymbol}:`, error);
      }
    }, 1000); // Check every second, but only act at :05
    
    // Store interval ID for cleanup
    this.collectionIntervals.set(`${indexSymbol}_historical`, intervalId);
    console.log(`⏰ Historical storage service started for ${indexSymbol} (every minute at :05)`);
  }

  // Fetch and store 1-minute historical data for a specific timestamp
  async fetchAndStoreHistoricalMinute(indexSymbol, timestamp) {
    try {
      if (!this.isMarketTime()) {
        console.log(`⏭️ Skipping historical fetch for ${indexSymbol} - market closed`);
        return { success: false, message: 'Market closed' };
      }

      const { appId, accessToken } = this.storedCredentials;
      console.log(`📥 Fetching historical minute for ${indexSymbol} at ${timestamp.toISOString()}`);
      
      // Use historical API service to get 1-minute OHLC data
      const result = await marketDataService.fetchAndStoreMissingData(
        indexSymbol, 
        [timestamp.getHours() * 60 + timestamp.getMinutes()], 
        appId, 
        accessToken
      );
      
      if (result.success) {
        console.log(`💾 Stored historical minute for ${indexSymbol}: ${timestamp.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
        return result;
      } else {
        console.log(`⚠️ No historical data available for ${indexSymbol} at ${timestamp.toISOString()}`);
        return result;
      }
      
    } catch (error) {
      console.error(`❌ Error fetching historical minute for ${indexSymbol}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Smart backfill for today's missing data
  async smartBackfillToday(indexSymbol) {
    try {
      console.log(`🔍 Smart backfill check for ${indexSymbol}...`);
      
      const missingPeriods = await this.findMissingDataPeriods(indexSymbol);
      if (missingPeriods.length > 0) {
        console.log(`📥 Backfilling ${missingPeriods.length} missing periods for ${indexSymbol}`);
        
        for (const period of missingPeriods.slice(0, 10)) { // Limit to avoid API overflow
          await this.fetchAndStoreHistoricalMinute(indexSymbol, period);
          await this.delay(1000); // 1-second delay between calls
        }
        
        console.log(`✅ Backfill completed for ${indexSymbol}`);
      } else {
        console.log(`✅ No missing data for ${indexSymbol}`);
      }
      
    } catch (error) {
      console.error(`❌ Smart backfill error for ${indexSymbol}:`, error);
    }
  }
}

module.exports = new DataCollectionService(); 