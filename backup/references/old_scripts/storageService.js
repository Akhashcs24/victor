const fs = require('fs');
const path = require('path');
const createCsvWriter = require('csv-writer').createObjectCsvStringifier;
const dataCleaningService = require('./dataCleaningService');
const timestampService = require('./timestampService');
const symbolConfig = require('../config/symbolConfig');

class StorageService {
    constructor() {
        this.dataDir = path.join(__dirname, '../data');
        this.ensureDataDirectory();
    }

    ensureDataDirectory() {
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    // Get filepath for index data (separate from futures)
    getIndexDataFile(indexSymbol, date = null) {
        const dateStr = date ? this.getISTDateString(date) : this.getISTDateString();
        return path.join(this.dataDir, `${indexSymbol}_INDEX_${dateStr}.csv`);
    }

    // Get filepath for futures data (separate from index)
    getFuturesDataFile(indexSymbol, date = null) {
        const dateStr = date ? this.getISTDateString(date) : this.getISTDateString();
        return path.join(this.dataDir, `${indexSymbol}_FUTURES_${dateStr}.csv`);
    }

    // Get filepath for consolidated index data
    getConsolidatedIndexDataFile(indexSymbol) {
        return path.join(this.dataDir, `${indexSymbol}_INDEX.csv`);
    }

    // Get filepath for consolidated futures data
    getConsolidatedFuturesDataFile(indexSymbol) {
        return path.join(this.dataDir, `${indexSymbol}_FUTURES.csv`);
    }

    // Convert current time to IST and return date string
    getISTDateString(date = null) {
        const targetDate = date || new Date();
        // Convert to IST (UTC + 5:30)
        const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
        const istTime = new Date(targetDate.getTime() + istOffset);
        return istTime.toISOString().split('T')[0]; // YYYY-MM-DD format
    }

    // Convert current time to IST timestamp string
    getISTTimestamp(date = null) {
        const targetDate = date || new Date();
        // Use the timestampService for proper IST conversion
        return timestampService.formatTimestampForStorage(targetDate);
    }

    // Store index data separately
    // Store index/spot data with smart timestamp
    async storeIndexData(indexSymbol, spotData, dataSource = 'realtime') {
        try {
            // Get appropriate timestamp based on context
            let timestamp;
            if (spotData.timestamp) {
                // Use provided timestamp (e.g., from historical API)
                timestamp = spotData.timestamp;
                console.log(`📊 Using provided timestamp for ${indexSymbol}: ${timestamp}`);
            } else {
                // Generate smart timestamp for real-time data
                const smartTimestamp = await timestampService.getTimestampForDataCollection(indexSymbol, dataSource);
                if (!smartTimestamp) {
                    console.log(`⚠️ Cannot generate timestamp for ${indexSymbol} - market may be closed`);
                    return { success: false, message: 'Cannot generate timestamp - market closed' };
                }
                timestamp = timestampService.formatTimestampForStorage(smartTimestamp);
                console.log(`🕐 Generated smart timestamp for ${indexSymbol}: ${timestamp}`);
            }

            const filepath = this.getIndexDataFile(indexSymbol);
            
            const record = {
                timestamp,
                symbol: indexSymbol,
                price: spotData.price || 0,
                open: spotData.open || spotData.price || 0,    // Store opening price
                high: spotData.high || spotData.price || 0,    // Store high price
                low: spotData.low || spotData.price || 0,      // Store low price
                close: spotData.close || spotData.price || 0,  // Store closing price
                change: spotData.change || 0,
                changePercent: spotData.changePercent || 0,
                volume: spotData.volume || 0
            };

            const csvStringifier = createCsvWriter({
                header: [
                    { id: 'timestamp', title: 'timestamp' },
                    { id: 'symbol', title: 'symbol' },
                    { id: 'price', title: 'price' },
                    { id: 'open', title: 'open' },
                    { id: 'high', title: 'high' },
                    { id: 'low', title: 'low' },
                    { id: 'close', title: 'close' },
                    { id: 'change', title: 'change' },
                    { id: 'changePercent', title: 'changePercent' },
                    { id: 'volume', title: 'volume' }
                ]
            });

            const csvHeader = !fs.existsSync(filepath) ? csvStringifier.getHeaderString() : '';
            const csvRecord = csvStringifier.stringifyRecords([record]);
            
            fs.appendFileSync(filepath, csvHeader + csvRecord);
            console.log(`✅ Data stored for ${indexSymbol} INDEX at ${timestamp}`);
            
            return { success: true, timestamp, filepath };
        } catch (error) {
            console.error(`Error storing index data for ${indexSymbol}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Store index data with specific timestamp (for historical data)
    async storeIndexDataWithTimestamp(indexSymbol, spotData, specificTimestamp) {
        try {
            const timestamp = timestampService.formatTimestampForStorage(specificTimestamp);
            const filepath = this.getIndexDataFile(indexSymbol, specificTimestamp);
            
            const record = {
                timestamp,
                symbol: indexSymbol,
                price: spotData.price || 0,
                open: spotData.open || spotData.price || 0,    // Store opening price
                high: spotData.high || spotData.price || 0,    // Store high price
                low: spotData.low || spotData.price || 0,      // Store low price
                close: spotData.close || spotData.price || 0,  // Store closing price
                change: spotData.change || 0,
                changePercent: spotData.changePercent || 0,
                volume: spotData.volume || 0
            };

            const csvStringifier = createCsvWriter({
                header: [
                    { id: 'timestamp', title: 'timestamp' },
                    { id: 'symbol', title: 'symbol' },
                    { id: 'price', title: 'price' },
                    { id: 'open', title: 'open' },
                    { id: 'high', title: 'high' },
                    { id: 'low', title: 'low' },
                    { id: 'close', title: 'close' },
                    { id: 'change', title: 'change' },
                    { id: 'changePercent', title: 'changePercent' },
                    { id: 'volume', title: 'volume' }
                ]
            });

            const csvHeader = !fs.existsSync(filepath) ? csvStringifier.getHeaderString() : '';
            const csvRecord = csvStringifier.stringifyRecords([record]);
            
            fs.appendFileSync(filepath, csvHeader + csvRecord);
            console.log(`✅ Historical data stored for ${indexSymbol} INDEX at ${timestamp}`);
            
            return { success: true, timestamp, filepath };
        } catch (error) {
            console.error(`Error storing historical index data for ${indexSymbol}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Store futures data with specific timestamp (for historical data)
    async storeFuturesDataWithTimestamp(indexSymbol, futuresData, specificTimestamp) {
        try {
            const timestamp = timestampService.formatTimestampForStorage(specificTimestamp);
            const filepath = this.getFuturesDataFile(indexSymbol, specificTimestamp);
            
            const record = {
                timestamp,
                symbol: indexSymbol,
                price: futuresData.price || 0,
                open: futuresData.open || futuresData.price || 0,    // Store opening price
                high: futuresData.high || futuresData.price || 0,    // Store high price
                low: futuresData.low || futuresData.price || 0,      // Store low price
                close: futuresData.close || futuresData.price || 0,  // Store closing price
                change: futuresData.change || 0,
                changePercent: futuresData.changePercent || 0,
                openInterest: futuresData.openInterest || 0,
                volume: futuresData.volume || 0
            };

            const csvStringifier = createCsvWriter({
                header: [
                    { id: 'timestamp', title: 'timestamp' },
                    { id: 'symbol', title: 'symbol' },
                    { id: 'price', title: 'price' },
                    { id: 'open', title: 'open' },
                    { id: 'high', title: 'high' },
                    { id: 'low', title: 'low' },
                    { id: 'close', title: 'close' },
                    { id: 'change', title: 'change' },
                    { id: 'changePercent', title: 'changePercent' },
                    { id: 'openInterest', title: 'openInterest' },
                    { id: 'volume', title: 'volume' }
                ]
            });

            const csvHeader = !fs.existsSync(filepath) ? csvStringifier.getHeaderString() : '';
            const csvRecord = csvStringifier.stringifyRecords([record]);
            
            fs.appendFileSync(filepath, csvHeader + csvRecord);
            console.log(`✅ Historical futures data stored for ${indexSymbol} at ${timestamp}`);
            
            return { success: true, timestamp, filepath };
        } catch (error) {
            console.error(`Error storing historical futures data for ${indexSymbol}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Store futures data with smart timestamp
    async storeFuturesData(indexSymbol, futuresData, dataSource = 'realtime') {
        try {
            // Get appropriate timestamp based on context
            let timestamp;
            if (futuresData.timestamp) {
                // Use provided timestamp (e.g., from historical API)
                timestamp = futuresData.timestamp;
                console.log(`📊 Using provided timestamp for ${indexSymbol}: ${timestamp}`);
            } else {
                // Generate smart timestamp for real-time data
                const smartTimestamp = await timestampService.getTimestampForDataCollection(indexSymbol, dataSource);
                if (!smartTimestamp) {
                    console.log(`⚠️ Cannot generate timestamp for ${indexSymbol} - market may be closed`);
                    return { success: false, message: 'Cannot generate timestamp - market closed' };
                }
                timestamp = timestampService.formatTimestampForStorage(smartTimestamp);
                console.log(`🕐 Generated smart timestamp for ${indexSymbol}: ${timestamp}`);
            }

            const filepath = this.getFuturesDataFile(indexSymbol);
            
            const record = {
                timestamp,
                symbol: indexSymbol,
                price: futuresData.price || 0,
                open: futuresData.open || futuresData.price || 0,    // Store opening price
                high: futuresData.high || futuresData.price || 0,    // Store high price
                low: futuresData.low || futuresData.price || 0,      // Store low price
                close: futuresData.close || futuresData.price || 0,  // Store closing price
                change: futuresData.change || 0,
                changePercent: futuresData.changePercent || 0,
                openInterest: futuresData.openInterest || 0,
                volume: futuresData.volume || 0
            };

            const csvStringifier = createCsvWriter({
                header: [
                    { id: 'timestamp', title: 'timestamp' },
                    { id: 'symbol', title: 'symbol' },
                    { id: 'price', title: 'price' },
                    { id: 'open', title: 'open' },
                    { id: 'high', title: 'high' },
                    { id: 'low', title: 'low' },
                    { id: 'close', title: 'close' },
                    { id: 'change', title: 'change' },
                    { id: 'changePercent', title: 'changePercent' },
                    { id: 'openInterest', title: 'openInterest' },
                    { id: 'volume', title: 'volume' }
                ]
            });

            const csvHeader = !fs.existsSync(filepath) ? csvStringifier.getHeaderString() : '';
            const csvRecord = csvStringifier.stringifyRecords([record]);
            
            fs.appendFileSync(filepath, csvHeader + csvRecord);
            console.log(`✅ Data stored for ${indexSymbol} FUTURES at ${timestamp}`);
            
            return { success: true, timestamp, filepath };
        } catch (error) {
            console.error(`Error storing futures data for ${indexSymbol}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Store combined market data (for backward compatibility with existing code)
    async storeMarketData(indexSymbol, marketData) {
        try {
            // Validate data - skip if prices are 0 or missing
            if (!marketData.spot || !marketData.futures || 
                !marketData.spot.price || marketData.spot.price === 0 ||
                !marketData.futures.price || marketData.futures.price === 0) {
                console.log(`⚠️ Skipping invalid data for ${indexSymbol}: Spot=${marketData.spot?.price || 0}, Futures=${marketData.futures?.price || 0}`);
                return { success: false, message: 'Invalid or zero values in market data' };
            }
            
            const results = await Promise.all([
                this.storeIndexData(indexSymbol, marketData.spot),
                this.storeFuturesData(indexSymbol, marketData.futures)
            ]);
            
            // Auto-clean files if they get too large (every 100 records)
            await this.autoCleanIfNeeded(indexSymbol);
            
            return { 
                success: true, 
                indexResult: results[0], 
                futuresResult: results[1] 
            };
        } catch (error) {
            console.error(`Error storing market data for ${indexSymbol}:`, error);
            return { success: false, error: error.message };
        }
    }

    // Auto-clean files if they exceed a certain size
    async autoCleanIfNeeded(indexSymbol) {
        try {
            const today = this.getISTDateString();
            const indexFile = path.join(this.dataDir, `${indexSymbol}_INDEX_${today}.csv`);
            const futuresFile = path.join(this.dataDir, `${indexSymbol}_FUTURES_${today}.csv`);
            
            // Check if files need cleaning (every 100 records)
            const shouldClean = this.shouldCleanFile(indexFile) || this.shouldCleanFile(futuresFile);
            
            if (shouldClean) {
                console.log(`🧹 Auto-cleaning triggered for ${indexSymbol} files`);
                await dataCleaningService.autoCleanAllFilesForDate(today, [indexSymbol]);
            }
        } catch (error) {
            console.error(`Error in auto-clean for ${indexSymbol}:`, error);
        }
    }

    // Check if file should be cleaned based on size
    shouldCleanFile(filePath) {
        try {
            if (!fs.existsSync(filePath)) return false;
            
            const stats = fs.statSync(filePath);
            const fileSizeKB = stats.size / 1024;
            
            // Clean if file is larger than 500KB (approximately 1000+ records)
            return fileSizeKB > 500;
        } catch (error) {
            return false;
        }
    }

    // Legacy method - redirect to new separated storage
    async storeIndexData_OLD(indexSymbol, marketData) {
        return this.storeMarketData(indexSymbol, marketData);
    }

    // Backward compatible read methods that map comprehensive data to legacy format
    
    // Read index data with backward compatibility (returns only columns used by current app)
    async readIndexDataCompat(indexSymbol, date = null) {
        try {
            const targetDate = date || this.getISTDateString();
            const filepath = path.join(this.dataDir, `${indexSymbol}_INDEX_${targetDate}.csv`);
            
            if (!fs.existsSync(filepath)) {
                return [];
            }

            const csvData = fs.readFileSync(filepath, 'utf8');
            const lines = csvData.trim().split('\n');
            
            if (lines.length <= 1) return []; // No data or header only
            
            const headers = lines[0].split(',');
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = values[index];
                });
                
                // Map comprehensive data to legacy format for backward compatibility
                const legacyRecord = {
                    timestamp: record.timestamp,
                    symbol: record.symbol,
                    // Use 'ltp' if available (new format), fallback to 'price' (old format)
                    price: record.ltp || record.price || record.close || 0,
                    change: record.change || 0,
                    changePercent: record.changePercent || 0,
                    volume: record.volume || 0
                };
                
                data.push(legacyRecord);
            }
            
            return data;
        } catch (error) {
            console.error(`Error reading compatible index data for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Read futures data with backward compatibility (returns only columns used by current app)
    async readFuturesDataCompat(indexSymbol, date = null) {
        try {
            const targetDate = date || this.getISTDateString();
            const filepath = path.join(this.dataDir, `${indexSymbol}_FUTURES_${targetDate}.csv`);
            
            if (!fs.existsSync(filepath)) {
                return [];
            }

            const csvData = fs.readFileSync(filepath, 'utf8');
            const lines = csvData.trim().split('\n');
            
            if (lines.length <= 1) return []; // No data or header only
            
            const headers = lines[0].split(',');
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = values[index];
                });
                
                // Map comprehensive data to legacy format for backward compatibility
                const legacyRecord = {
                    timestamp: record.timestamp,
                    symbol: record.symbol,
                    // Use 'ltp' if available (new format), fallback to 'price' (old format)
                    price: record.ltp || record.price || record.close || 0,
                    change: record.change || 0,
                    changePercent: record.changePercent || 0,
                    // Use 'openInterest' if available (new format), fallback to older field
                    openInterest: record.openInterest || 0,
                    volume: record.volume || 0
                };
                
                data.push(legacyRecord);
            }
            
            return data;
        } catch (error) {
            console.error(`Error reading compatible futures data for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Update existing read methods to use compatibility layer
    async readIndexData(indexSymbol, date = null) {
        return this.readIndexDataCompat(indexSymbol, date);
    }

    async readFuturesData(indexSymbol, date = null) {
        return this.readFuturesDataCompat(indexSymbol, date);
    }

    // Read index data for a specific date string
    async readIndexDataByDate(indexSymbol, dateString) {
        try {
            const filepath = path.join(this.dataDir, `${indexSymbol}_INDEX_${dateString}.csv`);
            
            if (!fs.existsSync(filepath)) {
                return [];
            }

            const csvData = fs.readFileSync(filepath, 'utf8');
            const lines = csvData.trim().split('\n');
            
            if (lines.length <= 1) return []; // No data or header only
            
            const headers = lines[0].split(',');
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = values[index];
                });
                
                // Map comprehensive data to legacy format for backward compatibility
                const legacyRecord = {
                    timestamp: record.timestamp,
                    symbol: record.symbol,
                    // Use 'ltp' if available (new format), fallback to 'price' (old format)
                    price: record.ltp || record.price || record.close || 0,
                    change: record.change || 0,
                    changePercent: record.changePercent || 0,
                    volume: record.volume || 0
                };
                
                data.push(legacyRecord);
            }
            
            return data;
        } catch (error) {
            console.error(`Error reading index data by date for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Read futures data for a specific date string
    async readFuturesDataByDate(indexSymbol, dateString) {
        try {
            const filepath = path.join(this.dataDir, `${indexSymbol}_FUTURES_${dateString}.csv`);
            
            if (!fs.existsSync(filepath)) {
                return [];
            }

            const csvData = fs.readFileSync(filepath, 'utf8');
            const lines = csvData.trim().split('\n');
            
            if (lines.length <= 1) return []; // No data or header only
            
            const headers = lines[0].split(',');
            const data = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',');
                const record = {};
                headers.forEach((header, index) => {
                    record[header] = values[index];
                });
                
                // Map comprehensive data to legacy format for backward compatibility
                const legacyRecord = {
                    timestamp: record.timestamp,
                    symbol: record.symbol,
                    // Use 'ltp' if available (new format), fallback to 'price' (old format)
                    price: record.ltp || record.price || record.close || 0,
                    change: record.change || 0,
                    changePercent: record.changePercent || 0,
                    // Use 'openInterest' if available (new format), fallback to older field
                    openInterest: record.openInterest || 0,
                    volume: record.volume || 0
                };
                
                data.push(legacyRecord);
            }
            
            return data;
        } catch (error) {
            console.error(`Error reading futures data by date for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Get chart data combining index and futures (for existing API compatibility)
    async getChartData(indexSymbol, hours = 12) {
        try {
            console.log(`📊 Getting chart data for ${indexSymbol} (${hours} hours)`);
            
            // Read from consolidated files instead of daily files
            const indexFile = this.getConsolidatedIndexDataFile(indexSymbol);
            const futuresFile = this.getConsolidatedFuturesDataFile(indexSymbol);
            
            // Check if files exist
            if (!fs.existsSync(indexFile) || !fs.existsSync(futuresFile)) {
                console.log(`⚠️ No data files found for ${indexSymbol}`);
                return [];
            }
            
            // Read the consolidated files
            const indexData = await this.readCSVFile(indexFile);
            const futuresData = await this.readCSVFile(futuresFile);
            
            if (!indexData.length || !futuresData.length) {
                console.log(`⚠️ Empty data files for ${indexSymbol}`);
                return [];
            }
            
            // Process and combine the data
            const combinedData = [];
            
            // Create a map of timestamps to make matching easier
            const indexMap = new Map();
            indexData.forEach(item => {
                indexMap.set(item.timestamp, item);
            });
            
            // Filter data by time if hours parameter is provided
            const cutoffTime = hours ? new Date(Date.now() - (hours * 60 * 60 * 1000)) : null;
            
            // Sort the futures data by timestamp
            futuresData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Filter by the cutoff time if needed
            const filteredFuturesData = cutoffTime 
                ? futuresData.filter(item => new Date(item.timestamp) >= cutoffTime)
                : futuresData;
            
            // Combine matching timestamps
            filteredFuturesData.forEach(futuresItem => {
                if (indexMap.has(futuresItem.timestamp)) {
                    const indexItem = indexMap.get(futuresItem.timestamp);
                    
                    // Calculate premium values
                    const premium = parseFloat(futuresItem.close) - parseFloat(indexItem.close);
                    
                    // Format data for chart display
                    combinedData.push({
                        timestamp: futuresItem.timestamp,
                        date: new Date(futuresItem.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata'
                        }),
                        index: parseFloat(indexItem.close),
                        indexOpen: parseFloat(indexItem.open),
                        indexHigh: parseFloat(indexItem.high),
                        indexLow: parseFloat(indexItem.low),
                        indexHMA55: parseFloat(indexItem.HMA55) || null,
                        futures: parseFloat(futuresItem.close),
                        futuresOpen: parseFloat(futuresItem.open),
                        futuresHigh: parseFloat(futuresItem.high),
                        futuresLow: parseFloat(futuresItem.low),
                        futuresHMA55: parseFloat(futuresItem.HMA55) || null,
                        premium: premium,
                        premiumPercent: (premium / parseFloat(indexItem.close) * 100)
                    });
                }
            });
            
            // Sort by timestamp
            combinedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            console.log(`✅ Returning ${combinedData.length} chart data points for ${indexSymbol}`);
            return combinedData;
            
        } catch (error) {
            console.error(`❌ Error getting chart data for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Get yesterday's chart data specifically
    async getYesterdayChartData(indexSymbol) {
        try {
            // Calculate yesterday's date, skipping weekends
            const today = new Date();
            const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
            
            // If yesterday was weekend, go to previous Friday
            while (yesterday.getDay() === 0 || yesterday.getDay() === 6) {
                yesterday.setDate(yesterday.getDate() - 1);
            }
            
            const year = yesterday.getFullYear();
            const month = String(yesterday.getMonth() + 1).padStart(2, '0');
            const day = String(yesterday.getDate()).padStart(2, '0');
            const yesterdayDate = `${year}-${month}-${day}`;
            
            console.log(`📅 Fetching yesterday's data: ${yesterdayDate}`);
            
            // Read from consolidated files instead of daily files
            const indexFile = this.getConsolidatedIndexDataFile(indexSymbol);
            const futuresFile = this.getConsolidatedFuturesDataFile(indexSymbol);
            
            // Check if files exist
            if (!fs.existsSync(indexFile) || !fs.existsSync(futuresFile)) {
                console.log(`⚠️ No data files found for ${indexSymbol}`);
                return [];
            }
            
            // Read the consolidated files
            const indexData = await this.readCSVFile(indexFile);
            const futuresData = await this.readCSVFile(futuresFile);
            
            if (!indexData.length || !futuresData.length) {
                console.log(`⚠️ Empty data files for ${indexSymbol}`);
                return [];
            }
            
            // Filter to just yesterday's trading session (9:15 AM to 3:30 PM)
            const yesterdayStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 9, 15, 0);
            const yesterdayEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 15, 30, 0);
            
            const tradingSessionIndexData = indexData.filter(record => {
                const recordTime = new Date(record.timestamp);
                return recordTime >= yesterdayStart && recordTime <= yesterdayEnd;
            });
            
            console.log(`📊 Yesterday's trading session: ${tradingSessionIndexData.length} data points`);
            
            if (tradingSessionIndexData.length === 0) {
                console.log(`⚠️ No data found for ${indexSymbol} on ${yesterdayDate}`);
                return [];
            }
            
            // Create a map of timestamps to make matching easier
            const indexMap = new Map();
            tradingSessionIndexData.forEach(item => {
                indexMap.set(item.timestamp, item);
            });
            
            // Filter futures data for yesterday as well
            const tradingSessionFuturesData = futuresData.filter(record => {
                const recordTime = new Date(record.timestamp);
                return recordTime >= yesterdayStart && recordTime <= yesterdayEnd;
            });
            
            // Combine matching timestamps
            const combinedData = [];
            tradingSessionFuturesData.forEach(futuresItem => {
                if (indexMap.has(futuresItem.timestamp)) {
                    const indexItem = indexMap.get(futuresItem.timestamp);
                    
                    // Calculate premium values
                    const indexPrice = parseFloat(indexItem.close);
                    const futuresPrice = parseFloat(futuresItem.close);
                    const premium = futuresPrice - indexPrice;
                    
                    // Format data for chart display
                    combinedData.push({
                        timestamp: futuresItem.timestamp,
                        time: new Date(futuresItem.timestamp).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit',
                            timeZone: 'Asia/Kolkata'
                        }),
                        index: indexPrice,
                        futures: futuresPrice,
                        indexPrice: indexPrice,
                        futuresPrice: futuresPrice,
                        premium: premium,
                        premiumPercent: indexPrice > 0 ? ((premium / indexPrice) * 100) : 0.1,
                        indexHMA55: parseFloat(indexItem.HMA55) || null,
                        futuresHMA55: parseFloat(futuresItem.HMA55) || null,
                        volume: parseInt(indexItem.volume) || 0,
                        openInterest: parseInt(futuresItem.openInterest) || 0
                    });
                }
            });
            
            // Sort by timestamp
            combinedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            return combinedData;
        } catch (error) {
            console.error(`Error getting yesterday's chart data for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Cleanup old data (keep only the last N market days, excluding weekends)
    async cleanupOldData(marketDaysToKeep = 3) {
        try {
            const files = await fs.promises.readdir(this.dataDir);
            
            // Get the last N market days (excluding weekends)
            const marketDatesToKeep = this.getLastNMarketDays(marketDaysToKeep);
            const marketDateStrings = marketDatesToKeep.map(date => this.getDateString(date));
            
            console.log(`🧹 Data cleanup: Keeping data for these ${marketDaysToKeep} market days: ${marketDateStrings.join(', ')}`);

            let deletedCount = 0;
            let keptCount = 0;

            for (const file of files) {
                if (file.endsWith('.csv')) {
                    const filePath = path.join(this.dataDir, file);
                    
                    try {
                        // Extract date from filename (format: SYMBOL_YYYY-MM-DD.csv)
                        const fileNameParts = file.split('_');
                        if (fileNameParts.length >= 2) {
                            const datePart = fileNameParts[fileNameParts.length - 1].replace('.csv', '');
                            
                            if (marketDateStrings.includes(datePart)) {
                                console.log(`✅ Keeping market day data: ${file} (${datePart})`);
                                keptCount++;
                            } else {
                                await fs.promises.unlink(filePath);
                                console.log(`🗑️ Deleted old data file: ${file} (${datePart})`);
                                deletedCount++;
                            }
                        } else {
                            // Fallback for files without proper naming
                            const stats = await fs.promises.stat(filePath);
                            const fileDate = stats.mtime;
                            const oldestMarketDay = marketDatesToKeep[0];
                            
                            if (fileDate < oldestMarketDay) {
                                await fs.promises.unlink(filePath);
                                console.log(`🗑️ Deleted old data file (by mtime): ${file}`);
                                deletedCount++;
                            } else {
                                keptCount++;
                            }
                        }
                    } catch (fileError) {
                        console.warn(`⚠️ Could not process file ${file}:`, fileError.message);
                    }
                }
            }
            
            console.log(`📊 Data cleanup complete: Deleted ${deletedCount} files, Kept ${keptCount} files for ${marketDaysToKeep} market days`);
            return { deletedCount, keptCount, marketDaysKept: marketDateStrings };
        } catch (error) {
            console.error('❌ Error cleaning up old data:', error);
            return { deletedCount: 0, keptCount: 0, error: error.message };
        }
    }

    // Get the last N market days (excluding weekends and holidays) - IST timezone aware
    getLastNMarketDays(days = 3) {
        const marketDates = [];
        const istOffset = 5.5 * 60 * 60 * 1000; // IST offset from UTC
        const istNow = new Date(new Date().getTime() + istOffset);
        let dayOffset = 0;
        const holidayService = require('./holidayService');

        while (marketDates.length < days) {
            const targetDate = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate() - dayOffset);
            if (holidayService.isMarketOpen(targetDate)) {
                marketDates.push(new Date(targetDate));
            }
            dayOffset++;
        }

        return marketDates.reverse(); // Return oldest to newest
    }

    // Get date string in IST timezone (consistent with marketDataService)
    getDateString(date) {
        const istOffset = 5.5 * 60 * 60 * 1000;
        const istDate = new Date(date.getTime() + istOffset);
        return istDate.toISOString().split('T')[0];
    }

    // Check if we have recent data for an index (within last 2 minutes)
    async hasRecentData(indexSymbol) {
        try {
            const data = await this.readIndexData(indexSymbol);
            if (data.length === 0) return false;

            const lastDataPoint = data[data.length - 1];
            const lastTimestamp = new Date(lastDataPoint.timestamp);
            const now = new Date();
            const diffMinutes = (now - lastTimestamp) / (1000 * 60);

            return diffMinutes < 2; // Has data within last 2 minutes
        } catch (error) {
            return false;
        }
    }

    // Get missing data periods for backfilling
    async getMissingDataPeriods(indexSymbol, startTime, endTime) {
        try {
            const data = await this.readIndexData(indexSymbol);
            const missingPeriods = [];
            
            if (data.length === 0) {
                return [{ start: startTime, end: endTime }];
            }

            // Sort data by timestamp
            data.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

            let lastTimestamp = new Date(startTime);
            
            for (const point of data) {
                const pointTime = new Date(point.timestamp);
                
                // If there's a gap of more than 2 minutes, it's a missing period
                if (pointTime - lastTimestamp > 2 * 60 * 1000) {
                    missingPeriods.push({
                        start: lastTimestamp.toISOString(),
                        end: pointTime.toISOString()
                    });
                }
                
                lastTimestamp = pointTime;
            }

            // Check if there's missing data from last point to endTime
            if (new Date(endTime) - lastTimestamp > 2 * 60 * 1000) {
                missingPeriods.push({
                    start: lastTimestamp.toISOString(),
                    end: endTime
                });
            }

            return missingPeriods;
        } catch (error) {
            console.error('Error getting missing data periods:', error);
            return [];
        }
    }

    // Get index data for a specific time period
    async getIndexData(indexSymbol, hours = 3) {
        try {
            const data = await this.readIndexData(indexSymbol);
            
            if (data.length === 0) return [];

            // Filter data for the last N hours
            const hoursAgo = new Date(Date.now() - (hours * 60 * 60 * 1000));
            
            return data.filter(record => {
                const recordTime = new Date(record.timestamp);
                return recordTime >= hoursAgo;
            });
        } catch (error) {
            console.error(`Error getting index data for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Get latest market data for fallback when API fails
    async getLatestMarketData(indexSymbol) {
        try {
            console.log(`📊 Getting latest market data for ${indexSymbol}`);
            
            // Read from consolidated files instead of daily files
            const indexFile = this.getConsolidatedIndexDataFile(indexSymbol);
            const futuresFile = this.getConsolidatedFuturesDataFile(indexSymbol);
            
            // Check if files exist
            if (!fs.existsSync(indexFile) || !fs.existsSync(futuresFile)) {
                console.log(`⚠️ No data files found for ${indexSymbol}`);
                return [];
            }
            
            // Read the consolidated files
            const indexData = await this.readCSVFile(indexFile);
            const futuresData = await this.readCSVFile(futuresFile);
            
            if (!indexData.length || !futuresData.length) {
                console.log(`⚠️ Empty data files for ${indexSymbol}`);
                return [];
            }
            
            // Process and combine the data
            const combinedData = [];
            
            // Create a map of timestamps to make matching easier
            const indexMap = new Map();
            indexData.forEach(item => {
                indexMap.set(item.timestamp, item);
            });
            
            // Sort the futures data by timestamp to ensure chronological order
            futuresData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            // Combine matching timestamps
            futuresData.forEach(futuresItem => {
                if (indexMap.has(futuresItem.timestamp)) {
                    const indexItem = indexMap.get(futuresItem.timestamp);
                    
                    // Add combined record with both index and futures data
                    combinedData.push({
                        timestamp: futuresItem.timestamp,
                        price: parseFloat(indexItem.close) || 0,
                        open: parseFloat(indexItem.open) || 0,
                        high: parseFloat(indexItem.high) || 0,
                        low: parseFloat(indexItem.low) || 0,
                        close: parseFloat(indexItem.close) || 0,
                        change: parseFloat(indexItem.close) - parseFloat(indexItem.open) || 0,
                        changePercent: ((parseFloat(indexItem.close) - parseFloat(indexItem.open)) / parseFloat(indexItem.open) * 100) || 0,
                        volume: parseInt(indexItem.volume) || 0,
                        indexHMA55: parseFloat(indexItem.HMA55) || null,
                        futuresPrice: parseFloat(futuresItem.close) || 0,
                        futuresOpen: parseFloat(futuresItem.open) || 0,
                        futuresHigh: parseFloat(futuresItem.high) || 0,
                        futuresLow: parseFloat(futuresItem.low) || 0,
                        futuresClose: parseFloat(futuresItem.close) || 0,
                        futuresChange: parseFloat(futuresItem.close) - parseFloat(futuresItem.open) || 0,
                        futuresChangePercent: ((parseFloat(futuresItem.close) - parseFloat(futuresItem.open)) / parseFloat(futuresItem.open) * 100) || 0,
                        futuresVolume: parseInt(futuresItem.volume) || 0,
                        futuresHMA55: parseFloat(futuresItem.HMA55) || null,
                        premiumValue: parseFloat(futuresItem.close) - parseFloat(indexItem.close) || 0
                    });
                }
            });
            
            // Sort combined data by timestamp
            combinedData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            
            console.log(`✅ Found ${combinedData.length} data points for ${indexSymbol}`);
            return combinedData;
            
        } catch (error) {
            console.error(`❌ Error getting latest market data for ${indexSymbol}:`, error);
            return [];
        }
    }

    // Helper function to read CSV files
    async readCSVFile(filePath) {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(filePath)) {
                resolve([]);
                return;
            }
            
            const results = [];
            const fs = require('fs');
            const csv = require('csv-parser');
            
            fs.createReadStream(filePath)
                .pipe(csv())
                .on('data', (data) => results.push(data))
                .on('end', () => resolve(results))
                .on('error', (error) => reject(error));
        });
    }

    // NEW: Store index data in OHLCV format
    async storeIndexDataOHLCV(indexSymbol, ohlcvData) {
        try {
            const timestamp = timestampService.formatTimestampForStorage(ohlcvData.timestamp);
            const filepath = this.getIndexDataFile(indexSymbol, ohlcvData.timestamp);
            
            const record = {
                timestamp,
                symbol: indexSymbol,
                ltp: ohlcvData.ltp || ohlcvData.close || 0,
                open: ohlcvData.open || 0,
                high: ohlcvData.high || 0,
                low: ohlcvData.low || 0,
                close: ohlcvData.close || 0,
                volume: ohlcvData.volume || 0
            };

            const csvStringifier = createCsvWriter({
                header: [
                    { id: 'timestamp', title: 'timestamp' },
                    { id: 'symbol', title: 'symbol' },
                    { id: 'ltp', title: 'ltp' },
                    { id: 'open', title: 'open' },
                    { id: 'high', title: 'high' },
                    { id: 'low', title: 'low' },
                    { id: 'close', title: 'close' },
                    { id: 'volume', title: 'volume' }
                ]
            });

            const csvHeader = !fs.existsSync(filepath) ? csvStringifier.getHeaderString() : '';
            const csvRecord = csvStringifier.stringifyRecords([record]);
            
            fs.appendFileSync(filepath, csvHeader + csvRecord);
            console.log(`✅ OHLCV data stored for ${indexSymbol} INDEX at ${timestamp}`);
            
            return { success: true, timestamp, filepath };
        } catch (error) {
            console.error(`Error storing OHLCV index data for ${indexSymbol}:`, error);
            return { success: false, error: error.message };
        }
    }

    // NEW: Store futures data in OHLCV format
    async storeFuturesDataOHLCV(indexSymbol, ohlcvData) {
        try {
            const timestamp = timestampService.formatTimestampForStorage(ohlcvData.timestamp);
            const filepath = this.getFuturesDataFile(indexSymbol, ohlcvData.timestamp);
            
            const record = {
                timestamp,
                symbol: indexSymbol,
                ltp: ohlcvData.ltp || ohlcvData.close || 0,
                open: ohlcvData.open || 0,
                high: ohlcvData.high || 0,
                low: ohlcvData.low || 0,
                close: ohlcvData.close || 0,
                volume: ohlcvData.volume || 0
            };

            const csvStringifier = createCsvWriter({
                header: [
                    { id: 'timestamp', title: 'timestamp' },
                    { id: 'symbol', title: 'symbol' },
                    { id: 'ltp', title: 'ltp' },
                    { id: 'open', title: 'open' },
                    { id: 'high', title: 'high' },
                    { id: 'low', title: 'low' },
                    { id: 'close', title: 'close' },
                    { id: 'volume', title: 'volume' }
                ]
            });

            const csvHeader = !fs.existsSync(filepath) ? csvStringifier.getHeaderString() : '';
            const csvRecord = csvStringifier.stringifyRecords([record]);
            
            fs.appendFileSync(filepath, csvHeader + csvRecord);
            console.log(`✅ OHLCV data stored for ${indexSymbol} FUTURES at ${timestamp}`);
            
            return { success: true, timestamp, filepath };
        } catch (error) {
            console.error(`Error storing OHLCV futures data for ${indexSymbol}:`, error);
            return { success: false, error: error.message };
        }
    }

    // --- HMA Trend Analysis for Chart Card ---
    async getTrendAnalysisForChart(indexSymbol) {
        const fs = require('fs');
        const path = require('path');
        const indexFile = this.getConsolidatedIndexDataFile(indexSymbol);
        
        function parseCsv(file) {
            if (!fs.existsSync(file)) return [];
            const lines = fs.readFileSync(file, 'utf8').trim().split('\n');
            if (lines.length <= 1) return [];
            const headers = lines[0].split(',');
            return lines.slice(1).map(line => {
                const values = line.split(',');
                const obj = {};
                headers.forEach((h, i) => obj[h] = values[i]);
                return obj;
            });
        }
        // Helper to find last crossover (price crossing HMA)
        function findLastCrossover(data) {
            let last = null;
            for (let i = data.length - 2; i >= 0; i--) {
                const prev = parseFloat(data[i].close);
                const prevHMA = parseFloat(data[i].HMA55);
                const curr = parseFloat(data[i+1].close);
                const currHMA = parseFloat(data[i+1].HMA55);
                if (isNaN(prev) || isNaN(prevHMA) || isNaN(curr) || isNaN(currHMA)) continue;
                if ((prev < prevHMA && curr > currHMA) || (prev > prevHMA && curr < currHMA)) {
                    last = { idx: i+1, time: data[i+1].timestamp, up: curr > currHMA };
                    break;
                }
            }
            return last;
        }
        // Helper to find last direction change in HMA
        function findLastDirectionChange(data) {
            let last = null;
            for (let i = data.length - 2; i >= 0; i--) {
                const prev = parseFloat(data[i].HMA55);
                const curr = parseFloat(data[i+1].HMA55);
                if (isNaN(prev) || isNaN(curr)) continue;
                if ((prev < curr && curr - prev > 0.01) || (prev > curr && prev - curr > 0.01)) {
                    last = { idx: i+1, time: data[i+1].timestamp, up: curr > prev };
                    break;
                }
            }
            return last;
        }
        // Helper to get time ago string
        function timeAgo(ts) {
            if (!ts) return 'N/A';
            const t = new Date(ts);
            const now = new Date();
            const diff = Math.floor((now - t) / 1000);
            if (diff < 60) return `${diff}s ago`;
            if (diff < 3600) return `${Math.floor(diff/60)}m ${diff%60}s ago`;
            return `${Math.floor(diff/3600)}h ${Math.floor((diff%3600)/60)}m ago`;
        }
        // Read the consolidated file data
        const indexData = parseCsv(indexFile);
        
        if (!indexData || indexData.length === 0) {
            console.log(`⚠️ No data found for ${indexSymbol} trend analysis`);
            return {
                hma1minTrend: 'N/A',
                hma1minDirection: 'N/A',
                hma5minTrend: 'N/A',
                hma5minDirection: 'N/A',
                crossover: 'N/A'
            };
        }
        
        // Create 5-min data by grouping 1-min data
        const fiveMinData = [];
        for (let i = 0; i < indexData.length; i += 5) {
            const group = indexData.slice(i, Math.min(i + 5, indexData.length));
            if (group.length > 0) {
                const lastCandle = group[group.length - 1];
                fiveMinData.push({
                    timestamp: lastCandle.timestamp,
                    close: lastCandle.close,
                    HMA55: lastCandle.HMA55
                });
            }
        }
        
        // --- 1-min analysis ---
        const last1 = indexData[indexData.length-1];
        const prev1 = indexData.length > 1 ? indexData[indexData.length-2] : null;
        
        // Trend: price above HMA = bullish
        let trend1 = null, trend1Time = null;
        const cross1 = findLastCrossover(indexData);
        if (last1 && !isNaN(parseFloat(last1.close)) && !isNaN(parseFloat(last1.HMA55))) {
            trend1 = parseFloat(last1.close) > parseFloat(last1.HMA55) ? 'Bullish' : 'Bearish';
            trend1Time = cross1 ? `${trend1} (Crossed over ${timeAgo(cross1.time)})` : trend1;
        }
        
        // Direction: HMA up or down
        let dir1 = null, dir1Time = null;
        const dirChange1 = findLastDirectionChange(indexData);
        if (last1 && prev1 && !isNaN(parseFloat(last1.HMA55)) && !isNaN(parseFloat(prev1.HMA55))) {
            dir1 = parseFloat(last1.HMA55) > parseFloat(prev1.HMA55) ? 'Upward' : 'Downward';
            dir1Time = dirChange1 ? `${dir1} (Changed ${timeAgo(dirChange1.time)})` : dir1;
        }
        
        // --- 5-min analysis ---
        const last5 = fiveMinData.length > 0 ? fiveMinData[fiveMinData.length-1] : null;
        const prev5 = fiveMinData.length > 1 ? fiveMinData[fiveMinData.length-2] : null;
        
        let trend5 = null, trend5Time = null;
        const cross5 = findLastCrossover(fiveMinData);
        if (last5 && !isNaN(parseFloat(last5.close)) && !isNaN(parseFloat(last5.HMA55))) {
            trend5 = parseFloat(last5.close) > parseFloat(last5.HMA55) ? 'Bullish' : 'Bearish';
            trend5Time = cross5 ? `${trend5} (Crossed over ${timeAgo(cross5.time)})` : trend5;
        }
        
        let dir5 = null, dir5Time = null;
        const dirChange5 = findLastDirectionChange(fiveMinData);
        if (last5 && prev5 && !isNaN(parseFloat(last5.HMA55)) && !isNaN(parseFloat(prev5.HMA55))) {
            dir5 = parseFloat(last5.HMA55) > parseFloat(prev5.HMA55) ? 'Upward' : 'Downward';
            dir5Time = dirChange5 ? `${dir5} (Changed ${timeAgo(dirChange5.time)})` : dir5;
        }
        
        // --- Crossover logic ---
        let crossover = null;
        if (last1 && last5 && !isNaN(parseFloat(last1.close)) && !isNaN(parseFloat(last1.HMA55)) && !isNaN(parseFloat(last5.HMA55))) {
            const close = parseFloat(last1.close);
            const hma1 = parseFloat(last1.HMA55);
            const hma5 = parseFloat(last5.HMA55);
            
            if (close > hma5 && close > hma1) {
                crossover = 'Extremely Bullish';
            } else if (close > hma5 && close < hma1) {
                crossover = 'Bullish with bearish trend forming';
            } else if (close < hma5 && close < hma1) {
                crossover = 'Extremely Bearish';
            } else {
                crossover = 'Mixed/Neutral';
            }
        }
        
        return {
            hma1minTrend: trend1Time || 'N/A',
            hma1minDirection: dir1Time || 'N/A',
            hma5minTrend: trend5Time || 'N/A',
            hma5minDirection: dir5Time || 'N/A',
            crossover: crossover || 'N/A'
        };
    }
}

module.exports = new StorageService(); 