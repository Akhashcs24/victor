import { TradeLogEntry } from '../types';

export class PersistentTradeLogService {
  private static readonly STORAGE_KEY = 'victor_trade_logs';
  private static readonly MAX_STORAGE_DAYS = 60; // 2 months

  /**
   * Get today's date as YYYY-MM-DD string
   */
  private static getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Get stored trade logs from localStorage
   */
  private static getStoredLogs(): Record<string, TradeLogEntry[]> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return {};
      
      const logs = JSON.parse(stored);
      // Convert timestamp strings back to Date objects
      Object.keys(logs).forEach(date => {
        logs[date] = logs[date].map((log: any) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      });
      
      return logs;
    } catch (error) {
      console.error('Error loading trade logs from localStorage:', error);
      return {};
    }
  }

  /**
   * Save trade logs to localStorage
   */
  private static saveToStorage(logs: Record<string, TradeLogEntry[]>): void {
    try {
      // Clean up old logs (older than MAX_STORAGE_DAYS)
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.MAX_STORAGE_DAYS);
      const cutoffKey = cutoffDate.toISOString().split('T')[0];
      
      const cleanedLogs: Record<string, TradeLogEntry[]> = {};
      Object.keys(logs).forEach(date => {
        if (date >= cutoffKey) {
          cleanedLogs[date] = logs[date];
        }
      });
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(cleanedLogs));
    } catch (error) {
      console.error('Error saving trade logs to localStorage:', error);
    }
  }

  /**
   * Add a new trade log entry
   */
  static addTradeLog(trade: Omit<TradeLogEntry, 'id' | 'timestamp'>): TradeLogEntry {
    const tradeLog: TradeLogEntry = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    const allLogs = this.getStoredLogs();
    const todayKey = this.getTodayKey();
    
    if (!allLogs[todayKey]) {
      allLogs[todayKey] = [];
    }
    
    allLogs[todayKey].unshift(tradeLog); // Add to beginning for newest first
    this.saveToStorage(allLogs);
    
    console.log('📝 Trade log added and persisted:', tradeLog);
    return tradeLog;
  }

  /**
   * Get today's trade logs
   */
  static getTodayTradeLogs(): TradeLogEntry[] {
    const allLogs = this.getStoredLogs();
    const todayKey = this.getTodayKey();
    return allLogs[todayKey] || [];
  }

  /**
   * Get historical trade logs (last 2 months)
   */
  static getHistoricalTradeLogs(): Record<string, TradeLogEntry[]> {
    return this.getStoredLogs();
  }

  /**
   * Get trade logs for a specific date
   */
  static getTradeLogsByDate(date: string): TradeLogEntry[] {
    const allLogs = this.getStoredLogs();
    return allLogs[date] || [];
  }

  /**
   * Get all trade logs as a flat array (newest first)
   */
  static getAllTradeLogsFlat(): TradeLogEntry[] {
    const allLogs = this.getStoredLogs();
    const flatLogs: TradeLogEntry[] = [];
    
    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(allLogs).sort().reverse();
    
    sortedDates.forEach(date => {
      flatLogs.push(...allLogs[date]);
    });
    
    return flatLogs;
  }

  /**
   * Get total P&L for today
   */
  static getTodayPnL(): number {
    const todayLogs = this.getTodayTradeLogs();
    return todayLogs.reduce((total, log) => total + (log.pnl || 0), 0);
  }

  /**
   * Get total P&L for all time
   */
  static getTotalPnL(): number {
    const allLogs = this.getAllTradeLogsFlat();
    return allLogs.reduce((total, log) => total + (log.pnl || 0), 0);
  }

  /**
   * Get trade statistics
   */
  static getTradeStats(): {
    todayTrades: number;
    todayPnL: number;
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    avgPnL: number;
  } {
    const todayLogs = this.getTodayTradeLogs();
    const allLogs = this.getAllTradeLogsFlat();
    
    const completedTrades = allLogs.filter(log => log.pnl !== null && log.pnl !== undefined);
    const winningTrades = completedTrades.filter(log => (log.pnl || 0) > 0);
    
    return {
      todayTrades: todayLogs.length,
      todayPnL: this.getTodayPnL(),
      totalTrades: allLogs.length,
      totalPnL: this.getTotalPnL(),
      winRate: completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0,
      avgPnL: completedTrades.length > 0 ? completedTrades.reduce((sum, log) => sum + (log.pnl || 0), 0) / completedTrades.length : 0
    };
  }

  /**
   * Clear all trade logs (for testing/reset purposes)
   */
  static clearAllLogs(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('🗑️ All trade logs cleared');
  }

  /**
   * Export trade logs as JSON
   */
  static exportLogs(): string {
    const allLogs = this.getStoredLogs();
    return JSON.stringify(allLogs, null, 2);
  }

  /**
   * Import trade logs from JSON
   */
  static importLogs(jsonData: string): boolean {
    try {
      const logs = JSON.parse(jsonData);
      this.saveToStorage(logs);
      console.log('📥 Trade logs imported successfully');
      return true;
    } catch (error) {
      console.error('Error importing trade logs:', error);
      return false;
    }
  }

  /**
   * Sync with in-memory trading service
   * This should be called whenever a new trade is added via TradingService
   */
  static syncFromTradingService(tradeLogs: TradeLogEntry[]): void {
    // Get today's existing logs
    const todayExisting = this.getTodayTradeLogs();
    const existingIds = new Set(todayExisting.map(log => log.id));
    
    // Add any new logs that aren't already persisted
    const newLogs = tradeLogs.filter(log => !existingIds.has(log.id));
    
    if (newLogs.length > 0) {
      const allLogs = this.getStoredLogs();
      const todayKey = this.getTodayKey();
      
      if (!allLogs[todayKey]) {
        allLogs[todayKey] = [];
      }
      
      // Add new logs to the beginning
      allLogs[todayKey].unshift(...newLogs);
      this.saveToStorage(allLogs);
      
      console.log(`📝 Synced ${newLogs.length} new trade logs to persistent storage`);
    }
  }

  /**
   * Load persisted logs into TradingService on app startup
   */
  static loadPersistedLogsIntoTradingService(): void {
    // This function can be called on app startup to restore today's logs
    // into the TradingService's in-memory state
    const todayLogs = this.getTodayTradeLogs();
    console.log(`📥 Loaded ${todayLogs.length} persisted trade logs from today`);
    // The actual syncing with TradingService would be implemented based on your needs
  }
} 