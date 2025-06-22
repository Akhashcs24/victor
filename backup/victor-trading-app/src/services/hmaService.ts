import { HMAData } from '../types';

export class HMAService {
  /**
   * Calculate Hull Moving Average (HMA)
   * Formula: HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))
   */
  static calculateHMA(prices: number[], period: number = 55): (number | null)[] {
    if (prices.length < period) {
      return new Array(prices.length).fill(null);
    }

    const halfPeriod = Math.floor(period / 2);
    const sqrtPeriod = Math.floor(Math.sqrt(period));

    // Calculate WMA with period/2
    const wmaHalf = this.calculateWMA(prices, halfPeriod);
    
    // Calculate WMA with full period
    const wmaFull = this.calculateWMA(prices, period);
    
    // Calculate 2*WMA(n/2) - WMA(n)
    const diff: (number | null)[] = [];
    for (let i = 0; i < wmaHalf.length; i++) {
      if (wmaHalf[i] !== null && wmaFull[i] !== null) {
        diff.push(2 * wmaHalf[i]! - wmaFull[i]!);
      } else {
        diff.push(null);
      }
    }
    
    // Calculate WMA of diff with sqrt(period)
    const hma = this.calculateWMA(diff, sqrtPeriod);
    
    return hma;
  }

  /**
   * Calculate Weighted Moving Average (WMA)
   */
  static calculateWMA(prices: (number | null)[], period: number): (number | null)[] {
    if (prices.length < period) {
      return new Array(prices.length).fill(null);
    }

    const result: (number | null)[] = [];
    const denominator = (period * (period + 1)) / 2;
    
    for (let i = period - 1; i < prices.length; i++) {
      let sum = 0;
      for (let j = 0; j < period; j++) {
        const price = prices[i - j];
        if (price === null || isNaN(price)) {
          result.push(null);
          break;
        }
        // Weight is (period - j)
        sum += price * (period - j);
      }
      if (result.length <= i) {
        result.push(sum / denominator);
      }
    }
    
    return result;
  }

  /**
   * Calculate HMA for a single new price point
   */
  static calculateHMAForNewPrice(
    historicalPrices: number[], 
    newPrice: number, 
    period: number = 55
  ): number | null {
    const allPrices = [...historicalPrices, newPrice];
    const hmaValues = this.calculateHMA(allPrices, period);
    return hmaValues[hmaValues.length - 1] || null;
  }

  /**
   * Get the latest HMA value from historical data
   */
  static getLatestHMAValue(historicalData: HMAData[]): number | null {
    if (historicalData.length === 0) {
      return null;
    }
    
    const latestData = historicalData[historicalData.length - 1];
    return latestData.hma55;
  }

  /**
   * Check if price is above HMA (potential buy signal)
   */
  static isPriceAboveHMA(currentPrice: number, hmaValue: number | null): boolean {
    if (hmaValue === null) {
      return false;
    }
    return currentPrice > hmaValue;
  }

  /**
   * Check if price is below HMA (potential sell signal)
   */
  static isPriceBelowHMA(currentPrice: number, hmaValue: number | null): boolean {
    if (hmaValue === null) {
      return false;
    }
    return currentPrice < hmaValue;
  }

  /**
   * Detect HMA crossover (price crosses above HMA)
   */
  static detectHMACrossover(
    previousPrice: number,
    currentPrice: number,
    previousHMA: number | null,
    currentHMA: number | null
  ): boolean {
    if (previousHMA === null || currentHMA === null) {
      return false;
    }
    
    // Check if price was below HMA before and is now above HMA
    return previousPrice <= previousHMA && currentPrice > currentHMA;
  }

  /**
   * Detect HMA crossunder (price crosses below HMA)
   */
  static detectHMACrossunder(
    previousPrice: number,
    currentPrice: number,
    previousHMA: number | null,
    currentHMA: number | null
  ): boolean {
    if (previousHMA === null || currentHMA === null) {
      return false;
    }
    
    // Check if price was above HMA before and is now below HMA
    return previousPrice >= previousHMA && currentPrice < currentHMA;
  }
} 