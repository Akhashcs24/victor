// TEMPORARY STUB - This file is being migrated to marketDataService
// This stub exists only to prevent module loading errors during migration

class HistoricalApiService {
  constructor() {
    console.log('⚠️ TEMPORARY: Old historicalApiService stub loaded - migrate to marketDataService');
  }

  // Stub methods - these should not be used
  async fetchHistoricalData() {
    throw new Error('MIGRATION: Use marketDataService.validateAndEnsureHistoricalData instead');
  }

  async fetchCompleteTradingDay() {
    throw new Error('MIGRATION: Use marketDataService.validateAndEnsureHistoricalData instead');
  }

  async fetchSingleMinuteData() {
    throw new Error('MIGRATION: Use marketDataService.validateAndEnsureHistoricalData instead');
  }

  async fetchComprehensiveHistoricalData() {
    throw new Error('MIGRATION: Use marketDataService.validateAndEnsureHistoricalData instead');
  }

  async validateAndEnsureHistoricalData() {
    throw new Error('MIGRATION: Use marketDataService.validateAndEnsureHistoricalData instead');
  }

  async checkAndFillGapsForAllIndices() {
    throw new Error('MIGRATION: Use marketDataService.validateAndEnsureHistoricalData instead');
  }

  async fetchHistoricalDataForStrike() {
    throw new Error('MIGRATION: Use marketDataService.startOptionDataCollection instead');
  }

  getUsageStats() {
    return {
      dailyCallCount: 0,
      dailyLimit: 100000,
      message: 'STUB: Use marketDataService.getUsageStats()'
    };
  }

  isMarketCurrentlyOpen() {
    const marketDataService = require('./marketDataService');
    return marketDataService.isMarketCurrentlyOpen();
  }

  getCurrentTradingDay() {
    const timestampService = require('./timestampService');
    return timestampService.getCurrentIST();
  }

  getPreviousTradingDay(currentDay) {
    const date = typeof currentDay === 'string' ? new Date(currentDay) : new Date(currentDay);
    date.setDate(date.getDate() - 1);
    
    // Skip weekends
    while (date.getDay() === 0 || date.getDay() === 6) {
      date.setDate(date.getDate() - 1);
    }
    
    return date;
  }
}

module.exports = new HistoricalApiService(); 