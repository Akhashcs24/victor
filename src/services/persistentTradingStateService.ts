import { TradingState } from '../types';

export class PersistentTradingStateService {
  private static readonly STORAGE_KEY = 'victor_trading_state';

  /**
   * Save trading state to localStorage
   */
  static saveTradingState(state: TradingState): void {
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
      console.log('💾 Trading state saved to localStorage');
    } catch (error) {
      console.error('❌ Error saving trading state:', error);
    }
  }

  /**
   * Load trading state from localStorage
   */
  static loadTradingState(): Partial<TradingState> | null {
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
        this.clearTradingState();
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

      console.log('📥 Trading state loaded from localStorage');
      return parsed;
    } catch (error) {
      console.error('❌ Error loading trading state:', error);
      return null;
    }
  }

  /**
   * Clear trading state from localStorage
   */
  static clearTradingState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      console.log('🗑️ Trading state cleared from localStorage');
    } catch (error) {
      console.error('❌ Error clearing trading state:', error);
    }
  }

  /**
   * Check if there's a saved trading state
   */
  static hasSavedState(): boolean {
    return localStorage.getItem(this.STORAGE_KEY) !== null;
  }
} 