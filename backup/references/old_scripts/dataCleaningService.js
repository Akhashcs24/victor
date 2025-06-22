const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvStringifier;
const timestampService = require('./timestampService');

class DataCleaningService {
  constructor() {
    this.dataDir = path.join(__dirname, '../data');
    this.cacheDir = path.join(this.dataDir, 'cache');
    this.optionsDir = path.join(this.dataDir, 'options');
    
    // Schedule cleanup only (disabled automatic startup cleanup)
    this.schedulePreMarketCleanup();
    
    console.log('🧹 Automatic startup cleanup disabled - use manual "Delete Past Data" button instead');
  }

  /**
   * Schedule pre-market cleanup (5 minutes before market open)
   */
  schedulePreMarketCleanup() {
    const scheduleNextCleanup = () => {
      const now = timestampService.getCurrentIST();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Set to 9:10 AM IST (5 minutes before market open)
      const cleanupTime = new Date(tomorrow);
      cleanupTime.setHours(9, 10, 0, 0);
      
      const timeUntilCleanup = cleanupTime.getTime() - now.getTime();
      
      console.log(`🕘 Next cache/option cleanup scheduled for: ${cleanupTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
      
      setTimeout(async () => {
        await this.performPreMarketCleanup();
        scheduleNextCleanup(); // Schedule next day's cleanup
      }, timeUntilCleanup);
    };

    scheduleNextCleanup();
  }

  /**
   * Check if cleanup is needed on server startup
   */
  async checkAndCleanOnStartup() {
    try {
      const now = timestampService.getCurrentIST();
      const hours = now.getHours();
      const minutes = now.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      
      const marketStart = 9 * 60 + 15; // 9:15 AM
      const marketEnd = 15 * 60 + 30;  // 3:30 PM
      
      // If server starts during market hours or after market close
      if (totalMinutes >= marketStart || totalMinutes < 6 * 60) { // After 9:15 AM or before 6:00 AM
        console.log('🧹 Server started during/after market hours - performing cache/option cleanup');
        await this.performPreMarketCleanup();
      } else {
        console.log('🕐 Server started before market hours - cache/option cleanup scheduled for 9:10 AM');
      }
      
    } catch (error) {
      console.error('❌ Error in startup cleanup check:', error);
    }
  }

  /**
   * Perform pre-market cleanup (delete ONLY cache and option files, NOT index/futures data)
   */
  async performPreMarketCleanup() {
    try {
      console.log('🧹 Starting pre-market cleanup (cache and option data only)...');
      
      // Clean cache folder
      await this.cleanCacheFolder();
      
      // Clean option files ONLY (preserve index/futures data)
      await this.cleanOptionFiles();
      
      console.log('✅ Pre-market cleanup completed (index/futures data preserved)');
      
    } catch (error) {
      console.error('❌ Error in pre-market cleanup:', error);
    }
  }

  /**
   * Clean cache folder (delete all cache files)
   */
  async cleanCacheFolder() {
    try {
      if (!fs.existsSync(this.cacheDir)) {
        console.log('📂 Cache directory does not exist');
        return;
      }

      const cacheFiles = fs.readdirSync(this.cacheDir);
      let deletedCount = 0;

      for (const file of cacheFiles) {
        const filePath = path.join(this.cacheDir, file);
        
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`🗑️ Deleted cache file: ${file}`);
        } catch (error) {
          console.error(`❌ Error deleting cache file ${file}:`, error.message);
        }
      }

      console.log(`🧹 Cache cleanup completed: ${deletedCount} files deleted`);
      
    } catch (error) {
      console.error('❌ Error cleaning cache folder:', error);
    }
  }

  /**
   * Clean option files ONLY (delete all option OHLCV files, preserve index/futures data)
   */
  async cleanOptionFiles() {
    try {
      if (!fs.existsSync(this.optionsDir)) {
        console.log('📂 Options directory does not exist');
        return;
      }

      const optionFiles = fs.readdirSync(this.optionsDir);
      let deletedCount = 0;
      let preservedCount = 0;

      // Only delete files older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      for (const file of optionFiles) {
        const filePath = path.join(this.optionsDir, file);
        
        // Only delete CSV files that are option data (not index/futures data)
        if (file.endsWith('.csv') && this.isOptionDataFile(file)) {
          try {
            const stats = fs.statSync(filePath);
            
            // Only delete files older than 7 days
            if (stats.mtime < sevenDaysAgo) {
              fs.unlinkSync(filePath);
              deletedCount++;
              console.log(`🗑️ Deleted old option file (${Math.floor((Date.now() - stats.mtime) / (1000 * 60 * 60 * 24))} days old): ${file}`);
              
              // Also delete calculated data files for this option symbol
              const symbol = file.replace(/\.csv$/, '');
              const calcDir = path.join(this.optionsDir, '../Calculated Data');
              const calc1min = path.join(calcDir, `${symbol}_1min.csv`);
              const calc5min = path.join(calcDir, `${symbol}_5min.csv`);
              if (fs.existsSync(calc1min)) {
                fs.unlinkSync(calc1min);
                console.log(`🗑️ Deleted calculated 1min file: ${path.basename(calc1min)}`);
              }
              if (fs.existsSync(calc5min)) {
                fs.unlinkSync(calc5min);
                console.log(`🗑️ Deleted calculated 5min file: ${path.basename(calc5min)}`);
              }
            } else {
              preservedCount++;
              console.log(`📋 Kept recent option file (${Math.floor((Date.now() - stats.mtime) / (1000 * 60 * 60 * 24))} days old): ${file}`);
            }
          } catch (error) {
            console.error(`❌ Error processing option file ${file}:`, error.message);
          }
        } else if (file.endsWith('.csv')) {
          preservedCount++;
          console.log(`🔒 Preserved index/futures file: ${file}`);
        }
      }

      console.log(`🧹 Option files cleanup completed: ${deletedCount} option files deleted, ${preservedCount} index/futures files preserved`);
      
    } catch (error) {
      console.error('❌ Error cleaning option files:', error);
    }
  }

  /**
   * Check if a file is option data (not index/futures data)
   */
  isOptionDataFile(filename) {
    // Option files typically contain option symbols like NSE:NIFTY2561924550CE
    // Index/Futures files are like NIFTY_INDEX_2025-06-13.csv or NIFTY_FUTURES_2025-06-13.csv
    
    const indexFuturesPatterns = [
      /_INDEX_\d{4}-\d{2}-\d{2}\.csv$/,    // NIFTY_INDEX_2025-06-13.csv
      /_FUTURES_\d{4}-\d{2}-\d{2}\.csv$/,  // NIFTY_FUTURES_2025-06-13.csv
      /^NIFTY_INDEX_/,                     // Any NIFTY index file
      /^NIFTY_FUTURES_/,                   // Any NIFTY futures file
      /^NIFTYBANK_INDEX_/,                 // Any NIFTYBANK index file
      /^NIFTYBANK_FUTURES_/,               // Any NIFTYBANK futures file
      /^SENSEX_INDEX_/,                    // Any SENSEX index file
      /^SENSEX_FUTURES_/                   // Any SENSEX futures file
    ];
    
    // If it matches any index/futures pattern, it's NOT an option file
    for (const pattern of indexFuturesPatterns) {
      if (pattern.test(filename)) {
        return false; // This is index/futures data, don't delete
      }
    }
    
    // If it doesn't match index/futures patterns, it's likely option data
    return true;
  }

  /**
   * Manual cleanup trigger (for testing or manual intervention)
   */
  async manualPreMarketCleanup() {
    try {
      console.log('🔧 Manual pre-market cleanup triggered (cache and option data only)');
      await this.performPreMarketCleanup();
      return { success: true, message: 'Manual cleanup completed (index/futures data preserved)' };
    } catch (error) {
      console.error('❌ Error in manual cleanup:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Delete ALL option data on demand (for "Delete Past Data" button)
   * Deletes: All files in options folder + Calculated option files
   */
  async deleteAllOptionData() {
    try {
      console.log('🗑️ Manual "Delete Past Data" triggered - deleting ALL option files...');
      
      let results = {
        optionFiles: { deleted: 0, errors: 0 },
        calculatedFiles: { deleted: 0, errors: 0 },
        totalDeleted: 0
      };

      // 1. Delete ALL files in options folder
      if (fs.existsSync(this.optionsDir)) {
        const optionFiles = fs.readdirSync(this.optionsDir);
        
        for (const file of optionFiles) {
          const filePath = path.join(this.optionsDir, file);
          
          try {
            if (file.endsWith('.csv')) {
              fs.unlinkSync(filePath);
              results.optionFiles.deleted++;
              console.log(`🗑️ Deleted option file: ${file}`);
            }
          } catch (error) {
            console.error(`❌ Error deleting option file ${file}:`, error.message);
            results.optionFiles.errors++;
          }
        }
      }

      // 2. Delete calculated option files from Calculated Data folder
      const calcDataDir = path.join(this.dataDir, 'Calculated Data');
      if (fs.existsSync(calcDataDir)) {
        const calcFiles = fs.readdirSync(calcDataDir);
        
        for (const file of calcFiles) {
          // Delete files that contain option strikes (CE/PE patterns)
          if (file.includes('CE_') || file.includes('PE_') || 
              file.includes('CALL_') || file.includes('PUT_') ||
              file.includes('_ATM_') || file.includes('_ITM') || file.includes('_OTM')) {
            
            const filePath = path.join(calcDataDir, file);
            
            try {
              fs.unlinkSync(filePath);
              results.calculatedFiles.deleted++;
              console.log(`🗑️ Deleted calculated option file: ${file}`);
            } catch (error) {
              console.error(`❌ Error deleting calculated file ${file}:`, error.message);
              results.calculatedFiles.errors++;
            }
          }
        }
      }

      results.totalDeleted = results.optionFiles.deleted + results.calculatedFiles.deleted;
      
      console.log(`🎯 Manual option data deletion completed:`);
      console.log(`   📊 Option files deleted: ${results.optionFiles.deleted}`);
      console.log(`   📈 Calculated files deleted: ${results.calculatedFiles.deleted}`);
      console.log(`   🗑️ Total files deleted: ${results.totalDeleted}`);
      
      return { 
        success: true, 
        message: `Successfully deleted ${results.totalDeleted} option-related files`,
        details: results
      };
      
    } catch (error) {
      console.error('❌ Error in manual option data deletion:', error);
      return { success: false, error: error.message };
    }
  }

  // Clean and validate a CSV file for any index
  async cleanAndValidateCSV(filePath, indexSymbol, dataType = 'FUTURES') {
    try {
      if (!fs.existsSync(filePath)) {
        console.log(`⚠️ File not found: ${filePath}`);
        return { success: false, message: 'File not found' };
      }

      console.log(`🧹 Cleaning ${dataType} data for ${indexSymbol}: ${path.basename(filePath)}`);
      
      // Read the CSV file
      const csvData = fs.readFileSync(filePath, 'utf8');
      const lines = csvData.trim().split('\n');
      
      if (lines.length <= 1) {
        console.log(`⚠️ No data to clean in ${filePath}`);
        return { success: false, message: 'No data to clean' };
      }

      // Parse header and data
      const headers = lines[0].split(',').map(h => h.trim());
      const originalData = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length === headers.length) {
          const record = {};
          headers.forEach((header, index) => {
            record[header] = values[index]?.trim() || '';
          });
          originalData.push(record);
        }
      }

      console.log(`📊 Original data: ${originalData.length} records`);

      // Clean and validate the data
      const cleanedData = this.cleanDataRecords(originalData, indexSymbol, dataType);
      
      if (cleanedData.length === 0) {
        console.log(`⚠️ No valid data after cleaning ${filePath}`);
        return { success: false, message: 'No valid data after cleaning' };
      }

      // Create backup of original file
      const backupPath = filePath.replace('.csv', '_backup.csv');
      if (!fs.existsSync(backupPath)) {
        fs.copyFileSync(filePath, backupPath);
        console.log(`💾 Created backup: ${path.basename(backupPath)}`);
      }

      // Write cleaned data back to file
      await this.writeCleanedData(filePath, cleanedData, dataType);
      
      console.log(`✅ Cleaned ${dataType} data: ${originalData.length} → ${cleanedData.length} records`);
      
      return {
        success: true,
        originalCount: originalData.length,
        cleanedCount: cleanedData.length,
        removedCount: originalData.length - cleanedData.length
      };

    } catch (error) {
      console.error(`❌ Error cleaning CSV file ${filePath}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Clean data records with validation and filtering
  cleanDataRecords(data, indexSymbol, dataType) {
    const cleanedData = [];
    const seenTimestamps = new Set();

    for (const record of data) {
      // Skip records with invalid or zero prices
      const price = parseFloat(record.price || record.ltp || record.close || 0);
      if (!price || price <= 0) {
        continue;
      }

      // Validate timestamp format
      if (!this.isValidTimestamp(record.timestamp)) {
        continue;
      }

      // Convert timestamp to proper IST format if needed
      const normalizedTimestamp = this.normalizeTimestamp(record.timestamp);
      
      // Skip if timestamp is outside market hours
      if (!this.isMarketHours(normalizedTimestamp)) {
        continue;
      }

      // Skip duplicate timestamps
      if (seenTimestamps.has(normalizedTimestamp)) {
        continue;
      }
      seenTimestamps.add(normalizedTimestamp);

      // Clean and validate numeric fields based on data type
      let cleanedRecord;
      
      if (dataType === 'OPTION') {
        // Option data format (OHLCV)
        cleanedRecord = {
          timestamp: normalizedTimestamp,
          symbol: record.symbol || indexSymbol,
          ltp: this.cleanNumericValue(record.ltp),
          open: this.cleanNumericValue(record.open),
          high: this.cleanNumericValue(record.high),
          low: this.cleanNumericValue(record.low),
          close: this.cleanNumericValue(record.close || record.ltp),
          volume: this.cleanNumericValue(record.volume)
        };
      } else {
        // Index/Futures data format
        cleanedRecord = {
          timestamp: normalizedTimestamp,
          symbol: indexSymbol,
          price: this.cleanNumericValue(record.price || record.ltp || record.close),
          change: this.cleanNumericValue(record.change),
          changePercent: this.cleanNumericValue(record.changePercent),
          volume: this.cleanNumericValue(record.volume)
        };

        // Add openInterest for futures data
        if (dataType === 'FUTURES' && record.openInterest !== undefined) {
          cleanedRecord.openInterest = this.cleanNumericValue(record.openInterest);
        }
      }

      cleanedData.push(cleanedRecord);
    }

    // Sort by timestamp
    cleanedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return cleanedData;
  }

  // Validate timestamp format
  isValidTimestamp(timestamp) {
    if (!timestamp) return false;
    
    try {
      const date = new Date(timestamp);
      return !isNaN(date.getTime()) && date.getFullYear() > 2020;
    } catch (error) {
      return false;
    }
  }

  // Normalize timestamp to IST format
  normalizeTimestamp(timestamp) {
    try {
      const date = new Date(timestamp);
      
      // If timestamp is already in IST format, return as is
      if (timestamp.includes('+05:30')) {
        return timestamp;
      }
      
      // Convert to IST
      const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
      const istTime = new Date(date.getTime() + istOffset);
      return istTime.toISOString().replace('Z', '+05:30');
    } catch (error) {
      return timestamp;
    }
  }

  // Check if timestamp is within market hours (9:15 AM to 3:30 PM IST)
  isMarketHours(timestamp) {
    try {
      const date = new Date(timestamp);
      const hours = date.getHours();
      const minutes = date.getMinutes();
      const totalMinutes = hours * 60 + minutes;
      
      const marketStart = 9 * 60 + 15; // 9:15 AM
      const marketEnd = 15 * 60 + 30;  // 3:30 PM
      
      return totalMinutes >= marketStart && totalMinutes <= marketEnd;
    } catch (error) {
      return false;
    }
  }

  // Clean and validate numeric values
  cleanNumericValue(value) {
    if (value === null || value === undefined || value === '') {
      return 0;
    }
    
    const numValue = parseFloat(value);
    return isNaN(numValue) ? 0 : parseFloat(numValue.toFixed(2));
  }

  // Write cleaned data to CSV file
  async writeCleanedData(filePath, cleanedData, dataType) {
    try {
      // Define headers based on data type
      let headers;
      
      if (dataType === 'OPTION') {
        headers = [
          { id: 'timestamp', title: 'timestamp' },
          { id: 'symbol', title: 'symbol' },
          { id: 'ltp', title: 'ltp' },
          { id: 'open', title: 'open' },
          { id: 'high', title: 'high' },
          { id: 'low', title: 'low' },
          { id: 'close', title: 'close' },
          { id: 'volume', title: 'volume' }
        ];
      } else {
        headers = [
          { id: 'timestamp', title: 'timestamp' },
          { id: 'symbol', title: 'symbol' },
          { id: 'price', title: 'price' },
          { id: 'change', title: 'change' },
          { id: 'changePercent', title: 'changePercent' },
          { id: 'volume', title: 'volume' }
        ];

        if (dataType === 'FUTURES') {
          headers.push({ id: 'openInterest', title: 'openInterest' });
        }
      }

      // Create CSV content
      const csvStringifier = createCsvWriter({
        header: headers
      });

      const headerString = headers.map(h => h.title).join(',') + '\n';
      const recordsString = csvStringifier.stringifyRecords(cleanedData);
      
      const csvContent = headerString + recordsString;
      
      // Write to file
      fs.writeFileSync(filePath, csvContent);
      
    } catch (error) {
      console.error(`❌ Error writing cleaned data to ${filePath}:`, error);
      throw error;
    }
  }

  // Auto-clean all CSV files for a specific date
  async autoCleanAllFilesForDate(dateString, indexSymbols = ['NIFTY', 'BANKNIFTY']) {
    try {
      console.log(`🧹 Auto-cleaning all files for ${dateString}...`);
      
      const results = [];
      
      for (const indexSymbol of indexSymbols) {
        // Clean INDEX file
        const indexFile = path.join(this.dataDir, `${indexSymbol}_INDEX_${dateString}.csv`);
        if (fs.existsSync(indexFile)) {
          const indexResult = await this.cleanAndValidateCSV(indexFile, indexSymbol, 'INDEX');
          results.push({ file: path.basename(indexFile), ...indexResult });
        }
        
        // Clean FUTURES file
        const futuresFile = path.join(this.dataDir, `${indexSymbol}_FUTURES_${dateString}.csv`);
        if (fs.existsSync(futuresFile)) {
          const futuresResult = await this.cleanAndValidateCSV(futuresFile, indexSymbol, 'FUTURES');
          results.push({ file: path.basename(futuresFile), ...futuresResult });
        }
      }
      
      console.log(`✅ Auto-cleaning completed for ${dateString}: ${results.length} files processed`);
      return { success: true, results };
      
    } catch (error) {
      console.error(`❌ Error in auto-cleaning for ${dateString}:`, error);
      return { success: false, error: error.message };
    }
  }

  // Get today's date string in YYYY-MM-DD format
  getTodayDateString() {
    const today = new Date();
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(today.getTime() + istOffset);
    return istTime.toISOString().split('T')[0];
  }

  // Clean all files for today
  async cleanTodaysFiles() {
    const today = this.getTodayDateString();
    return await this.autoCleanAllFilesForDate(today);
  }

  // Get list of all CSV files in data directory
  getAllCSVFiles() {
    try {
      const files = fs.readdirSync(this.dataDir);
      return files.filter(file => file.endsWith('.csv') && !file.includes('_backup'));
    } catch (error) {
      console.error('Error reading data directory:', error);
      return [];
    }
  }

  // Clean all existing CSV files
  async cleanAllExistingFiles() {
    try {
      console.log('🧹 Starting comprehensive cleaning of all CSV files...');
      
      const csvFiles = this.getAllCSVFiles();
      const results = [];
      
      for (const fileName of csvFiles) {
        const filePath = path.join(this.dataDir, fileName);
        
        // Extract index symbol and data type from filename
        const parts = fileName.replace('.csv', '').split('_');
        if (parts.length >= 2) {
          const indexSymbol = parts[0];
          const dataType = parts[1];
          
          const result = await this.cleanAndValidateCSV(filePath, indexSymbol, dataType);
          results.push({ file: fileName, ...result });
        }
      }
      
      console.log(`✅ Comprehensive cleaning completed: ${results.length} files processed`);
      return { success: true, results };
      
    } catch (error) {
      console.error('❌ Error in comprehensive cleaning:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new DataCleaningService(); 