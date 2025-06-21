import { MonitorEntry } from '../types';
import { HMAService } from './hmaService';
import { LiveMarketDataService } from './liveMarketDataService';
import { PersistentTradingStateService } from './persistentTradingStateService';
import { SymbolConfigService } from './symbolConfig';
import { OrderService } from './orderService';

export class MultiSymbolMonitoringService {
  private static monitoredSymbols: MonitorEntry[] = [];
  private static isMonitoring: boolean = false;
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static readonly STORAGE_KEY = 'victor_monitored_symbols';
  
  // Rate limiting for Fyers API: 10 requests/second, 200/minute
  private static lastApiCallTime: number = 0;
  private static apiCallCount: number = 0;
  private static readonly MIN_INTERVAL_BETWEEN_CALLS = 150; // 150ms = ~6.7 calls/second (buffer for safety)
  private static readonly RESET_COUNT_INTERVAL = 60000; // Reset count every minute

  /**
   * Initialize the service and load persisted symbols
   */
  static initialize(): void {
    this.loadMonitoredSymbols();
    
    // Resume monitoring if we have symbols
    if (this.monitoredSymbols.length > 0) {
      console.log(`🔄 Resuming monitoring for ${this.monitoredSymbols.length} symbols`);
      this.startMonitoring();
    }
  }

  /**
   * Add a symbol to monitoring
   */
  static async addSymbolToMonitoring(
    symbol: string,
    type: 'CE' | 'PE',
    lots: number,
    targetPoints: number,
    stopLossPoints: number,
    entryMethod: 'MARKET' | 'LIMIT'
  ): Promise<void> {
    // Check if symbol is already being monitored
    const existingIndex = this.monitoredSymbols.findIndex(entry => entry.symbol === symbol);
    if (existingIndex >= 0) {
      console.log(`⚠️ Symbol ${symbol} is already being monitored`);
      return;
    }

    try {
      console.log(`📊 Calculating HMA for ${symbol}...`);
      const hmaResult = await HMAService.fetchAndCalculateHMA(symbol);

      const monitorEntry: MonitorEntry = {
        id: `monitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        symbol,
        type,
        currentLTP: null,
        hmaValue: hmaResult.currentHMA,
        triggerStatus: 'WAITING',
        entryPrice: null,
        lastUpdate: null,
        crossoverSignalTime: null,
        lots,
        targetPoints,
        stopLossPoints,
        entryMethod,
        addedAt: new Date()
      };

      this.monitoredSymbols.push(monitorEntry);
      this.saveMonitoredSymbols();

      console.log(`✅ Added ${symbol} to monitoring with HMA: ${hmaResult.currentHMA.toFixed(2)}`);

      // Start monitoring if not already running
      if (!this.isMonitoring) {
        this.startMonitoring();
      }
    } catch (error) {
      console.error(`❌ Error adding ${symbol} to monitoring:`, error);
      throw error;
    }
  }

  /**
   * Remove a symbol from monitoring
   */
  static removeSymbolFromMonitoring(symbolId: string): void {
    const index = this.monitoredSymbols.findIndex(entry => entry.id === symbolId);
    if (index >= 0) {
      const symbol = this.monitoredSymbols[index].symbol;
      this.monitoredSymbols.splice(index, 1);
      this.saveMonitoredSymbols();
      
      console.log(`🛑 Removed ${symbol} from monitoring`);

      // Stop monitoring if no symbols left
      if (this.monitoredSymbols.length === 0) {
        this.stopMonitoring();
      }
    }
  }

  /**
   * Get all monitored symbols
   */
  static getMonitoredSymbols(): MonitorEntry[] {
    return [...this.monitoredSymbols];
  }

  /**
   * Start monitoring all symbols
   */
  static startMonitoring(): void {
    if (this.isMonitoring || this.monitoredSymbols.length === 0) {
      return;
    }

    console.log(`🚀 Starting monitoring for ${this.monitoredSymbols.length} symbols...`);
    this.isMonitoring = true;

    // Initial fetch
    this.monitorAllSymbols();

    // Set up interval (every 2 seconds)
    this.monitoringInterval = setInterval(() => {
      this.monitorAllSymbols();
    }, 2000);

    console.log('✅ Multi-symbol monitoring started');
  }

  /**
   * Stop monitoring all symbols
   */
  static stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('🛑 Stopping multi-symbol monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('✅ Multi-symbol monitoring stopped');
  }

  /**
   * Monitor all symbols with rate limiting
   */
  private static async monitorAllSymbols(): Promise<void> {
    if (this.monitoredSymbols.length === 0) return;

    try {
      // If we have many symbols, we need to batch them to respect rate limits
      const batchSize = 5; // Process 5 symbols at a time
      const batches = [];
      
      for (let i = 0; i < this.monitoredSymbols.length; i += batchSize) {
        batches.push(this.monitoredSymbols.slice(i, i + batchSize));
      }

      // Process each batch with delay
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // Add delay between batches (except first)
        if (batchIndex > 0) {
          await this.rateLimitedDelay();
        }
        
        await this.processBatch(batch);
      }

      // Save updated state
      this.saveMonitoredSymbols();

    } catch (error) {
      console.error('❌ Error in monitorAllSymbols:', error);
    }
  }

  /**
   * Process a batch of symbols
   */
  private static async processBatch(batch: MonitorEntry[]): Promise<void> {
    const marketDataService = new LiveMarketDataService();
    const symbols = batch.map(entry => entry.symbol);
    
    // Fetch market data for this batch
    const marketDataMap = await marketDataService.fetchMultipleMarketData(symbols);

    // Update each symbol in the batch
    for (const entry of batch) {
      const marketData = marketDataMap.get(entry.symbol);
      if (marketData) {
        entry.currentLTP = marketData.ltp;
        entry.lastUpdate = new Date();
        
        // Check for crossover
        await this.checkCrossover(entry, marketData.ltp);
      }
    }
  }

  /**
   * Rate limited delay to respect API limits
   */
  private static async rateLimitedDelay(): Promise<void> {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastApiCallTime;
    
    if (timeSinceLastCall < this.MIN_INTERVAL_BETWEEN_CALLS) {
      const delay = this.MIN_INTERVAL_BETWEEN_CALLS - timeSinceLastCall;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    this.lastApiCallTime = Date.now();
    this.apiCallCount++;
    
    // Reset count every minute
    if (this.apiCallCount === 1) {
      setTimeout(() => {
        this.apiCallCount = 0;
        console.log('🔄 API call count reset');
      }, this.RESET_COUNT_INTERVAL);
    }
    
    // Log rate limiting info
    if (this.apiCallCount % 10 === 0) {
      console.log(`📊 API Calls: ${this.apiCallCount} in current minute`);
    }
  }

  /**
   * Check for HMA crossover
   */
  private static async checkCrossover(entry: MonitorEntry, currentPrice: number): Promise<void> {
    if (!entry.hmaValue || entry.triggerStatus !== 'WAITING') {
      return;
    }

    const priceIsAboveHMA = currentPrice > entry.hmaValue;

    if (priceIsAboveHMA) {
      if (!entry.crossoverSignalTime) {
        // Price crossed above HMA for the first time
        entry.crossoverSignalTime = new Date();
        console.log(`📈 ${entry.symbol} (${entry.type}) Price (${currentPrice}) crossed above HMA (${entry.hmaValue}). Waiting for 1-min candle close.`);
      } else {
        // Check if a new minute has started
        const now = new Date();
        if (now.getMinutes() !== entry.crossoverSignalTime.getMinutes()) {
          console.log(`✅ ${entry.symbol} (${entry.type}) Entry Confirmed! Price still above HMA at new candle.`);
          await this.executeEntry(entry, currentPrice);
          entry.crossoverSignalTime = null;
        }
      }
    } else {
      // Price is below HMA
      if (entry.crossoverSignalTime) {
        console.log(`📉 ${entry.symbol} (${entry.type}) Price fell below HMA. Cancelling entry signal.`);
        entry.crossoverSignalTime = null;
      }
    }
  }

  /**
   * Execute trade entry
   */
  private static async executeEntry(entry: MonitorEntry, price: number): Promise<void> {
    try {
      console.log(`💰 Executing ${entry.type} entry for ${entry.symbol} at ${price}...`);
      
      // Create properly formatted order data for Fyers API
      const orderData = OrderService.formatOrderData(
        entry.symbol,
        entry.lots,
        'BUY',
        entry.entryMethod,
        entry.entryMethod === 'LIMIT' ? price : 0,
        'INTRADAY',
        `Victor2.0-HMA-Entry-${entry.type}-${Date.now()}`
      );
      
      // Validate order data
      const validation = OrderService.validateOrderData(orderData);
      if (!validation.isValid) {
        console.error(`❌ Order validation failed for ${entry.symbol}:`, validation.errors);
        return;
      }
      
      // Log the properly formatted order (for development/debugging)
      OrderService.logOrderData(orderData, 'HMA Entry Order');
      console.log(`📋 Order Summary: ${OrderService.getOrderSummary(orderData)}`);
      
      // TODO: In live trading, this is where you would call the Fyers API:
      // const response = await fyersAPI.placeOrder(orderData);
      
      // Update entry status
      entry.triggerStatus = 'ENTERED';
      entry.entryPrice = price;
      
      // Remove from monitoring after execution (move to trade log)
      setTimeout(() => {
        this.removeSymbolFromMonitoring(entry.id);
        console.log(`🔄 ${entry.symbol} moved from monitoring to trade log`);
      }, 1000); // Small delay to ensure trade log is updated first
      
      // Add trade log using TradingService
      const { TradingService } = require('./tradingService');
      TradingService.addTradeLog({
        symbol: entry.symbol,
        action: 'BUY', // Use BUY for entries to match TradeLog interface
        quantity: orderData.qty, // Use calculated quantity from OrderService
        price: price,
        orderType: entry.entryMethod,
        status: 'COMPLETED',
        remarks: `HMA crossover entry - ${entry.lots} lots (${orderData.qty} qty) - Order Tag: ${orderData.orderTag}`
      });
      
      console.log(`✅ ${entry.symbol} (${entry.type}) entry executed: ${entry.lots} lots = ${orderData.qty} qty at ₹${price}`);
      
    } catch (error) {
      console.error(`❌ Error executing entry for ${entry.symbol}:`, error);
    }
  }

  /**
   * Save monitored symbols to localStorage
   */
  private static saveMonitoredSymbols(): void {
    try {
      const dataToSave = {
        symbols: this.monitoredSymbols,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (error) {
      console.error('❌ Error saving monitored symbols:', error);
    }
  }

  /**
   * Load monitored symbols from localStorage
   */
  private static loadMonitoredSymbols(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return;

      const parsed = JSON.parse(stored);
      
      // Check if data is from today
      const savedAt = new Date(parsed.savedAt);
      const now = new Date();
      const isToday = savedAt.toDateString() === now.toDateString();
      
      if (!isToday) {
        console.log('🗑️ Clearing old monitored symbols from different day');
        localStorage.removeItem(this.STORAGE_KEY);
        return;
      }

      // Convert date strings back to Date objects
      this.monitoredSymbols = parsed.symbols.map((entry: any) => ({
        ...entry,
        addedAt: new Date(entry.addedAt),
        lastUpdate: entry.lastUpdate ? new Date(entry.lastUpdate) : null,
        crossoverSignalTime: entry.crossoverSignalTime ? new Date(entry.crossoverSignalTime) : null
      }));

      console.log(`📥 Loaded ${this.monitoredSymbols.length} monitored symbols from localStorage`);
    } catch (error) {
      console.error('❌ Error loading monitored symbols:', error);
    }
  }

  /**
   * Clear all monitored symbols
   */
  static clearAllMonitoring(): void {
    this.stopMonitoring();
    this.monitoredSymbols = [];
    localStorage.removeItem(this.STORAGE_KEY);
    
    // Also stop TradingService monitoring to prevent conflicts
    try {
      const { TradingService } = require('./tradingService');
      TradingService.stopMonitoring();
      console.log('🛑 Also stopped TradingService monitoring to prevent conflicts');
    } catch (error) {
      console.log('ℹ️ TradingService not available or already stopped');
    }
    
    console.log('🗑️ Cleared all monitoring');
  }

  /**
   * Check if currently monitoring
   */
  static isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
} 