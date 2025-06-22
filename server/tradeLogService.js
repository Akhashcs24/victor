const fs = require('fs').promises;
const path = require('path');

// Path to store trade logs
const LOGS_DIR = path.join(__dirname, 'data');
const LOGS_FILE = path.join(LOGS_DIR, 'trade_logs.json');

// Maximum storage days
const MAX_STORAGE_DAYS = 60; // 2 months

/**
 * Ensure data directory exists
 */
async function ensureDataDir() {
  try {
    await fs.mkdir(LOGS_DIR, { recursive: true });
  } catch (error) {
    console.error('Error creating data directory:', error);
  }
}

/**
 * Get today's date as YYYY-MM-DD string
 */
function getTodayKey() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get stored trade logs from file
 */
async function getStoredLogs() {
  try {
    await ensureDataDir();
    
    try {
      const data = await fs.readFile(LOGS_FILE, 'utf8');
      const logs = JSON.parse(data);
      
      // Convert timestamp strings back to Date objects
      Object.keys(logs).forEach(date => {
        logs[date] = logs[date].map(log => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      });
      
      return logs;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist yet, return empty object
        return {};
      }
      console.error('Error loading trade logs from file:', error);
      return {};
    }
  } catch (error) {
    console.error('Error in getStoredLogs:', error);
    return {};
  }
}

/**
 * Save trade logs to file
 */
async function saveToStorage(logs) {
  try {
    await ensureDataDir();
    
    // Clean up old logs (older than MAX_STORAGE_DAYS)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - MAX_STORAGE_DAYS);
    const cutoffKey = cutoffDate.toISOString().split('T')[0];
    
    const cleanedLogs = {};
    Object.keys(logs).forEach(date => {
      if (date >= cutoffKey) {
        cleanedLogs[date] = logs[date];
      }
    });
    
    await fs.writeFile(LOGS_FILE, JSON.stringify(cleanedLogs, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving trade logs to file:', error);
  }
}

/**
 * Add a new trade log entry
 */
async function addTradeLog(trade) {
  const tradeLog = {
    ...trade,
    id: `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date()
  };

  const allLogs = await getStoredLogs();
  const todayKey = getTodayKey();
  
  if (!allLogs[todayKey]) {
    allLogs[todayKey] = [];
  }
  
  allLogs[todayKey].unshift(tradeLog); // Add to beginning for newest first
  await saveToStorage(allLogs);
  
  console.log('📝 Trade log added and persisted:', tradeLog);
  return tradeLog;
}

/**
 * Get today's trade logs
 */
async function getTodayTradeLogs() {
  const allLogs = await getStoredLogs();
  const todayKey = getTodayKey();
  return allLogs[todayKey] || [];
}

/**
 * Get historical trade logs (last 2 months)
 */
async function getHistoricalTradeLogs() {
  return await getStoredLogs();
}

/**
 * Get trade logs for a specific date
 */
async function getTradeLogsByDate(date) {
  const allLogs = await getStoredLogs();
  return allLogs[date] || [];
}

/**
 * Get all trade logs as a flat array (newest first)
 */
async function getAllTradeLogsFlat() {
  const allLogs = await getStoredLogs();
  const flatLogs = [];
  
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
async function getTodayPnL() {
  const todayLogs = await getTodayTradeLogs();
  return todayLogs.reduce((total, log) => total + (log.pnl || 0), 0);
}

/**
 * Get total P&L for all time
 */
async function getTotalPnL() {
  const allLogs = await getAllTradeLogsFlat();
  return allLogs.reduce((total, log) => total + (log.pnl || 0), 0);
}

/**
 * Get trade statistics
 */
async function getTradeStats() {
  const todayLogs = await getTodayTradeLogs();
  const allLogs = await getAllTradeLogsFlat();
  
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
async function clearAllLogs() {
  try {
    await ensureDataDir();
    await fs.writeFile(LOGS_FILE, JSON.stringify({}), 'utf8');
    console.log('🗑️ All trade logs cleared');
    return true;
  } catch (error) {
    console.error('Error clearing trade logs:', error);
    return false;
  }
}

/**
 * Export trade logs as JSON
 */
async function exportLogs() {
  const allLogs = await getStoredLogs();
  return JSON.stringify(allLogs, null, 2);
}

/**
 * Import trade logs from JSON
 */
async function importLogs(jsonData) {
  try {
    const logs = JSON.parse(jsonData);
    await saveToStorage(logs);
    console.log('📥 Trade logs imported successfully');
    return true;
  } catch (error) {
    console.error('Error importing trade logs:', error);
    return false;
  }
}

module.exports = {
  addTradeLog,
  getTodayTradeLogs,
  getHistoricalTradeLogs,
  getTradeLogsByDate,
  getAllTradeLogsFlat,
  getTodayPnL,
  getTotalPnL,
  getTradeStats,
  clearAllLogs,
  exportLogs,
  importLogs
};
