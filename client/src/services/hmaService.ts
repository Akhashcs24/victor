import { HMAData, HMAConfig } from '../types';
import { MarketDataService, CandleData } from './marketDataService';
import { getAccessToken } from './authService';

export interface Candle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  hma?: number;
}

export interface HMACache {
  candles: Candle[];
  lastUpdate: Date;
  symbol: string;
  isLiveMonitoring: boolean;
  monitoringInterval?: NodeJS.Timeout;
}

export class HMAService {
  private static readonly HMA_PERIOD = 55;
  private static readonly REQUIRED_CANDLES = 60; // 300 market minutes = 60 x 5-min candles
  private static readonly TRADING_START_HOUR = 9;
  private static readonly TRADING_START_MINUTE = 15;
  private static readonly TRADING_END_HOUR = 15;
  private static readonly TRADING_END_MINUTE = 30;
  private static readonly MARKET_START_MINUTES = 555; // 9:15 AM
  private static readonly MARKET_END_MINUTES = 930; // 3:30 PM

  // Cache for storing candles per option symbol
  private static candleCache: Map<string, HMACache> = new Map();

  // Get API URL from environment or use default
  private static readonly API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';

  /**
   * Main entry point: Fetch HMA for both CE and PE symbols
   */
  static async fetchHMAForSymbols(ceSymbol: string, peSymbol: string): Promise<{
    ce: HMAConfig;
    pe: HMAConfig;
  }> {
    console.log(`🎯 Fetching HMA for CE: ${ceSymbol}, PE: ${peSymbol}`);
    
    try {
      const [ceHMA, peHMA] = await Promise.all([
        this.fetchAndCalculateHMA(ceSymbol),
        this.fetchAndCalculateHMA(peSymbol)
      ]);

      console.log(`✅ HMA calculation completed for both symbols`);
      console.log(`📊 CE HMA: ${ceHMA.currentHMA.toFixed(2)}`);
      console.log(`📊 PE HMA: ${peHMA.currentHMA.toFixed(2)}`);

      return { ce: ceHMA, pe: peHMA };
    } catch (error) {
      console.error(`❌ Error fetching HMA for symbols:`, error);
      throw error;
    }
  }

  /**
   * Fetch historical data and calculate HMA for a single symbol
   */
  static async fetchAndCalculateHMA(symbol: string): Promise<HMAConfig> {
    try {
      console.log(`📊 Fetching HMA data for ${symbol}...`);
      
      // Check cache first
      const cached = this.candleCache.get(symbol);
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      
      if (cached && cached.lastUpdate > fiveMinutesAgo) {
        console.log(`📊 Using cached candles for ${symbol}: ${cached.candles.length} candles`);
        const hmaConfig = this.calculateHMAFromCandles(cached.candles);
        return hmaConfig;
      }

      // Clear old cache if symbol changed
      if (cached) {
        this.stopLiveMonitoring(symbol);
        this.candleCache.delete(symbol);
      }

      // Fetch fresh data
      const candles = await this.fetchMarketAwareCandles(symbol);
      
      // Cache the candles
      this.candleCache.set(symbol, {
        candles,
        lastUpdate: now,
        symbol,
        isLiveMonitoring: false
      });

      console.log(`📊 Fetched ${candles.length} valid candles for ${symbol}`);
      
      // Calculate HMA
      const hmaConfig = this.calculateHMAFromCandles(candles);
      
      console.log(`✅ Calculated HMA(55): ${hmaConfig.currentHMA.toFixed(2)} for ${symbol}`);
      
      // Start live monitoring if within market hours
      if (this.isWithinMarketHours()) {
        this.startLiveMonitoring(symbol);
      }
      
      return hmaConfig;
    } catch (error) {
      console.error(`❌ Error calculating HMA for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Fetch market-aware candles (only trading hours, rolling 300 minutes)
   */
  private static async fetchMarketAwareCandles(symbol: string): Promise<Candle[]> {
    let allCandles: Candle[] = [];
    let currentDate = new Date();
    let attempts = 0;
    const maxAttempts = 5; // Don't go back more than 5 trading days

    console.log(`🕒 Understanding current time context for ${symbol}...`);
    console.log(`📅 Current time: ${currentDate.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);

    while (allCandles.length < this.REQUIRED_CANDLES && attempts < maxAttempts) {
      try {
        const dateStr = this.formatDateForAPI(currentDate);
        console.log(`📊 Fetching candles for ${symbol} on ${dateStr}, attempt ${attempts + 1}`);
        
        const historicalData = await MarketDataService.getHistoricalData(
          symbol,
          '5', // 5-minute candles
          dateStr,
          dateStr
        );

        if (historicalData && historicalData.length > 0) {
          // Convert to Candle objects and filter for trading hours
          const tradingHoursCandles = this.convertAndFilterTradingHoursCandles(historicalData);
          console.log(`📊 Found ${tradingHoursCandles.length} trading hours candles for ${dateStr}`);
          
          allCandles = [...tradingHoursCandles, ...allCandles];
        }

        // Move to previous trading day
        currentDate = this.getPreviousTradingDay(currentDate);
        attempts++;
        
      } catch (error) {
        console.error(`❌ Error fetching candles for ${currentDate.toDateString()}:`, error);
        currentDate = this.getPreviousTradingDay(currentDate);
        attempts++;
      }
    }

    if (allCandles.length < this.REQUIRED_CANDLES) {
      throw new Error(`Not enough trading data available to calculate HMA(55) for ${symbol}. Found ${allCandles.length} candles, need ${this.REQUIRED_CANDLES}`);
    }

    // Take only the most recent REQUIRED_CANDLES
    const recentCandles = allCandles.slice(-this.REQUIRED_CANDLES);
    console.log(`📊 Using ${recentCandles.length} most recent trading hours candles for HMA calculation`);
    
    return recentCandles;
  }

  /**
   * Convert raw candles to Candle objects and filter for trading hours
   */
  private static convertAndFilterTradingHoursCandles(candles: CandleData[]): Candle[] {
    return candles
      .filter(candle => {
        const date = new Date(candle.timestamp * 1000);
        const hours = date.getHours();
        const minutes = date.getMinutes();
        const timeInMinutes = hours * 60 + minutes;
        
        return timeInMinutes >= this.MARKET_START_MINUTES && timeInMinutes <= this.MARKET_END_MINUTES;
      });
  }

  /**
   * Calculate HMA from candles array using Pine Script logic
   */
  private static calculateHMAFromCandles(candles: Candle[]): HMAConfig {
    if (candles.length < this.HMA_PERIOD) {
      throw new Error(`Insufficient data. Need at least ${this.HMA_PERIOD} candles for HMA-${this.HMA_PERIOD}`);
    }

    const hmaData: HMAData[] = candles.map(candle => ({
      timestamp: candle.timestamp,
      close: candle.close,
      hma: 0 // Will be calculated
    }));

    // Calculate HMA for each point starting from period-1
    for (let i = this.HMA_PERIOD - 1; i < hmaData.length; i++) {
      hmaData[i].hma = this.calculateHMAForPoint(hmaData, i, this.HMA_PERIOD);
    }

    const currentHMA = hmaData[hmaData.length - 1]?.hma || 0;

    return {
      period: this.HMA_PERIOD,
      data: hmaData,
      currentHMA,
      lastUpdate: new Date()
    };
  }

  /**
   * Calculate HMA for a specific point using Pine Script logic
   * Based on: ta.wma(2*ta.wma(src, length/2)-ta.wma(src, length), math.floor(math.sqrt(length)))
   */
  private static calculateHMAForPoint(data: HMAData[], index: number, period: number): number {
    const prices = data.slice(0, index + 1).map(d => d.close);
    
    // Step 1: Calculate WMA with period/2
    const wmaHalfPeriod = this.calculateWMA(prices, Math.floor(period / 2));

    // Step 2: Calculate WMA with full period
    const wmaFullPeriod = this.calculateWMA(prices, period);

    // Step 3: Create the series for the next WMA
    const diffSeries = wmaHalfPeriod.map((val, i) => 2 * val - wmaFullPeriod[i]);

    // Step 4: Calculate WMA of the difference series with sqrt(period)
    const sqrtPeriod = Math.floor(Math.sqrt(period));
    const hmaSeries = this.calculateWMA(diffSeries, sqrtPeriod);

    return hmaSeries.length > 0 ? hmaSeries[hmaSeries.length - 1] : 0;
  }

  /**
   * Calculate Weighted Moving Average for a series of prices
   */
  private static calculateWMA(prices: number[], period: number): number[] {
    if (prices.length < period) {
      return Array(prices.length).fill(0);
    }

    const result: number[] = [];
    const denominator = (period * (period + 1)) / 2;

    for (let i = 0; i < prices.length; i++) {
      if (i < period - 1) {
        result.push(0); // Not enough data points yet
        continue;
      }

      let sum = 0;
      for (let j = 0; j < period; j++) {
        // Weight is position + 1 (1 to period)
        const weight = j + 1;
        const price = prices[i - period + j + 1];
        sum += price * weight;
      }

      result.push(sum / denominator);
    }

    return result;
  }

  /**
   * Start live monitoring for a symbol
   */
  private static startLiveMonitoring(symbol: string): void {
    const cached = this.candleCache.get(symbol);
    if (!cached || cached.isLiveMonitoring) return;

    console.log(`🔄 Starting live monitoring for ${symbol}`);
    
    // Update every 5 minutes
    const interval = setInterval(() => this.updateHMAWithNewCandle(symbol), 5 * 60 * 1000);
    
    this.candleCache.set(symbol, {
      ...cached,
      isLiveMonitoring: true,
      monitoringInterval: interval
    });
  }

  /**
   * Stop live monitoring for a symbol
   */
  private static stopLiveMonitoring(symbol: string): void {
    const cached = this.candleCache.get(symbol);
    if (!cached || !cached.isLiveMonitoring) return;

    console.log(`⏹️ Stopping live monitoring for ${symbol}`);
    
    if (cached.monitoringInterval) {
      clearInterval(cached.monitoringInterval);
    }
    
    this.candleCache.set(symbol, {
      ...cached,
      isLiveMonitoring: false,
      monitoringInterval: undefined
    });
  }

  /**
   * Update HMA with new candle data
   */
  private static async updateHMAWithNewCandle(symbol: string): Promise<void> {
    try {
      const cache = this.candleCache.get(symbol);
      if (!cache) return;

      console.log(`🔄 Updating HMA with new candle for ${symbol}`);
      
      // Fetch latest candle
      const now = new Date();
      const dateStr = this.formatDateForAPI(now);
      
      const historicalData = await MarketDataService.getHistoricalData(
        symbol,
        '5', // 5-minute candles
        dateStr,
        dateStr
      );

      if (historicalData && historicalData.length > 0) {
        // Get the most recent candle
        const latestCandles = this.convertAndFilterTradingHoursCandles(historicalData);
        
        if (latestCandles.length > 0) {
          const latestNewCandle = latestCandles[latestCandles.length - 1];
          
          // Check if this is actually a new candle
          const existingCandle = cache.candles.find(c => c.timestamp === latestNewCandle.timestamp);
          
          if (!existingCandle) {
            // Add new candle and remove oldest
            cache.candles.push(latestNewCandle);
            cache.candles.shift(); // Remove oldest candle
            
            // Recalculate HMA and update cache
            const hmaConfig = this.calculateHMAFromCandles(cache.candles);
            cache.lastUpdate = new Date();
            console.log(`📈 Live HMA updated for ${symbol}: ${hmaConfig.currentHMA.toFixed(2)}`);
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error updating HMA for ${symbol}:`, error);
    }
  }

  /**
   * Check if current time is within market hours (with a buffer)
   */
  private static isWithinMarketHours(): boolean {
    const now = new Date();
    const day = now.getDay();
    if (day === 0 || day === 6) return false; // Skip weekends

    const hours = now.getHours();
    const minutes = now.getMinutes();
    const timeInMinutes = hours * 60 + minutes;

    // Add a 5-minute buffer to allow fetching the last candle
    return timeInMinutes >= this.MARKET_START_MINUTES && timeInMinutes <= this.MARKET_END_MINUTES + 5;
  }

  /**
   * Get the previous trading day
   */
  private static getPreviousTradingDay(date: Date): Date {
    const prevDay = new Date(date);
    prevDay.setDate(prevDay.getDate() - 1);
    
    while (prevDay.getDay() === 0 || prevDay.getDay() === 6) {
      prevDay.setDate(prevDay.getDate() - 1);
    }
    
    return prevDay;
  }

  /**
   * Format date for Fyers API (YYYY-MM-DD)
   */
  private static formatDateForAPI(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Clear cache for a specific symbol
   */
  static clearCache(symbol: string): void {
    this.stopLiveMonitoring(symbol);
    this.candleCache.delete(symbol);
    console.log(`🧹 Cache cleared for ${symbol}`);
  }

  /**
   * Clear all cached data
   */
  static clearAllCache(): void {
    for (const symbol of this.candleCache.keys()) {
      this.stopLiveMonitoring(symbol);
    }
    this.candleCache.clear();
    console.log('🧹 All HMA cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats(): { symbol: string; candleCount: number; lastUpdate: Date; isLiveMonitoring: boolean }[] {
    return Array.from(this.candleCache.entries()).map(([symbol, cache]) => ({
      symbol,
      candleCount: cache.candles.length,
      lastUpdate: cache.lastUpdate,
      isLiveMonitoring: cache.isLiveMonitoring
    }));
  }

  /**
   * Detect HMA crossover
   */
  static detectCrossover(currentPrice: number, previousPrice: number, hmaValue: number): 'ABOVE' | 'BELOW' | 'NONE' {
    const currentAboveHMA = currentPrice > hmaValue;
    const previousAboveHMA = previousPrice > hmaValue;
    
    if (currentAboveHMA && !previousAboveHMA) {
      return 'ABOVE'; // Price crossed above HMA
    } else if (!currentAboveHMA && previousAboveHMA) {
      return 'BELOW'; // Price crossed below HMA
    }
    
    return 'NONE'; // No crossover
  }

  /**
   * Get current HMA value for a symbol
   */
  static getCurrentHMA(symbol: string): number | null {
    const cached = this.candleCache.get(symbol);
    if (cached && cached.candles.length > 0) {
      const lastCandle = cached.candles[cached.candles.length - 1];
      return lastCandle.hma || null;
    }
    return null;
  }
} 