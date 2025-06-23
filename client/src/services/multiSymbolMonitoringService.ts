import { MonitorEntry } from '../types';
import { HMAService } from './hmaService';
import { LiveMarketDataService } from './liveMarketDataService';
import { PersistentTradingStateService } from './persistentTradingStateService';
import { SymbolConfigService } from './symbolConfig';
import { OrderService } from './orderService';
import { PersistentTradeLogService } from './persistentTradeLogService';

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
  private static readonly MONITORING_INTERVAL = 2000; // 2 seconds between market data updates
  private static currentBatchIndex = 0; // Track which batch of symbols to fetch next
  
  // Index symbols that are allowed to be monitored
  private static readonly ALLOWED_INDEX_SYMBOLS = [
    'NSE:NIFTY50-INDEX',
    'NSE:NIFTYBANK-INDEX',
    'BSE:SENSEX-INDEX'
  ];
  
  // Flag to control option symbol monitoring - set to true by default
  private static allowOptionSymbols = true;

  /**
   * Initialize the monitoring service
   */
  static initialize(): void {
    console.log('🔄 Initializing monitoring service');
    
    // Check if monitoring was active before page refresh/reload
    const shouldResumeMonitoring = localStorage.getItem('victor_monitoring_active') === 'true';
    
    if (!shouldResumeMonitoring) {
      // If monitoring is not active, clear any symbols from localStorage
      localStorage.removeItem(this.STORAGE_KEY);
      this.monitoredSymbols = [];
      console.log('🗑️ Monitoring not active, cleared any stored symbols');
      return;
    }
    
    // Load monitored symbols from localStorage only if monitoring should be resumed
    this.loadMonitoredSymbols();
    
    // Only start monitoring if we have symbols AND monitoring was active
    if (this.monitoredSymbols.length > 0) {
      console.log(`📊 Resuming monitoring for ${this.monitoredSymbols.length} symbols...`);
      this.startMonitoring();
    } else {
      // No symbols to monitor, clear the monitoring active flag
      localStorage.removeItem('victor_monitoring_active');
      console.log('⚠️ No symbols to monitor, cleared monitoring active flag');
    }
    
    // Reset API call counter and set up interval to reset it periodically
    this.apiCallCount = 0;
    this.lastApiCallTime = 0;
    
    setInterval(() => {
      this.apiCallCount = 0;
    }, this.RESET_COUNT_INTERVAL);
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
    entryMethod: 'MARKET' | 'LIMIT',
    autoExitOnTarget: boolean = true,
    autoExitOnStopLoss: boolean = true,
    trailingStopLoss: boolean = false,
    trailingStopLossOffset: number = 10,
    timeBasedExit: boolean = false,
    exitAtMarketClose: boolean = false,
    exitAfterMinutes: number = 60,
    targetType: 'POINTS' | 'PERCENTAGE' = 'POINTS',
    stopLossType: 'POINTS' | 'PERCENTAGE' = 'POINTS'
  ): Promise<void> {
    // Check if option symbols are allowed
    if (!this.allowOptionSymbols && (type === 'CE' || type === 'PE')) {
      console.log(`⚠️ Option symbol monitoring is currently disabled: ${symbol}`);
      return;
    }
    
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
        lastHMAUpdate: new Date(), // Initialize with current time since we just calculated HMA
        crossoverSignalTime: null,
        lots,
        targetPoints,
        stopLossPoints,
        entryMethod,
        addedAt: new Date(),
        autoExitOnTarget,
        autoExitOnStopLoss,
        trailingStopLoss,
        trailingStopLossOffset,
        timeBasedExit,
        exitAtMarketClose,
        exitAfterMinutes,
        targetType,
        stopLossType
      };

      // Initialize crossover tracking state
      (monitorEntry as any).previousPriceAboveHMA = null;

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
    
    // Reset batch index when starting monitoring
    this.currentBatchIndex = 0;
    
    // Set flag in localStorage that monitoring is active
    localStorage.setItem('victor_monitoring_active', 'true');

    // Initial fetch
    this.monitorAllSymbols();

    // Set up interval (every 2 seconds)
    this.monitoringInterval = setInterval(() => {
      this.monitorAllSymbols();
    }, this.MONITORING_INTERVAL);

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
    
    // Remove flags from localStorage
    localStorage.removeItem('victor_monitoring_active');
    localStorage.removeItem(this.STORAGE_KEY);

    // Clear all monitored symbols to ensure no background processes continue
    this.monitoredSymbols = [];
    
    console.log('✅ Multi-symbol monitoring stopped and all symbols cleared from localStorage');
  }

  /**
   * Monitor all symbols with rate limiting
   */
  private static async monitorAllSymbols(): Promise<void> {
    if (this.monitoredSymbols.length === 0) return;

    try {
      // Filter out only index symbols if option symbols are disabled
      const symbolsToMonitor = !this.allowOptionSymbols 
        ? this.monitoredSymbols.filter(entry => this.ALLOWED_INDEX_SYMBOLS.includes(entry.symbol))
        : this.monitoredSymbols;
        
      if (symbolsToMonitor.length === 0) return;
      
      // If we have many symbols, alternate between batches to avoid hitting rate limits
      const batchSize = 2; // Process 2 symbols at a time
      const batches = [];
      
      for (let i = 0; i < symbolsToMonitor.length; i += batchSize) {
        batches.push(symbolsToMonitor.slice(i, i + batchSize));
      }

      // If we have multiple batches, alternate between them
      if (batches.length > 1) {
        // Only process one batch per interval to avoid rate limiting
        const batchToProcess = batches[this.currentBatchIndex % batches.length];
        await this.processBatch(batchToProcess);
        
        // Move to next batch for next interval
        const nextBatchIndex = (this.currentBatchIndex + 1) % batches.length;
        
        console.log(`📊 Processed batch ${this.currentBatchIndex + 1}/${batches.length} with ${batchToProcess.length} symbols (${batchToProcess.map(s => s.symbol.split(':')[1]?.slice(-2) || s.symbol).join(', ')}). Next: batch ${nextBatchIndex + 1}`);
        
        this.currentBatchIndex = nextBatchIndex;
      } else if (batches.length === 1) {
        // If only one batch, process it normally
        await this.processBatch(batches[0]);
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
    try {
      // Get symbols for this batch
      const symbols = batch.map(entry => entry.symbol);
      
      // Fetch market data for all symbols in this batch
      const marketDataService = new LiveMarketDataService();
      const marketDataMap = await marketDataService.fetchMultipleMarketData(symbols);
      
      // Process each entry with its market data
      for (const entry of batch) {
        const marketData = marketDataMap.get(entry.symbol);
        if (!marketData) continue;
        
        // Update entry with latest data
        entry.currentLTP = marketData.ltp;
        entry.lastUpdate = new Date();
        
        // Update HMA value every 5 minutes to ensure we're using fresh HMA data
        await this.updateHMAIfNeeded(entry);
        
        // Check for crossover if waiting
        if (entry.triggerStatus === 'WAITING') {
          await this.checkCrossover(entry, marketData.ltp);
        } 
        // Check for exit conditions if already entered
        else if (entry.triggerStatus === 'ENTERED' && entry.entryPrice !== null) {
          await this.checkExitConditions(entry, marketData.ltp);
        }
      }
      
      // Save updated state
      this.saveMonitoredSymbols();
      
    } catch (error) {
      console.error('❌ Error in processBatch:', error);
    }
  }

  /**
   * Calculate if we should update HMA based on exact 5-minute intervals
   */
  private static shouldUpdateHMAAtInterval(): boolean {
    const now = new Date();
    
    // Convert to IST
    const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const minutes = istTime.getMinutes();
    const seconds = istTime.getSeconds();
    
    // Check if we're at a 5-minute interval (0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55 minutes)
    // and within the first 5 seconds of that minute
    const isAtFiveMinuteInterval = minutes % 5 === 0;
    const isWithinFirstFiveSeconds = seconds <= 5;
    
    return isAtFiveMinuteInterval && isWithinFirstFiveSeconds;
  }

  /**
   * Update HMA if we're at a 5-minute interval or if it's never been updated
   */
  private static async updateHMAIfNeeded(entry: MonitorEntry): Promise<void> {
    try {
      const now = new Date();
      const shouldUpdate = !entry.lastHMAUpdate || this.shouldUpdateHMAAtInterval();
      
      // Special case: If it's been more than 10 minutes, force update regardless of interval
      const tenMinutesInMs = 10 * 60 * 1000;
      const forceUpdate = entry.lastHMAUpdate && (now.getTime() - entry.lastHMAUpdate.getTime()) > tenMinutesInMs;
      
      if (shouldUpdate || forceUpdate) {
        // Import HMAService dynamically to avoid circular dependencies
        const { HMAService } = await import('./hmaService');
        
        // Get the current HMA value from cache (if live monitoring is active)
        const currentHMA = HMAService.getCurrentHMA(entry.symbol);
        
        if (currentHMA !== null) {
          // Update with cached HMA value
          entry.hmaValue = currentHMA;
          entry.lastHMAUpdate = now;
          
          const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
          const timeStr = istTime.toLocaleString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          
          console.log(`📈 Updated HMA for ${entry.symbol}: ${currentHMA.toFixed(2)} at ${timeStr} IST (5-min interval)`);
        } else {
          // If no cached value, fetch fresh HMA data
          console.log(`🔄 Fetching fresh HMA for ${entry.symbol} at 5-minute interval...`);
          const hmaConfig = await HMAService.fetchAndCalculateHMA(entry.symbol);
          entry.hmaValue = hmaConfig.currentHMA;
          entry.lastHMAUpdate = now;
          
          const istTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
          const timeStr = istTime.toLocaleString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
          
          console.log(`📈 Updated HMA for ${entry.symbol}: ${hmaConfig.currentHMA.toFixed(2)} at ${timeStr} IST (fresh fetch)`);
        }
      }
    } catch (error) {
      console.error(`❌ Error updating HMA for ${entry.symbol}:`, error);
      // Don't throw - continue with existing HMA value
    }
  }

  /**
   * Check if exit conditions are met for an entry
   */
  private static async checkExitConditions(entry: MonitorEntry, currentPrice: number): Promise<void> {
    if (!entry.entryPrice) return;
    
    let targetValue: number;
    let stopLossValue: number;
    
    // Calculate target and stop loss values based on type (points or percentage)
    if (entry.targetType === 'PERCENTAGE') {
      // Calculate target based on percentage of entry price
      targetValue = entry.entryPrice * (entry.targetPoints / 100);
    } else {
      // Default to points
      targetValue = entry.targetPoints;
    }
    
    if (entry.stopLossType === 'PERCENTAGE') {
      // Calculate stop loss based on percentage of entry price
      stopLossValue = entry.entryPrice * (entry.stopLossPoints / 100);
    } else {
      // Default to points
      stopLossValue = entry.stopLossPoints;
    }
    
    const priceDifference = currentPrice - entry.entryPrice;
    
    // Check target condition
    if (entry.autoExitOnTarget && priceDifference >= targetValue) {
      const targetDisplay = entry.targetType === 'PERCENTAGE' 
        ? `${entry.targetPoints}% (${targetValue.toFixed(2)} points)` 
        : `${targetValue} points`;
      
      console.log(`🎯 ${entry.symbol} Target reached! Exiting position...`);
      await this.executeExit(entry, currentPrice, `Target of ${targetDisplay} reached`);
      return;
    }
    
    // Check stop loss condition
    if (entry.autoExitOnStopLoss && priceDifference <= -stopLossValue) {
      const slDisplay = entry.stopLossType === 'PERCENTAGE' 
        ? `${entry.stopLossPoints}% (${stopLossValue.toFixed(2)} points)` 
        : `${stopLossValue} points`;
      
      console.log(`🛑 ${entry.symbol} Stop loss triggered! Exiting position...`);
      await this.executeExit(entry, currentPrice, `Stop loss of ${slDisplay} triggered`);
      return;
    }
    
    // Check trailing stop loss if enabled and we're in profit
    if (entry.trailingStopLoss && priceDifference > 0) {
      // Calculate trailing stop price
      const trailingStopPrice = currentPrice - entry.trailingStopLossOffset;
      
      // If trailing stop price is higher than our initial stop loss and price falls below it
      const initialStopLoss = entry.entryPrice - stopLossValue;
      if (trailingStopPrice > initialStopLoss && currentPrice <= trailingStopPrice) {
        console.log(`🔄 ${entry.symbol} Trailing stop loss triggered! Exiting position...`);
        await this.executeExit(entry, currentPrice, `Trailing stop loss triggered at ${entry.trailingStopLossOffset} points below peak`);
        return;
      }
    }
    
    // Check time-based exit conditions
    if (entry.timeBasedExit && entry.entryPrice) {
      const now = new Date();
      const entryTime = entry.lastUpdate || new Date();
      const minutesSinceEntry = (now.getTime() - entryTime.getTime()) / (1000 * 60);
      
      // Exit after specified minutes
      if (minutesSinceEntry >= entry.exitAfterMinutes) {
        console.log(`⏰ ${entry.symbol} Time-based exit triggered after ${entry.exitAfterMinutes} minutes`);
        await this.executeExit(entry, currentPrice, `Time-based exit after ${entry.exitAfterMinutes} minutes`);
        return;
      }
      
      // Exit at market close (assuming market closes at 3:30 PM)
      if (entry.exitAtMarketClose) {
        const marketCloseHour = 15; // 3 PM
        const marketCloseMinute = 30; // 30 minutes
        
        if (now.getHours() >= marketCloseHour && now.getMinutes() >= marketCloseMinute) {
          console.log(`🔔 ${entry.symbol} Market close exit triggered`);
          await this.executeExit(entry, currentPrice, 'Market close exit');
          return;
        }
      }
    }
  }
  
  /**
   * Execute exit for a position
   */
  private static async executeExit(entry: MonitorEntry, price: number, reason: string): Promise<void> {
    try {
      const quantity = SymbolConfigService.calculateQuantityFromLots('NIFTY', entry.lots);
      
      // Calculate P&L
      const pnl = entry.entryPrice ? (price - entry.entryPrice) * quantity : 0;
      
      // Create exit order
      const orderResult = await OrderService.placeOrder({
        symbol: entry.symbol,
        qty: quantity,
        side: -1,
        type: 2,
        productType: 'INTRADAY',
        limitPrice: 0,
        stopPrice: 0,
        validity: 'DAY',
        disclosedQty: 0,
        offlineOrder: false
      });
      
      console.log(`✅ Exit order placed for ${entry.symbol}: ${JSON.stringify(orderResult)}`);
      
      // Update entry status
      entry.triggerStatus = 'EXITED';
      this.saveMonitoredSymbols();
      
      // Add to persistent trade log
      const { PersistentTradeLogService } = await import('./persistentTradeLogService');
      await PersistentTradeLogService.addTradeLog({
        symbol: entry.symbol,
        action: 'SELL',
        price,
        quantity,
        orderType: 'MARKET',
        pnl,
        status: 'COMPLETED',
        remarks: `${entry.type} exit: ${reason} (P&L: ₹${pnl.toFixed(2)})`,
        tradingMode: 'PAPER' // Default to paper trading
      });
      
    } catch (error) {
      console.error(`❌ Error executing exit for ${entry.symbol}:`, error);
    }
  }

  /**
   * Enable or disable option symbol monitoring
   */
  static setOptionSymbolMonitoring(enabled: boolean): void {
    this.allowOptionSymbols = enabled;
    console.log(`${enabled ? '✅ Enabled' : '❌ Disabled'} option symbol monitoring`);
    
    // If disabling, remove any non-index symbols from monitoring
    if (!enabled) {
      const beforeCount = this.monitoredSymbols.length;
      this.monitoredSymbols = this.monitoredSymbols.filter(
        entry => this.ALLOWED_INDEX_SYMBOLS.includes(entry.symbol)
      );
      const afterCount = this.monitoredSymbols.length;
      
      if (beforeCount !== afterCount) {
        console.log(`🗑️ Removed ${beforeCount - afterCount} non-index symbols from monitoring`);
        this.saveMonitoredSymbols();
      }
    } else {
      // When enabling, load any saved symbols
      this.loadMonitoredSymbols();
    }
  }

  /**
   * Check if option symbol monitoring is enabled
   */
  static isOptionSymbolMonitoringEnabled(): boolean {
    return this.allowOptionSymbols;
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

    // Initialize previousPriceAboveHMA if not set
    if ((entry as any).previousPriceAboveHMA === null || (entry as any).previousPriceAboveHMA === undefined) {
      (entry as any).previousPriceAboveHMA = priceIsAboveHMA;
      console.log(`📊 ${entry.symbol} (${entry.type}) Initial state: Price ${currentPrice} ${priceIsAboveHMA ? 'above' : 'below'} HMA ${entry.hmaValue}`);
      return; // Don't trigger on first check, just record state
    }

    // Get the previous state from our stored data
    const previousPriceWasAboveHMA = (entry as any).previousPriceAboveHMA;
    
    // Only proceed if we have a valid previous state
    if (previousPriceWasAboveHMA === null || previousPriceWasAboveHMA === undefined) {
      (entry as any).previousPriceAboveHMA = priceIsAboveHMA;
      return;
    }

    // Detect actual crossover: price was below HMA and is now above HMA
    if (previousPriceWasAboveHMA === false && priceIsAboveHMA === true) {
      // This is an actual crossover!
      if (!entry.crossoverSignalTime) {
        entry.crossoverSignalTime = new Date();
        console.log(`🎯 ${entry.symbol} (${entry.type}) CROSSOVER DETECTED! Price (${currentPrice}) crossed above HMA (${entry.hmaValue}). Waiting for 1-min candle close.`);
      } else {
        // Check if a new minute has started since crossover
        const now = new Date();
        if (now.getMinutes() !== entry.crossoverSignalTime.getMinutes()) {
          console.log(`✅ ${entry.symbol} (${entry.type}) Entry Confirmed! Price still above HMA at new candle.`);
          await this.executeEntry(entry, currentPrice);
          entry.crossoverSignalTime = null;
        }
      }
    } else if (previousPriceWasAboveHMA === true && priceIsAboveHMA === false) {
      // Price fell back below HMA - cancel any pending crossover
      if (entry.crossoverSignalTime) {
        console.log(`📉 ${entry.symbol} (${entry.type}) Price fell below HMA. Cancelling crossover signal.`);
        entry.crossoverSignalTime = null;
      }
    } else if (priceIsAboveHMA && entry.crossoverSignalTime) {
      // Price is still above HMA and we have a pending crossover - check for candle close
      const now = new Date();
      if (now.getMinutes() !== entry.crossoverSignalTime.getMinutes()) {
        console.log(`✅ ${entry.symbol} (${entry.type}) Entry Confirmed! Price still above HMA at new candle.`);
        await this.executeEntry(entry, currentPrice);
        entry.crossoverSignalTime = null;
      }
    }
    
    // Update the previous state for next iteration
    (entry as any).previousPriceAboveHMA = priceIsAboveHMA;
    
    // Log current state for debugging
    console.log(`📈 ${entry.symbol} (${entry.type}) State: Price ${currentPrice} ${priceIsAboveHMA ? 'above' : 'below'} HMA ${entry.hmaValue} | Previous: ${previousPriceWasAboveHMA ? 'above' : 'below'} | Status: ${entry.triggerStatus}`);
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
      
      // Update entry status FIRST
      entry.triggerStatus = 'ENTERED';
      entry.entryPrice = price;
      this.saveMonitoredSymbols(); // Save immediately
      
      // Add trade log using PersistentTradeLogService directly
      const { PersistentTradeLogService } = await import('./persistentTradeLogService');
      const tradeLog = await PersistentTradeLogService.addTradeLog({
        symbol: entry.symbol,
        action: 'BUY', // Use BUY for entries to match TradeLog interface
        quantity: orderData.qty, // Use calculated quantity from OrderService
        price: price,
        orderType: entry.entryMethod,
        status: 'COMPLETED',
        pnl: null, // Entry trade has no P&L yet
        tradingMode: 'PAPER', // Default to paper trading
        remarks: `HMA crossover entry - ${entry.lots} lots (${orderData.qty} qty) - Target: ₹${(price + entry.targetPoints).toFixed(2)} - SL: ₹${(price - entry.stopLossPoints).toFixed(2)} - Order Tag: ${orderData.orderTag}`
      });

      console.log(`✅ Trade log created with ID: ${tradeLog.id} for ${entry.symbol}`);

      // Start live P&L tracking for this position IMMEDIATELY
      const { LivePnLTrackingService } = await import('./livePnLTrackingService');
      LivePnLTrackingService.addPosition(tradeLog);
      
      // Start tracking service if not already running
      if (!LivePnLTrackingService.isCurrentlyTracking()) {
        await LivePnLTrackingService.startTracking();
      }
      
      console.log(`✅ Live P&L tracking started for ${entry.symbol} with trade ID: ${tradeLog.id}`);
      
      // Remove from monitoring AFTER everything is set up (with a longer delay)
      setTimeout(() => {
        this.removeSymbolFromMonitoring(entry.id);
        console.log(`🔄 ${entry.symbol} removed from monitoring after successful trade execution`);
      }, 3000); // Increased delay to 3 seconds to ensure everything is processed
      
      console.log(`✅ ${entry.symbol} (${entry.type}) entry executed: ${entry.lots} lots = ${orderData.qty} qty at ₹${price}`);
      
    } catch (error) {
      console.error(`❌ Error executing entry for ${entry.symbol}:`, error);
      // Don't remove from monitoring if there was an error
    }
  }

  /**
   * Save monitored symbols to localStorage
   */
  private static saveMonitoredSymbols(): void {
    try {
      // If there are no symbols to save, remove the item from localStorage
      if (this.monitoredSymbols.length === 0) {
        localStorage.removeItem(this.STORAGE_KEY);
        console.log('🗑️ Removed all monitored symbols from localStorage');
        return;
      }
      
      // Save all symbols including index symbols
      const symbolsToSave = this.monitoredSymbols;
      
      // Don't save anything if option symbols are disabled
      if (!this.allowOptionSymbols) {
        return;
      }
      
      const dataToSave = {
        symbols: symbolsToSave,
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
    // Skip loading if option symbols are disabled
    if (!this.allowOptionSymbols) {
      console.log('⚠️ Option symbol monitoring is disabled - not loading from localStorage');
      return;
    }
    
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

      // Convert date strings back to Date objects and add to existing symbols
      const loadedSymbols = parsed.symbols.map((entry: any) => ({
        ...entry,
        addedAt: new Date(entry.addedAt),
        // Reset lastUpdate to null to force fresh timestamps
        lastUpdate: null,
        // Reset lastHMAUpdate to null to force fresh HMA calculation
        lastHMAUpdate: null,
        crossoverSignalTime: entry.crossoverSignalTime ? new Date(entry.crossoverSignalTime) : null,
        // Reset previous price state to force fresh crossover detection
        previousPriceAboveHMA: null
      }));
      
      // Merge with existing symbols (keeping index symbols)
      this.monitoredSymbols = [
        ...this.monitoredSymbols,
        ...loadedSymbols
      ];

      console.log(`📥 Loaded ${loadedSymbols.length} monitored symbols from localStorage (timestamps reset for fresh data)`);
    } catch (error) {
      console.error('❌ Error loading monitored symbols:', error);
    }
  }

  /**
   * Clear all monitoring
   */
  static clearAllMonitoring(): void {
    console.log('🗑️ Cleared all monitoring symbols');
    
    // Stop monitoring first
    this.stopMonitoring();
    
    // Clear the array
    this.monitoredSymbols = [];
    
    // Remove from localStorage completely instead of saving empty array
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('victor_monitoring_active');
    
    // Also try to stop TradingService monitoring if possible
    try {
      const TradingService = window['TradingService'];
      if (TradingService && typeof TradingService.stopMonitoring === 'function') {
        TradingService.stopMonitoring();
      } else {
        console.log('ℹ️ TradingService not available or already stopped');
      }
    } catch (error) {
      console.log('ℹ️ TradingService not available or already stopped');
    }
  }

  /**
   * Debug method to force clear localStorage and reset everything
   */
  static debugClearAll(): void {
    console.log('🧹 DEBUG: Force clearing all localStorage and monitoring');
    
    // Stop monitoring
    this.stopMonitoring();
    
    // Clear arrays
    this.monitoredSymbols = [];
    
    // Clear all related localStorage items
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem('victor_monitoring_active');
    localStorage.removeItem('victor_trade_logs');
    localStorage.removeItem('victor_trading_state');
    
    // Reset batch index
    this.currentBatchIndex = 0;
    
    console.log('✅ DEBUG: All data cleared and reset');
  }

  /**
   * Force refresh all timestamps to current time (debug method)
   */
  static debugRefreshTimestamps(): void {
    console.log('🔄 DEBUG: Refreshing all timestamps to current time');
    
    this.monitoredSymbols.forEach(entry => {
      entry.lastUpdate = null; // Reset to force fresh timestamps
      entry.lastHMAUpdate = null; // Reset HMA timestamps too
    });
    
    this.saveMonitoredSymbols();
    console.log('✅ DEBUG: All timestamps reset - next update will show current time');
  }

  /**
   * Check if currently monitoring
   */
  static isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }
} 