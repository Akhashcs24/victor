import { 
  ContractInputs, 
  TradeLogEntry, 
  TradingState
} from '../types';
import { HMAService } from './hmaService';
import { LiveMarketDataService } from './liveMarketDataService';
import { PersistentTradeLogService } from './persistentTradeLogService';
import { PersistentTradingStateService } from './persistentTradingStateService';

export class TradingService {
  private static tradingState: TradingState = {
    contractInputs: {
      ceSymbol: '',
      peSymbol: '',
      ceLots: 1,
      peLots: 1,
      targetPoints: 40,
      stopLossPoints: 15,
      entryMethod: 'MARKET',
      autoExitOnTarget: true,
      autoExitOnStopLoss: true,
      trailingStopLoss: false,
      trailingStopLossOffset: 10,
      timeBasedExit: false,
      exitAtMarketClose: false,
      exitAfterMinutes: 60,
      targetType: 'POINTS',
      stopLossType: 'POINTS'
    },
    ceMonitor: {
      symbol: '',
      currentLTP: null,
      hmaValue: null,
      triggerStatus: 'WAITING',
      entryPrice: null,
      lastUpdate: null,
      crossoverSignalTime: null
    },
    peMonitor: {
      symbol: '',
      currentLTP: null,
      hmaValue: null,
      triggerStatus: 'WAITING',
      entryPrice: null,
      lastUpdate: null,
      crossoverSignalTime: null
    },
    tradeLogs: [],
    tradingMode: 'PAPER',
    selectedIndex: 'NIFTY',
    monitoredSymbols: []
  };

  private static isMonitoring: boolean = false;
  private static monitoringInterval: NodeJS.Timeout | null = null;
  private static hmaUpdateInterval: NodeJS.Timeout | null = null;

  /**
   * Initialize trading service and load persisted logs
   */
  static async initialize(): Promise<void> {
    try {
      // Load persisted trading state first
      const savedState = await PersistentTradingStateService.loadTradingState();
      if (savedState) {
        this.tradingState = { ...this.tradingState, ...savedState };
        console.log('📥 Restored trading state from persistent storage');
      }
      
      // Load today's persisted trade logs into memory
      const persistedLogs = await PersistentTradeLogService.loadPersistedLogsIntoTradingService();
      if (persistedLogs && Array.isArray(persistedLogs)) {
        this.tradingState.tradeLogs = persistedLogs;
        console.log(`📥 Loaded ${persistedLogs.length} persisted trade logs from today`);
      }
      
      // If we have symbols being monitored, resume monitoring
      const { ceSymbol, peSymbol } = this.tradingState.contractInputs;
      if (ceSymbol && peSymbol && (this.tradingState.ceMonitor.hmaValue || this.tradingState.peMonitor.hmaValue)) {
        console.log(`🔄 Resuming monitoring for CE: ${ceSymbol}, PE: ${peSymbol}`);
        this.startMonitoring();
      }
    } catch (error) {
      console.error('❌ Error initializing trading service:', error);
    }
  }

  /**
   * Get current trading state
   */
  static getTradingState(): TradingState {
    return { ...this.tradingState };
  }

  /**
   * Update contract inputs and save state
   */
  static async updateContractInputs(inputs: Partial<ContractInputs>): Promise<void> {
    this.tradingState.contractInputs = { ...this.tradingState.contractInputs, ...inputs };
    console.log('📝 Contract inputs updated:', this.tradingState.contractInputs);
    await this.saveState();
  }

  /**
   * Fetch HMA data for both CE and PE contracts with proper caching
   */
  static async fetchHMAData(): Promise<void> {
    try {
      console.log('📊 Fetching HMA data for both contracts...');
      
      const { ceSymbol, peSymbol } = this.tradingState.contractInputs;
      
      if (!ceSymbol || !peSymbol) {
        throw new Error('Both CE and PE symbols must be selected');
      }

      console.log(`📊 Calculating HMA for CE symbol: ${ceSymbol}`);
      console.log(`📊 Calculating HMA for PE symbol: ${peSymbol}`);

      // Calculate HMA for each option symbol individually with proper caching
      const [ceHMA, peHMA] = await Promise.all([
        HMAService.fetchAndCalculateHMA(ceSymbol),
        HMAService.fetchAndCalculateHMA(peSymbol)
      ]);

      // Update trading state with HMA values
      this.updateTradingState({
        ceMonitor: {
          ...this.tradingState.ceMonitor,
          symbol: ceSymbol,
          hmaValue: ceHMA.currentHMA
        },
        peMonitor: {
          ...this.tradingState.peMonitor,
          symbol: peSymbol,
          hmaValue: peHMA.currentHMA
        }
      });

      console.log(`✅ HMA data fetched successfully - CE: ${ceHMA.currentHMA.toFixed(2)}, PE: ${peHMA.currentHMA.toFixed(2)}`);
      
      // Start periodic HMA updates (every 5 minutes)
      this.startHMAUpdates();
      
    } catch (error) {
      console.error('❌ Error fetching HMA data:', error);
      throw error;
    }
  }

  /**
   * Start periodic HMA updates (every 5 minutes)
   */
  private static startHMAUpdates(): void {
    // Clear existing interval
    if (this.hmaUpdateInterval) {
      clearInterval(this.hmaUpdateInterval);
    }

    // Start new interval
    this.hmaUpdateInterval = setInterval(async () => {
      await this.updateHMAData();
    }, 5 * 60 * 1000); // 5 minutes

    console.log('🔄 Started periodic HMA updates (every 5 minutes)');
  }

  /**
   * Update HMA data periodically
   */
  private static async updateHMAData(): Promise<void> {
    try {
      const { ceSymbol, peSymbol } = this.tradingState.contractInputs;
      
      if (!ceSymbol || !peSymbol) {
        return;
      }

      console.log('🔄 Updating HMA data...');

      // Update CE HMA
      const ceHMA = await HMAService.fetchAndCalculateHMA(ceSymbol);
      if (ceHMA) {
        this.tradingState.ceMonitor.hmaValue = ceHMA.currentHMA;
        this.tradingState.ceMonitor.lastUpdate = new Date();
        console.log(`📊 Updated CE HMA: ${ceHMA.currentHMA.toFixed(2)}`);
      }

      // Update PE HMA
      const peHMA = await HMAService.fetchAndCalculateHMA(peSymbol);
      if (peHMA) {
        this.tradingState.peMonitor.hmaValue = peHMA.currentHMA;
        this.tradingState.peMonitor.lastUpdate = new Date();
        console.log(`📊 Updated PE HMA: ${peHMA.currentHMA.toFixed(2)}`);
      }

    } catch (error) {
      console.error('❌ Error updating HMA data:', error);
    }
  }

  /**
   * Update trading state and save
   */
  private static async updateTradingState(updates: Partial<TradingState>): Promise<void> {
    this.tradingState = { ...this.tradingState, ...updates };
    await this.saveState();
  }

  /**
   * Save current state to localStorage
   */
  private static async saveState(): Promise<void> {
    await PersistentTradingStateService.saveTradingState(this.tradingState);
  }

  /**
   * Start monitoring strategy
   */
  static startMonitoring(): void {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring already active');
      return;
    }

    console.log('🚀 Starting strategy monitoring...');
    this.isMonitoring = true;

    // Initial call to populate data immediately
    this.monitorStrategy();

    // Start monitoring interval
    this.monitoringInterval = setInterval(async () => {
      await this.monitorStrategy();
    }, 2000); // Fetch every 2 seconds

    console.log('✅ Monitoring started');
  }

  /**
   * Stop monitoring strategy
   */
  static stopMonitoring(): void {
    if (!this.isMonitoring) {
      console.log('⚠️ Monitoring not active');
      return;
    }

    console.log('🛑 Stopping strategy monitoring...');
    this.isMonitoring = false;

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.hmaUpdateInterval) {
      clearInterval(this.hmaUpdateInterval);
      this.hmaUpdateInterval = null;
    }

    // Reset monitoring states to ensure no background processes continue
    this.resetMonitorState('CE');
    this.resetMonitorState('PE');
    
    // Also clear all monitored symbols in MultiSymbolMonitoringService
    try {
      // Try to access MultiSymbolMonitoringService using dynamic import
      import('./multiSymbolMonitoringService').then(module => {
        const MultiSymbolMonitoringService = module.MultiSymbolMonitoringService;
        if (MultiSymbolMonitoringService && typeof MultiSymbolMonitoringService.clearAllMonitoring === 'function') {
          MultiSymbolMonitoringService.clearAllMonitoring();
        }
      }).catch(err => {
        console.log('⚠️ Could not access MultiSymbolMonitoringService:', err.message);
      });
    } catch (error) {
      console.log('⚠️ Error stopping MultiSymbolMonitoringService:', error);
    }
    
    // Remove monitoring active flag from localStorage
    localStorage.removeItem('victor_monitoring_active');
    
    // Save the updated state
    this.saveState();

    console.log('✅ All monitoring stopped and states reset');
  }

  /**
   * Get live data for monitoring cards
   */
  static getLiveDataForMonitoring(): {
    ceData: { ltp: number; hma: number; lastUpdate: Date } | null;
    peData: { ltp: number; hma: number; lastUpdate: Date } | null;
  } {
    const { ceMonitor, peMonitor } = this.tradingState;
    
    return {
      ceData: ceMonitor.hmaValue ? {
        ltp: ceMonitor.currentLTP || 0,
        hma: ceMonitor.hmaValue,
        lastUpdate: ceMonitor.lastUpdate || new Date()
      } : null,
      peData: peMonitor.hmaValue ? {
        ltp: peMonitor.currentLTP || 0,
        hma: peMonitor.hmaValue,
        lastUpdate: peMonitor.lastUpdate || new Date()
      } : null
    };
  }

  /**
   * Monitor strategy execution
   */
  private static async monitorStrategy(): Promise<void> {
    try {
      const { ceSymbol, peSymbol } = this.tradingState.contractInputs;
      if (!ceSymbol || !peSymbol) return;

      const marketDataService = new LiveMarketDataService();

      // Fetch live market data for both option contracts in a single call
      const marketDataMap = await marketDataService.fetchMultipleMarketData([ceSymbol, peSymbol]);
      const ceData = marketDataMap.get(ceSymbol);
      const peData = marketDataMap.get(peSymbol);

      // Update CE monitor
      if (ceData) {
        this.tradingState.ceMonitor.currentLTP = ceData.ltp;
        this.tradingState.ceMonitor.lastUpdate = new Date();
        
        // Check for entry if we're waiting
        if (this.tradingState.ceMonitor.triggerStatus === 'WAITING') {
          await this.checkCrossover('CE', ceData.ltp);
        } 
        // Check for exit if we're in a trade
        else if (this.tradingState.ceMonitor.triggerStatus === 'ENTERED') {
          this.checkExitConditions('CE', ceData.ltp);
        }
      }

      // Update PE monitor
      if (peData) {
        this.tradingState.peMonitor.currentLTP = peData.ltp;
        this.tradingState.peMonitor.lastUpdate = new Date();
        
        // Check for entry if we're waiting
        if (this.tradingState.peMonitor.triggerStatus === 'WAITING') {
          await this.checkCrossover('PE', peData.ltp);
        } 
        // Check for exit if we're in a trade
        else if (this.tradingState.peMonitor.triggerStatus === 'ENTERED') {
          this.checkExitConditions('PE', peData.ltp);
        }
      }

    } catch (error) {
      console.error('❌ Error in monitorStrategy:', error);
    }
  }

  /**
   * Check for crossover and trigger entry after candle confirmation
   */
  private static async checkCrossover(contractType: 'CE' | 'PE', currentPrice: number): Promise<void> {
    const monitor = contractType === 'CE' ? this.tradingState.ceMonitor : this.tradingState.peMonitor;
    
    if (!monitor.hmaValue || monitor.triggerStatus !== 'WAITING') {
      return;
    }

    const priceIsAboveHMA = currentPrice > monitor.hmaValue;

    if (priceIsAboveHMA) {
      if (!monitor.crossoverSignalTime) {
        // Price crossed above HMA for the first time, record the timestamp.
        monitor.crossoverSignalTime = new Date();
        console.log(`📈 ${contractType} Price (${currentPrice}) crossed above HMA (${monitor.hmaValue}). Waiting for 1-min candle close to confirm.`);
      } else {
        // Price is still above HMA. Check if a new minute has started.
        const now = new Date();
        // Check if the minute (or hour, day, etc.) has changed since the signal.
        if (now.getMinutes() !== monitor.crossoverSignalTime.getMinutes()) {
          console.log(`✅ ${contractType} Entry Confirmed! Price still above HMA at new candle.`);
          await this.executeEntry(contractType, currentPrice);
          monitor.crossoverSignalTime = null; // Reset signal after execution
        }
      }
    } else {
      // Price is below HMA. If we were waiting for confirmation, cancel it.
      if (monitor.crossoverSignalTime) {
        console.log(`📉 ${contractType} Price fell below HMA. Cancelling entry signal.`);
        monitor.crossoverSignalTime = null;
      }
    }
  }

  /**
   * Execute trade entry
   */
  private static async executeEntry(contractType: 'CE' | 'PE', price: number): Promise<void> {
    try {
      console.log(`💰 Executing ${contractType} entry at ${price}...`);
      
      const monitor = contractType === 'CE' ? this.tradingState.ceMonitor : this.tradingState.peMonitor;
      const { ceLots, peLots } = this.tradingState.contractInputs;
      const lots = contractType === 'CE' ? ceLots : peLots;
      
      // Calculate quantity from lots based on the selected index
      // For now, using default lot size - this should be dynamic based on selectedIndex
      const quantity = lots * 75; // This should be: SymbolConfigService.calculateQuantityFromLots(lots, selectedIndex)
      
      // Update monitor status
      monitor.triggerStatus = 'ENTERED';
      monitor.entryPrice = price;
      
      // Create trade log entry using the addTradeLog method
      this.addTradeLog({
        symbol: monitor.symbol,
        action: 'BUY',
        price: price,
        quantity: quantity,
        orderType: this.tradingState.contractInputs.entryMethod,
        pnl: null,
        status: 'COMPLETED',
        remarks: `${contractType} entry triggered by HMA crossover (${lots} lots = ${quantity} qty)`
      });
      
      console.log(`✅ ${contractType} entry executed successfully`);
      
    } catch (error) {
      console.error(`❌ Error executing ${contractType} entry:`, error);
    }
  }

  /**
   * Add trade log entry
   */
  static addTradeLog(trade: Omit<TradeLogEntry, 'id' | 'timestamp' | 'tradingMode'>): void {
    const tradeLog: TradeLogEntry = {
      ...trade,
      id: `trade_${Date.now()}`,
      timestamp: new Date(),
      tradingMode: this.tradingState.tradingMode // Include current trading mode
    };
    
    this.tradingState.tradeLogs.unshift(tradeLog);
    
    // Also persist to localStorage
    PersistentTradeLogService.addTradeLog({
      ...trade,
      tradingMode: this.tradingState.tradingMode
    });
    
    console.log('📝 Trade log added and persisted:', tradeLog);
  }

  /**
   * Get trade logs
   */
  static getTradeLogs(): TradeLogEntry[] {
    return [...this.tradingState.tradeLogs];
  }

  /**
   * Update trading mode
   */
  static updateTradingMode(mode: 'PAPER' | 'LIVE'): void {
    this.tradingState.tradingMode = mode;
    this.saveState(); // Save the updated trading mode
    console.log(`🔄 Trading mode updated to: ${mode}`);
  }

  /**
   * Get current trading mode
   */
  static getCurrentTradingMode(): 'PAPER' | 'LIVE' {
    return this.tradingState.tradingMode;
  }

  /**
   * Update selected index
   */
  static updateSelectedIndex(index: string): void {
    this.tradingState.selectedIndex = index;
    console.log(`📈 Selected index updated to: ${index}`);
  }

  /**
   * Reset trading state and clear cache
   */
  static resetTradingState(): void {
    // Clear HMA cache when resetting
    const { ceSymbol, peSymbol } = this.tradingState.contractInputs;
    if (ceSymbol) HMAService.clearCache(ceSymbol);
    if (peSymbol) HMAService.clearCache(peSymbol);
    
    this.tradingState = {
      contractInputs: {
        ceSymbol: '',
        peSymbol: '',
        ceLots: 1,
        peLots: 1,
        targetPoints: 40,
        stopLossPoints: 15,
        entryMethod: 'MARKET',
        autoExitOnTarget: true,
        autoExitOnStopLoss: true,
        trailingStopLoss: false,
        trailingStopLossOffset: 10,
        timeBasedExit: false,
        exitAtMarketClose: false,
        exitAfterMinutes: 60,
        targetType: 'POINTS',
        stopLossType: 'POINTS'
      },
      ceMonitor: {
        symbol: '',
        currentLTP: null,
        hmaValue: null,
        triggerStatus: 'WAITING',
        entryPrice: null,
        lastUpdate: null,
        crossoverSignalTime: null
      },
      peMonitor: {
        symbol: '',
        currentLTP: null,
        hmaValue: null,
        triggerStatus: 'WAITING',
        entryPrice: null,
        lastUpdate: null,
        crossoverSignalTime: null
      },
      tradeLogs: [],
      tradingMode: 'PAPER',
      selectedIndex: this.tradingState.selectedIndex || 'NIFTY',
      monitoredSymbols: []
    };
    
    console.log('🔄 Trading state has been reset');
  }

  /**
   * Get HMA cache statistics for debugging
   */
  static getHMACacheStats(): { symbol: string; candleCount: number; lastUpdate: Date }[] {
    return HMAService.getCacheStats();
  }

  /**
   * Reset monitor state for a specific contract type
   */
  static resetMonitorState(contractType: 'CE' | 'PE'): void {
    const monitor = contractType === 'CE' ? this.tradingState.ceMonitor : this.tradingState.peMonitor;
    monitor.triggerStatus = 'WAITING';
    monitor.entryPrice = null;
    monitor.crossoverSignalTime = null;
    console.log(`🔄 ${contractType} monitor state reset.`);
  }

  /**
   * Get list of actively monitored symbols
   */
  static getMonitoredSymbols(): Array<{
    symbol: string;
    type: 'CE' | 'PE';
    ltp: number | null;
    hmaValue: number | null;
    triggerStatus: string;
    lastUpdate: Date | null;
  }> {
    const monitored = [];
    
    if (this.tradingState.ceMonitor.symbol && this.tradingState.ceMonitor.hmaValue) {
      monitored.push({
        symbol: this.tradingState.ceMonitor.symbol,
        type: 'CE' as const,
        ltp: this.tradingState.ceMonitor.currentLTP,
        hmaValue: this.tradingState.ceMonitor.hmaValue,
        triggerStatus: this.tradingState.ceMonitor.triggerStatus,
        lastUpdate: this.tradingState.ceMonitor.lastUpdate
      });
    }
    
    if (this.tradingState.peMonitor.symbol && this.tradingState.peMonitor.hmaValue) {
      monitored.push({
        symbol: this.tradingState.peMonitor.symbol,
        type: 'PE' as const,
        ltp: this.tradingState.peMonitor.currentLTP,
        hmaValue: this.tradingState.peMonitor.hmaValue,
        triggerStatus: this.tradingState.peMonitor.triggerStatus,
        lastUpdate: this.tradingState.peMonitor.lastUpdate
      });
    }
    
    return monitored;
  }

  /**
   * Stop monitoring a specific symbol
   */
  static stopMonitoringSymbol(type: 'CE' | 'PE'): void {
    if (type === 'CE') {
      this.tradingState.ceMonitor = {
        symbol: '',
        currentLTP: null,
        hmaValue: null,
        triggerStatus: 'WAITING',
        entryPrice: null,
        lastUpdate: null,
        crossoverSignalTime: null
      };
      this.tradingState.contractInputs.ceSymbol = '';
    } else {
      this.tradingState.peMonitor = {
        symbol: '',
        currentLTP: null,
        hmaValue: null,
        triggerStatus: 'WAITING',
        entryPrice: null,
        lastUpdate: null,
        crossoverSignalTime: null
      };
      this.tradingState.contractInputs.peSymbol = '';
    }
    
    // If no symbols are being monitored, stop monitoring completely
    const monitored = this.getMonitoredSymbols();
    if (monitored.length === 0) {
      this.stopMonitoring();
    }
    
    this.saveState();
    console.log(`🛑 Stopped monitoring ${type} symbol`);
  }

  static isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Update monitor data with live market data
   */
  static updateMonitorData(contractType: 'CE' | 'PE', ltp: number): void {
    const monitor = contractType === 'CE' ? this.tradingState.ceMonitor : this.tradingState.peMonitor;
    monitor.currentLTP = ltp;
    monitor.lastUpdate = new Date();
    
    // Check for exit conditions if we're in a trade
    if (monitor.triggerStatus === 'ENTERED' && monitor.entryPrice !== null) {
      this.checkExitConditions(contractType, ltp);
    }
    
    this.saveState();
    console.log(`📊 Updated ${contractType} monitor with LTP: ₹${ltp}`);
  }

  /**
   * Check if exit conditions are met
   */
  private static checkExitConditions(contractType: 'CE' | 'PE', currentPrice: number): void {
    const monitor = contractType === 'CE' ? this.tradingState.ceMonitor : this.tradingState.peMonitor;
    const { 
      targetPoints, 
      stopLossPoints, 
      autoExitOnTarget, 
      autoExitOnStopLoss,
      trailingStopLoss,
      trailingStopLossOffset
    } = this.tradingState.contractInputs;
    
    if (!monitor.entryPrice) return;
    
    const priceDifference = currentPrice - monitor.entryPrice;
    const percentChange = (priceDifference / monitor.entryPrice) * 100;
    
    // Check target condition
    if (autoExitOnTarget && priceDifference >= targetPoints) {
      console.log(`🎯 ${contractType} Target reached! Exiting position...`);
      this.executeExit(contractType, currentPrice, `Target of ${targetPoints} points reached`);
      return;
    }
    
    // Check stop loss condition
    if (autoExitOnStopLoss && priceDifference <= -stopLossPoints) {
      console.log(`🛑 ${contractType} Stop loss triggered! Exiting position...`);
      this.executeExit(contractType, currentPrice, `Stop loss of ${stopLossPoints} points triggered`);
      return;
    }
    
    // Check trailing stop loss if enabled and we're in profit
    if (trailingStopLoss && priceDifference > 0) {
      // Calculate trailing stop price
      const trailingStopPrice = currentPrice - trailingStopLossOffset;
      
      // If trailing stop price is higher than our initial stop loss and price falls below it
      const initialStopLoss = monitor.entryPrice - stopLossPoints;
      if (trailingStopPrice > initialStopLoss && currentPrice <= trailingStopPrice) {
        console.log(`🔄 ${contractType} Trailing stop loss triggered! Exiting position...`);
        this.executeExit(contractType, currentPrice, `Trailing stop loss triggered at ${trailingStopLossOffset} points below peak`);
        return;
      }
    }
    
    // Check time-based exit conditions
    if (this.tradingState.contractInputs.timeBasedExit && monitor.entryPrice) {
      const now = new Date();
      const entryTime = monitor.lastUpdate || new Date();
      const minutesSinceEntry = (now.getTime() - entryTime.getTime()) / (1000 * 60);
      
      // Exit after specified minutes
      if (minutesSinceEntry >= this.tradingState.contractInputs.exitAfterMinutes) {
        console.log(`⏰ ${contractType} Time-based exit triggered after ${this.tradingState.contractInputs.exitAfterMinutes} minutes`);
        this.executeExit(contractType, currentPrice, `Time-based exit after ${this.tradingState.contractInputs.exitAfterMinutes} minutes`);
        return;
      }
      
      // Exit at market close (assuming market closes at 3:30 PM)
      if (this.tradingState.contractInputs.exitAtMarketClose) {
        const marketCloseHour = 15; // 3 PM
        const marketCloseMinute = 30; // 30 minutes
        
        if (now.getHours() >= marketCloseHour && now.getMinutes() >= marketCloseMinute) {
          console.log(`🔔 ${contractType} Market close exit triggered`);
          this.executeExit(contractType, currentPrice, 'Market close exit');
          return;
        }
      }
    }
  }

  /**
   * Execute exit for a position
   */
  private static executeExit(contractType: 'CE' | 'PE', price: number, reason: string): void {
    const monitor = contractType === 'CE' ? this.tradingState.ceMonitor : this.tradingState.peMonitor;
    const { ceLots, peLots } = this.tradingState.contractInputs;
    const lots = contractType === 'CE' ? ceLots : peLots;
    
    // Calculate quantity (this should use a proper lot size calculation)
    const quantity = lots * 75; // Default lot size, should be dynamic
    
    // Calculate P&L
    const pnl = monitor.entryPrice ? (price - monitor.entryPrice) * quantity : 0;
    
    // Add trade log for exit
    this.addTradeLog({
      symbol: monitor.symbol,
      action: 'SELL',
      price: price,
      quantity: quantity,
      orderType: 'MARKET',
      pnl: pnl,
      status: 'COMPLETED',
      remarks: `${contractType} exit: ${reason} (P&L: ₹${pnl.toFixed(2)})`
    });
    
    // Reset monitor state
    this.resetMonitorState(contractType);
    
    console.log(`✅ ${contractType} exit executed successfully - P&L: ₹${pnl.toFixed(2)}`);
  }

  /**
   * Manual exit for a trade
   */
  static manualExit(tradeId: string, exitPrice: number): void {
    // Find the original trade
    const originalTrade = this.tradingState.tradeLogs.find(log => log.id === tradeId);
    if (!originalTrade) {
      console.error(`❌ Trade with ID ${tradeId} not found`);
      return;
    }

    if (originalTrade.action !== 'BUY') {
      console.error(`❌ Can only exit BUY trades. Trade ${tradeId} is ${originalTrade.action}`);
      return;
    }

    // Calculate P&L
    const pnl = (exitPrice - originalTrade.price) * originalTrade.quantity;

    // Create exit trade log
    this.addTradeLog({
      symbol: originalTrade.symbol,
      action: 'SELL',
      quantity: originalTrade.quantity,
      price: exitPrice,
      orderType: 'MARKET',
      pnl: pnl,
      status: 'COMPLETED',
      remarks: `Manual exit - P&L: ₹${pnl.toFixed(2)}`
    });
    console.log(`✅ Manual exit executed for ${originalTrade.symbol} - P&L: ₹${pnl.toFixed(2)}`);
  }
}