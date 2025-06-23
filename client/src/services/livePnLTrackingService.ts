import { TradeLogEntry } from '../types';
import { PersistentTradeLogService } from './persistentTradeLogService';
import { LiveMarketDataService } from './liveMarketDataService';

export interface LivePosition {
  tradeId: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  entryPrice: number;
  quantity: number;
  currentPrice: number | null;
  livePnL: number | null;
  lastUpdate: Date | null;
}

export class LivePnLTrackingService {
  private static positions: Map<string, LivePosition> = new Map();
  private static isTracking: boolean = false;
  private static trackingInterval: NodeJS.Timeout | null = null;
  private static readonly UPDATE_INTERVAL = 5000; // 5 seconds

  /**
   * Start tracking P&L for all open positions
   */
  static async startTracking(): Promise<void> {
    if (this.isTracking) return;

    console.log('🚀 Starting live P&L tracking...');
    this.isTracking = true;

    // Load existing positions from localStorage first
    this.loadPositionsFromStorage();

    // Then load any additional positions from today's trades
    await this.loadPositionsFromTradeLogs();

    // Start periodic updates
    this.trackingInterval = setInterval(() => {
      this.updateAllPositions();
    }, this.UPDATE_INTERVAL);

    // Initial update
    await this.updateAllPositions();
    
    console.log(`✅ Live P&L tracking started with ${this.positions.size} positions`);
  }

  /**
   * Stop tracking P&L
   */
  static stopTracking(): void {
    if (!this.isTracking) return;

    console.log('🛑 Stopping live P&L tracking...');
    this.isTracking = false;

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    this.positions.clear();
  }

  /**
   * Add a new position to track
   */
  static addPosition(trade: TradeLogEntry): void {
    // Only track BUY trades (entries) that don't have a corresponding SELL
    if (trade.action === 'BUY' && trade.status === 'COMPLETED') {
      const position: LivePosition = {
        tradeId: trade.id,
        symbol: trade.symbol,
        action: trade.action,
        entryPrice: trade.price,
        quantity: trade.quantity,
        currentPrice: null,
        livePnL: null,
        lastUpdate: null
      };

      this.positions.set(trade.id, position);
      console.log(`📈 Added position to P&L tracking: ${trade.symbol} @ ₹${trade.price}`);
      console.log(`📊 Current positions being tracked: ${this.positions.size}`);
      console.log(`🔍 Position details:`, position);
      
      // Force save to ensure persistence
      this.savePositionsToStorage();
    } else {
      console.warn(`⚠️ Attempted to add non-BUY or incomplete trade to P&L tracking:`, trade);
    }
  }

  /**
   * Save positions to localStorage for persistence
   */
  private static savePositionsToStorage(): void {
    try {
      const positionsArray = Array.from(this.positions.entries()).map(([id, position]) => ({
        id,
        ...position
      }));
      localStorage.setItem('victor_live_positions', JSON.stringify(positionsArray));
      console.log(`💾 Saved ${positionsArray.length} positions to localStorage`);
    } catch (error) {
      console.error('❌ Error saving positions to localStorage:', error);
    }
  }

  /**
   * Load positions from localStorage
   */
  private static loadPositionsFromStorage(): void {
    try {
      const stored = localStorage.getItem('victor_live_positions');
      if (stored) {
        const positionsArray = JSON.parse(stored);
        this.positions.clear();
        
        positionsArray.forEach((item: any) => {
          const { id, ...position } = item;
          // Restore Date objects
          if (position.lastUpdate) {
            position.lastUpdate = new Date(position.lastUpdate);
          }
          this.positions.set(id, position);
        });
        
        console.log(`📥 Loaded ${positionsArray.length} positions from localStorage`);
      }
    } catch (error) {
      console.error('❌ Error loading positions from localStorage:', error);
    }
  }

  /**
   * Remove a position (when trade is closed)
   */
  static removePosition(tradeId: string): void {
    if (this.positions.has(tradeId)) {
      const position = this.positions.get(tradeId)!;
      this.positions.delete(tradeId);
      console.log(`📉 Removed position from P&L tracking: ${position.symbol}`);
      console.log(`📊 Remaining positions being tracked: ${this.positions.size}`);
      
      // Update localStorage
      this.savePositionsToStorage();
    } else {
      console.warn(`⚠️ Attempted to remove position ${tradeId} that doesn't exist in tracking`);
    }
  }

  /**
   * Load positions from today's trade logs
   */
  private static async loadPositionsFromTradeLogs(): Promise<void> {
    try {
      const todayTrades = await PersistentTradeLogService.getTodayTradeLogs();
      
      // Group trades by symbol to find open positions
      const tradesBySymbol: Record<string, TradeLogEntry[]> = {};
      
      todayTrades.forEach(trade => {
        if (!tradesBySymbol[trade.symbol]) {
          tradesBySymbol[trade.symbol] = [];
        }
        tradesBySymbol[trade.symbol].push(trade);
      });

      // For each symbol, check if there are open positions
      Object.keys(tradesBySymbol).forEach(symbol => {
        const trades = tradesBySymbol[symbol].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
        
        let openQuantity = 0;
        let lastBuyTrade: TradeLogEntry | null = null;

        trades.forEach(trade => {
          if (trade.action === 'BUY' && trade.status === 'COMPLETED') {
            openQuantity += trade.quantity;
            lastBuyTrade = trade;
          } else if (trade.action === 'SELL' && trade.status === 'COMPLETED') {
            openQuantity -= trade.quantity;
          }
        });

        // If there's open quantity and we have a buy trade, track it
        if (openQuantity > 0 && lastBuyTrade) {
          this.addPosition(lastBuyTrade);
        }
      });

      console.log(`📊 Loaded ${this.positions.size} open positions for P&L tracking`);
    } catch (error) {
      console.error('❌ Error loading positions from trade logs:', error);
    }
  }

  /**
   * Update P&L for all tracked positions
   */
  private static async updateAllPositions(): Promise<void> {
    if (this.positions.size === 0) {
      console.log('📊 No positions to update');
      return;
    }

    console.log(`📊 Updating P&L for ${this.positions.size} positions...`);

    try {
      const symbols = Array.from(this.positions.values()).map(pos => pos.symbol);
      const marketDataService = new LiveMarketDataService();
      const marketData = await marketDataService.fetchMultipleMarketData(symbols);

      let updatedCount = 0;
      let failedCount = 0;

      for (const [tradeId, position] of this.positions.entries()) {
        try {
          const currentData = marketData.get(position.symbol);
          
          if (currentData && currentData.ltp) {
            const previousPrice = position.currentPrice;
            position.currentPrice = currentData.ltp;
            position.livePnL = (currentData.ltp - position.entryPrice) * position.quantity;
            position.lastUpdate = new Date();
            
            // Only log if price changed significantly or it's been a while
            if (!previousPrice || Math.abs(currentData.ltp - previousPrice) > 0.01) {
              console.log(`📈 Updated ${position.symbol}: ₹${currentData.ltp} (P&L: ₹${position.livePnL?.toFixed(2)})`);
            }
            
            updatedCount++;
            
            // Check for auto-exit conditions
            await this.checkAutoExit(tradeId, position, currentData.ltp);
          } else {
            console.warn(`⚠️ No market data available for ${position.symbol}, keeping previous data`);
            failedCount++;
            // DON'T remove the position if market data fails - keep it for next update
          }
        } catch (positionError) {
          console.error(`❌ Error updating position ${position.symbol}:`, positionError);
          failedCount++;
          // DON'T remove the position on individual errors - keep it for next update
        }
      }

      console.log(`📊 P&L Update complete: ${updatedCount} updated, ${failedCount} failed, ${this.positions.size} total positions`);
      
      // Save to localStorage after each update to ensure persistence
      this.savePositionsToStorage();
      
    } catch (error) {
      console.error('❌ Error updating positions (keeping all positions for next update):', error);
      // DON'T clear positions on error - they should persist until successfully updated or manually removed
    }
  }

  /**
   * Check if position should be auto-exited based on target/SL
   */
  private static async checkAutoExit(tradeId: string, position: LivePosition, currentPrice: number): Promise<void> {
    try {
      // Get the original trade to extract target/SL info
      const todayTrades = await PersistentTradeLogService.getTodayTradeLogs();
      const originalTrade = todayTrades.find(trade => trade.id === tradeId);
      
      if (!originalTrade || !originalTrade.remarks) return;

      // Extract target and SL from remarks
      const targetMatch = originalTrade.remarks.match(/Target:\s*₹([\d.]+)/);
      const slMatch = originalTrade.remarks.match(/SL:\s*₹([\d.]+)/);
      
      if (!targetMatch || !slMatch) return;

      const target = parseFloat(targetMatch[1]);
      const stopLoss = parseFloat(slMatch[1]);

      // Check if target or SL is hit
      let shouldExit = false;
      let exitReason = '';

      if (currentPrice >= target) {
        shouldExit = true;
        exitReason = 'Target Hit';
      } else if (currentPrice <= stopLoss) {
        shouldExit = true;
        exitReason = 'Stop Loss Hit';
      }

      if (shouldExit) {
        await this.executeAutoExit(originalTrade, currentPrice, exitReason);
      }
    } catch (error) {
      console.error('❌ Error checking auto-exit for position:', error);
    }
  }

  /**
   * Execute auto-exit for a position
   */
  private static async executeAutoExit(originalTrade: TradeLogEntry, exitPrice: number, reason: string): Promise<void> {
    try {
      const pnl = (exitPrice - originalTrade.price) * originalTrade.quantity;
      
      // Add exit trade log
      await PersistentTradeLogService.addTradeLog({
        symbol: originalTrade.symbol,
        action: 'SELL',
        quantity: originalTrade.quantity,
        price: exitPrice,
        orderType: 'MARKET',
        status: 'COMPLETED',
        pnl: pnl,
        tradingMode: originalTrade.tradingMode,
        remarks: `Auto-exit: ${reason} - P&L: ₹${pnl.toFixed(2)}`
      });

      // Remove from live tracking
      this.removePosition(originalTrade.id);
      
      console.log(`🎯 Auto-exit executed: ${originalTrade.symbol} - ${reason} at ₹${exitPrice} - P&L: ₹${pnl.toFixed(2)}`);
    } catch (error) {
      console.error('❌ Error executing auto-exit:', error);
    }
  }

  /**
   * Get all current positions with live P&L
   */
  static getAllPositions(): LivePosition[] {
    return Array.from(this.positions.values());
  }

  /**
   * Get position by trade ID
   */
  static getPosition(tradeId: string): LivePosition | null {
    return this.positions.get(tradeId) || null;
  }

  /**
   * Get total live P&L across all positions
   */
  static getTotalLivePnL(): number {
    return Array.from(this.positions.values())
      .reduce((total, position) => total + (position.livePnL || 0), 0);
  }

  /**
   * Get position count
   */
  static getPositionCount(): number {
    return this.positions.size;
  }

  /**
   * Check if tracking is active
   */
  static isCurrentlyTracking(): boolean {
    return this.isTracking;
  }

  /**
   * Force update all positions (manual refresh)
   */
  static async refreshPositions(): Promise<void> {
    await this.updateAllPositions();
  }

  /**
   * Debug method to get detailed position info
   */
  static getDebugInfo(): {
    isTracking: boolean;
    positionCount: number;
    positions: LivePosition[];
    lastUpdate: Date | null;
  } {
    return {
      isTracking: this.isTracking,
      positionCount: this.positions.size,
      positions: Array.from(this.positions.values()),
      lastUpdate: this.positions.size > 0 ? 
        Math.max(...Array.from(this.positions.values()).map(p => p.lastUpdate?.getTime() || 0)) > 0 ?
          new Date(Math.max(...Array.from(this.positions.values()).map(p => p.lastUpdate?.getTime() || 0))) : null
        : null
    };
  }

  /**
   * Debug method to force reload positions from trade logs
   */
  static async debugReloadPositions(): Promise<void> {
    console.log('🔄 Debug: Reloading positions from trade logs...');
    this.positions.clear();
    await this.loadPositionsFromTradeLogs();
    console.log('🔄 Debug: Reloaded positions:', this.getDebugInfo());
  }
} 