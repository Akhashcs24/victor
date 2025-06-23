import { TradeLogEntry } from '../types';
import { getAccessToken } from './authService';

// Get API URL from environment or use default
const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';

export class PersistentTradeLogService {
  private static readonly STORAGE_KEY = 'victor_trade_logs';
  private static readonly MAX_STORAGE_DAYS = 60; // 2 months
  private static cachedLogs: Record<string, TradeLogEntry[]> = {};
  private static lastFetch: Date | null = null;
  private static readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Get today's date as YYYY-MM-DD string
   */
  private static getTodayKey(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Fetch trade logs from backend API
   */
  private static async fetchLogsFromBackend(): Promise<Record<string, TradeLogEntry[]>> {
    try {
      const accessToken = getAccessToken();
      
      if (!accessToken) {
        throw new Error('No access token found');
      }
      
      const response = await fetch(`${API_URL}/api/trade-logs`, {
        headers: {
          'Authorization': accessToken
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch trade logs: ${response.status}`);
      }
      
      const responseData = await response.json();
      
      // Check if the response has the expected format
      if (!responseData.success || !responseData.data) {
        console.warn('Unexpected response format from trade logs API:', responseData);
        return {};
      }
      
      const data = responseData.data;
      
      // Handle empty data case
      if (Object.keys(data).length === 0) {
        return {};
      }
      
      // Convert timestamp strings back to Date objects
      const processedData: Record<string, TradeLogEntry[]> = {};
      
      Object.keys(data).forEach(date => {
        if (Array.isArray(data[date])) {
          processedData[date] = data[date].map((log: any) => ({
            ...log,
            timestamp: new Date(log.timestamp)
          }));
        } else {
          console.warn(`Trade logs for date ${date} is not an array:`, data[date]);
          processedData[date] = [];
        }
      });
      
      this.cachedLogs = processedData;
      this.lastFetch = new Date();
      
      return processedData;
    } catch (error) {
      console.error('Error fetching trade logs from backend:', error);
      // Fallback to local storage if backend fails
      return this.getStoredLogs();
    }
  }

  /**
   * Get stored trade logs from localStorage (fallback)
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
   * Save trade logs to backend API
   */
  private static async saveToBackend(logs: Record<string, TradeLogEntry[]>): Promise<boolean> {
    try {
      const accessToken = getAccessToken();
      
      if (!accessToken) {
        throw new Error('No access token found');
      }
      
      const response = await fetch(`${API_URL}/api/trade-logs`, {
        method: 'POST',
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logs)
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save trade logs: ${response.status}`);
      }
      
      // Update cache
      this.cachedLogs = logs;
      this.lastFetch = new Date();
      
      return true;
    } catch (error) {
      console.error('Error saving trade logs to backend:', error);
      // Fallback to local storage
      this.saveToStorage(logs);
      return false;
    }
  }

  /**
   * Save trade logs to localStorage (fallback)
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
   * Get logs with cache awareness
   */
  private static async getLogs(): Promise<Record<string, TradeLogEntry[]>> {
    const now = new Date();
    
    // Use cache if it's fresh
    if (this.lastFetch && (now.getTime() - this.lastFetch.getTime() < this.CACHE_TTL)) {
      return this.cachedLogs;
    }
    
    // Otherwise fetch from backend
    try {
      return await this.fetchLogsFromBackend();
    } catch (error) {
      console.warn('❌ Failed to fetch from backend, using cached data:', error);
      // If backend fails, use cached data if available, otherwise fallback to localStorage
      if (Object.keys(this.cachedLogs).length > 0) {
        return this.cachedLogs;
      }
      return this.getStoredLogs();
    }
  }

  /**
   * Add a new trade log entry
   */
  static async addTradeLog(trade: Omit<TradeLogEntry, 'id' | 'timestamp'>): Promise<TradeLogEntry> {
    const tradeLog: TradeLogEntry = {
      ...trade,
      id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    const allLogs = await this.getLogs();
    const todayKey = this.getTodayKey();
    
    if (!allLogs[todayKey]) {
      allLogs[todayKey] = [];
    }
    
    allLogs[todayKey].unshift(tradeLog); // Add to beginning for newest first
    await this.saveToBackend(allLogs);
    
    console.log('📝 Trade log added and persisted:', tradeLog);
    return tradeLog;
  }

  /**
   * Get today's trade logs
   */
  static async getTodayTradeLogs(): Promise<TradeLogEntry[]> {
    const allLogs = await this.getLogs();
    const todayKey = this.getTodayKey();
    return allLogs[todayKey] || [];
  }

  /**
   * Get historical trade logs (last 2 months)
   */
  static async getHistoricalTradeLogs(): Promise<Record<string, TradeLogEntry[]>> {
    return await this.getLogs();
  }

  /**
   * Get trade logs for a specific date
   */
  static async getTradeLogsByDate(date: string): Promise<TradeLogEntry[]> {
    const allLogs = await this.getLogs();
    return allLogs[date] || [];
  }

  /**
   * Get all trade logs as a flat array (newest first)
   */
  static async getAllTradeLogsFlat(): Promise<TradeLogEntry[]> {
    const allLogs = await this.getLogs();
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
  static async getTodayPnL(): Promise<number> {
    const todayLogs = await this.getTodayTradeLogs();
    return todayLogs.reduce((total, log) => total + (log.pnl || 0), 0);
  }

  /**
   * Get total P&L for all time
   */
  static async getTotalPnL(): Promise<number> {
    const allLogs = await this.getAllTradeLogsFlat();
    return allLogs.reduce((total, log) => total + (log.pnl || 0), 0);
  }

  /**
   * Get trade statistics
   */
  static async getTradeStats(): Promise<{
    todayTrades: number;
    todayPnL: number;
    totalTrades: number;
    totalPnL: number;
    winRate: number;
    avgPnL: number;
  }> {
    const todayLogs = await this.getTodayTradeLogs();
    const allLogs = await this.getAllTradeLogsFlat();
    
    const completedTrades = allLogs.filter(log => log.pnl !== null && log.pnl !== undefined);
    const winningTrades = completedTrades.filter(log => (log.pnl || 0) > 0);
    
    return {
      todayTrades: todayLogs.length,
      todayPnL: todayLogs.reduce((total, log) => total + (log.pnl || 0), 0),
      totalTrades: allLogs.length,
      totalPnL: allLogs.reduce((total, log) => total + (log.pnl || 0), 0),
      winRate: completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0,
      avgPnL: completedTrades.length > 0 ? completedTrades.reduce((sum, log) => sum + (log.pnl || 0), 0) / completedTrades.length : 0
    };
  }

  /**
   * Clear all trade logs (for testing/reset purposes)
   */
  static async clearAllLogs(): Promise<void> {
    try {
      const accessToken = getAccessToken();
      
      if (!accessToken) {
        throw new Error('No access token found');
      }
      
      const response = await fetch(`${API_URL}/api/trade-logs/clear`, {
        method: 'POST',
        headers: {
          'Authorization': accessToken
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clear trade logs: ${response.status}`);
      }
      
      // Clear cache
      this.cachedLogs = {};
      this.lastFetch = new Date();
      
      // Also clear local storage
      localStorage.removeItem(this.STORAGE_KEY);
      
      console.log('🗑️ All trade logs cleared');
    } catch (error) {
      console.error('Error clearing trade logs:', error);
      // Fallback to clearing local storage
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Export trade logs as JSON
   */
  static async exportLogs(): Promise<string> {
    const allLogs = await this.getLogs();
    return JSON.stringify(allLogs, null, 2);
  }

  /**
   * Import trade logs from JSON
   */
  static async importLogs(jsonData: string): Promise<boolean> {
    try {
      const logs = JSON.parse(jsonData);
      return await this.saveToBackend(logs);
    } catch (error) {
      console.error('Error importing trade logs:', error);
      return false;
    }
  }

  /**
   * Sync with in-memory trading service
   * This should be called whenever a new trade is added via TradingService
   */
  static async syncFromTradingService(tradeLogs: TradeLogEntry[]): Promise<void> {
    // Get today's existing logs
    const todayExisting = await this.getTodayTradeLogs();
    const existingIds = new Set(todayExisting.map(log => log.id));
    
    // Add any new logs that aren't already persisted
    const newLogs = tradeLogs.filter(log => !existingIds.has(log.id));
    
    if (newLogs.length > 0) {
      const allLogs = await this.getLogs();
      const todayKey = this.getTodayKey();
      
      if (!allLogs[todayKey]) {
        allLogs[todayKey] = [];
      }
      
      // Add new logs to the beginning
      allLogs[todayKey].unshift(...newLogs);
      await this.saveToBackend(allLogs);
      
      console.log(`📝 Synced ${newLogs.length} new trade logs to persistent storage`);
    }
  }

  /**
   * Load persisted logs into TradingService on app startup
   */
  static async loadPersistedLogsIntoTradingService(): Promise<TradeLogEntry[]> {
    // This function can be called on app startup to restore today's logs
    // into the TradingService's in-memory state
    const todayLogs = await this.getTodayTradeLogs();
    console.log(`📥 Loaded ${todayLogs.length} persisted trade logs from today`);
    return todayLogs;
  }
} 