import { TradingState } from '../types';
import { getAccessToken } from './authService';

// Get API URL from environment or use default
const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';

export class PersistentTradingStateService {
  private static readonly STORAGE_KEY = 'victor_trading_state';
  private static cachedState: Partial<TradingState> | null = null;
  private static lastFetch: Date | null = null;
  private static readonly CACHE_TTL = 60000; // 1 minute

  /**
   * Save trading state to backend API
   */
  static async saveTradingState(state: TradingState): Promise<boolean> {
    try {
      const accessToken = getAccessToken();
      
      if (!accessToken) {
        throw new Error('No access token found');
      }
      
      const stateToSave = {
        contractInputs: state.contractInputs,
        ceMonitor: state.ceMonitor,
        peMonitor: state.peMonitor,
        tradingMode: state.tradingMode,
        selectedIndex: state.selectedIndex,
        savedAt: new Date().toISOString()
      };

      const response = await fetch(`${API_URL}/api/trading-state`, {
        method: 'POST',
        headers: {
          'Authorization': accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ state: stateToSave })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to save trading state: ${response.status}`);
      }
      
      // Update cache
      this.cachedState = stateToSave;
      this.lastFetch = new Date();
      
      console.log('💾 Trading state saved to backend');
      return true;
    } catch (error) {
      console.error('❌ Error saving trading state to backend:', error);
      // Fallback to localStorage
      this.saveToLocalStorage(state);
      return false;
    }
  }

  /**
   * Save trading state to localStorage (fallback)
   */
  private static saveToLocalStorage(state: TradingState): void {
    try {
      const stateToSave = {
        contractInputs: state.contractInputs,
        ceMonitor: state.ceMonitor,
        peMonitor: state.peMonitor,
        tradingMode: state.tradingMode,
        selectedIndex: state.selectedIndex,
        savedAt: new Date().toISOString()
      };
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(stateToSave));
      console.log('💾 Trading state saved to localStorage (fallback)');
    } catch (error) {
      console.error('❌ Error saving trading state to localStorage:', error);
    }
  }

  /**
   * Load trading state from backend API
   */
  static async loadTradingState(): Promise<Partial<TradingState> | null> {
    try {
      // Check cache first
      const now = new Date();
      if (this.lastFetch && (now.getTime() - this.lastFetch.getTime() < this.CACHE_TTL)) {
        return this.cachedState;
      }
      
      const accessToken = getAccessToken();
      
      if (!accessToken) {
        throw new Error('No access token found');
      }
      
      const response = await fetch(`${API_URL}/api/trading-state`, {
        headers: {
          'Authorization': accessToken
        }
      });
      
      if (response.status === 404) {
        console.log('📝 No trading state found in backend');
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Failed to load trading state: ${response.status}`);
      }
      
      const parsed = await response.json();
      
      // Check if the saved state is from today (don't restore old monitoring)
      const savedAt = new Date(parsed.savedAt);
      const isToday = savedAt.toDateString() === now.toDateString();
      
      if (!isToday) {
        console.log('🗑️ Clearing old trading state from different day');
        await this.clearTradingState();
        return null;
      }

      // Convert date strings back to Date objects
      if (parsed.ceMonitor?.lastUpdate) {
        parsed.ceMonitor.lastUpdate = new Date(parsed.ceMonitor.lastUpdate);
      }
      if (parsed.peMonitor?.lastUpdate) {
        parsed.peMonitor.lastUpdate = new Date(parsed.peMonitor.lastUpdate);
      }
      if (parsed.ceMonitor?.crossoverSignalTime) {
        parsed.ceMonitor.crossoverSignalTime = new Date(parsed.ceMonitor.crossoverSignalTime);
      }
      if (parsed.peMonitor?.crossoverSignalTime) {
        parsed.peMonitor.crossoverSignalTime = new Date(parsed.peMonitor.crossoverSignalTime);
      }

      // Update cache
      this.cachedState = parsed;
      this.lastFetch = now;
      
      console.log('📥 Trading state loaded from backend');
      return parsed;
    } catch (error) {
      console.error('❌ Error loading trading state from backend:', error);
      // Fallback to localStorage
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Load trading state from localStorage (fallback)
   */
  private static loadFromLocalStorage(): Partial<TradingState> | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const parsed = JSON.parse(stored);
      
      // Check if the saved state is from today (don't restore old monitoring)
      const savedAt = new Date(parsed.savedAt);
      const now = new Date();
      const isToday = savedAt.toDateString() === now.toDateString();
      
      if (!isToday) {
        console.log('🗑️ Clearing old trading state from different day');
        this.clearLocalStorage();
        return null;
      }

      // Convert date strings back to Date objects
      if (parsed.ceMonitor?.lastUpdate) {
        parsed.ceMonitor.lastUpdate = new Date(parsed.ceMonitor.lastUpdate);
      }
      if (parsed.peMonitor?.lastUpdate) {
        parsed.peMonitor.lastUpdate = new Date(parsed.peMonitor.lastUpdate);
      }
      if (parsed.ceMonitor?.crossoverSignalTime) {
        parsed.ceMonitor.crossoverSignalTime = new Date(parsed.ceMonitor.crossoverSignalTime);
      }
      if (parsed.peMonitor?.crossoverSignalTime) {
        parsed.peMonitor.crossoverSignalTime = new Date(parsed.peMonitor.crossoverSignalTime);
      }

      console.log('📥 Trading state loaded from localStorage (fallback)');
      return parsed;
    } catch (error) {
      console.error('❌ Error loading trading state from localStorage:', error);
      return null;
    }
  }

  /**
   * Clear trading state from backend and localStorage
   */
  static async clearTradingState(): Promise<boolean> {
    try {
      const accessToken = getAccessToken();
      
      if (!accessToken) {
        throw new Error('No access token found');
      }
      
      const response = await fetch(`${API_URL}/api/trading-state`, {
        method: 'DELETE',
        headers: {
          'Authorization': accessToken
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to clear trading state: ${response.status}`);
      }
      
      // Clear cache
      this.cachedState = null;
      this.lastFetch = null;
      
      // Also clear localStorage
      this.clearLocalStorage();
      
      console.log('🗑️ Trading state cleared from backend and localStorage');
      return true;
    } catch (error) {
      console.error('❌ Error clearing trading state from backend:', error);
      // Fallback to clearing localStorage only
      this.clearLocalStorage();
      return false;
    }
  }

  /**
   * Clear trading state from localStorage
   */
  private static clearLocalStorage(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Trading state cleared from localStorage');
    } catch (error) {
      console.error('❌ Error clearing trading state from localStorage:', error);
    }
  }

  /**
   * Check if there's a saved trading state
   */
  static async hasSavedState(): Promise<boolean> {
    try {
      const state = await this.loadTradingState();
      return state !== null;
    } catch (error) {
      console.error('❌ Error checking for saved trading state:', error);
      // Fallback to localStorage
      return localStorage.getItem(this.STORAGE_KEY) !== null;
    }
  }
} 