const fs = require('fs').promises;
const path = require('path');

// Path to store trading state
const DATA_DIR = path.join(__dirname, 'data');
const STATE_FILE = path.join(DATA_DIR, 'trading_state.json');

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

/**
 * Save trading state to file
 */
async function saveTradingState(state, userId = 'default') {
  try {
    await ensureDataDir();
    
    const stateToSave = {
      contractInputs: state.contractInputs,
      ceMonitor: state.ceMonitor,
      peMonitor: state.peMonitor,
      tradingMode: state.tradingMode,
      selectedIndex: state.selectedIndex,
      monitoredSymbols: state.monitoredSymbols || [],
      savedAt: new Date().toISOString()
    };
    
    // We store state per user if userId is provided
    const fileName = userId === 'default' ? STATE_FILE : path.join(DATA_DIR, `trading_state_${userId}.json`);
    
    await fs.writeFile(fileName, JSON.stringify(stateToSave, null, 2), 'utf8');
    console.log(`💾 Trading state saved for user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error saving trading state:', error);
    return false;
  }
}

/**
 * Load trading state from file
 */
async function loadTradingState(userId = 'default') {
  try {
    await ensureDataDir();
    
    // We load state per user if userId is provided
    const fileName = userId === 'default' ? STATE_FILE : path.join(DATA_DIR, `trading_state_${userId}.json`);
    
    try {
      const data = await fs.readFile(fileName, 'utf8');
      const parsed = JSON.parse(data);
      
      // Check if the saved state is from today (don't restore old monitoring)
      const savedAt = new Date(parsed.savedAt);
      const now = new Date();
      const isToday = savedAt.toDateString() === now.toDateString();
      
      if (!isToday) {
        console.log('🗑️ Clearing old trading state from different day');
        await clearTradingState(userId);
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
      
      // Convert dates in monitoredSymbols if present
      if (parsed.monitoredSymbols && Array.isArray(parsed.monitoredSymbols)) {
        parsed.monitoredSymbols = parsed.monitoredSymbols.map(entry => ({
          ...entry,
          lastUpdate: entry.lastUpdate ? new Date(entry.lastUpdate) : null,
          crossoverSignalTime: entry.crossoverSignalTime ? new Date(entry.crossoverSignalTime) : null,
          addedAt: entry.addedAt ? new Date(entry.addedAt) : new Date()
        }));
      }

      console.log(`📥 Trading state loaded for user ${userId}`);
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet
        return null;
      }
      console.error('❌ Error loading trading state:', error);
      return null;
    }
  } catch (error) {
    console.error('❌ Error in loadTradingState:', error);
    return null;
  }
}

/**
 * Clear trading state from file
 */
async function clearTradingState(userId = 'default') {
  try {
    await ensureDataDir();
    
    // We clear state per user if userId is provided
    const fileName = userId === 'default' ? STATE_FILE : path.join(DATA_DIR, `trading_state_${userId}.json`);
    
    try {
      await fs.unlink(fileName);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('❌ Error clearing trading state:', error);
        return false;
      }
    }
    
    console.log(`🗑️ Trading state cleared for user ${userId}`);
    return true;
  } catch (error) {
    console.error('❌ Error in clearTradingState:', error);
    return false;
  }
}

/**
 * Check if there's a saved trading state
 */
async function hasSavedState(userId = 'default') {
  try {
    await ensureDataDir();
    
    // We check state per user if userId is provided
    const fileName = userId === 'default' ? STATE_FILE : path.join(DATA_DIR, `trading_state_${userId}.json`);
    
    try {
      await fs.access(fileName);
      return true;
    } catch (error) {
      return false;
    }
  } catch (error) {
    console.error('❌ Error in hasSavedState:', error);
    return false;
  }
}

module.exports = {
  saveTradingState,
  loadTradingState,
  clearTradingState,
  hasSavedState
};
