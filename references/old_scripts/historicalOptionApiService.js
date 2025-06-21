// TEMPORARY STUB - This file is being migrated to marketDataService
// This stub exists only to prevent module loading errors during migration

class marketDataService {
  constructor() {
    console.log('⚠️ TEMPORARY: Old marketDataService stub loaded - migrate to marketDataService');
  }

  // Stub methods - redirect to unified service
  async startOptionDataCollection(indexSymbol, strikeType, appId, accessToken) {
    console.log(`🔄 REDIRECTING: ${indexSymbol} ${strikeType} to marketDataService`);
    const marketDataService = require('./marketDataService');
    return await marketDataService.startOptionDataCollection(indexSymbol, strikeType, appId, accessToken);
  }

  async fetchAndStoreHistoricalData() {
    throw new Error('MIGRATION: Use marketDataService.validateAndEnsureHistoricalData instead');
  }

  cleanup() {
    console.log('⚠️ STUB: marketDataService cleanup called - redirecting to unified service');
    const marketDataService = require('./marketDataService');
    return marketDataService.cleanup();
  }
}

module.exports = new marketDataService(); 