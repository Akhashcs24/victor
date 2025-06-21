import { AuthService } from './authService';
import { SymbolConfigService } from './symbolConfig';
import { MarketData, IndexType, ApiResponse, HMAData } from '../types';
import { HMAService } from './hmaService';

export class MarketDataService {
  private static instance: MarketDataService;
  private authService: AuthService;
  private apiCallCount: number = 0;
  private lastApiCallTime: Date | null = null;
  private dailyLimit: number = 100000;

  private constructor() {
    this.authService = AuthService.getInstance();
  }

  static getInstance(): MarketDataService {
    if (!MarketDataService.instance) {
      MarketDataService.instance = new MarketDataService();
    }
    return MarketDataService.instance;
  }

  /**
   * Get market data for a specific index
   */
  async getMarketData(indexKey: IndexType): Promise<ApiResponse<MarketData>> {
    try {
      const auth = this.authService.getLastAuthentication();
      if (!auth) {
        return {
          success: false,
          error: 'No authentication available'
        };
      }

      const fyers = this.authService.getFyersInstance(auth.appId, auth.accessToken);
      const symbols = SymbolConfigService.getMarketDepthSymbols(indexKey);
      
      console.log(`Fetching market data for ${indexKey}:`, symbols);
      
      const response = await fyers.getMarketDepth({
        symbol: symbols,
        ohlcv_flag: 1
      });

      if (response && response.s === 'ok' && response.d) {
        const config = SymbolConfigService.getSymbolConfig(indexKey);
        const spotData = response.d[config.index];
        const futuresData = response.d[config.futures];

        if (!spotData || !futuresData) {
          return {
            success: false,
            error: 'Incomplete market data received'
          };
        }

        const marketData: MarketData = {
          index: {
            price: parseFloat(spotData.ltp || spotData.lp || spotData.v?.lp || '0'),
            change: parseFloat(spotData.ch || spotData.v?.ch || '0'),
            changePercent: parseFloat(spotData.chp || spotData.v?.chp || '0'),
            volume: parseFloat(spotData.v || spotData.volume || '0')
          },
          futures: {
            price: parseFloat(futuresData.ltp || futuresData.lp || futuresData.v?.lp || '0'),
            change: parseFloat(futuresData.ch || futuresData.v?.ch || '0'),
            changePercent: parseFloat(futuresData.chp || futuresData.v?.chp || '0'),
            openInterest: parseFloat(futuresData.oi || futuresData.v?.oi || '0')
          },
          lastUpdated: new Date().toISOString()
        };

        this.recordApiCall();
        
        return {
          success: true,
          data: marketData
        };
      } else {
        return {
          success: false,
          error: 'Failed to fetch market data from Fyers API'
        };
      }
    } catch (error: any) {
      console.error('Market data fetch error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch market data'
      };
    }
  }

  /**
   * Fetch historical data for HMA calculation
   */
  async fetchHistoricalData(
    indexKey: IndexType,
    timeframe: '1min' | '5min' = '5min',
    candles: number = 55
  ): Promise<ApiResponse<HMAData[]>> {
    try {
      const auth = this.authService.getLastAuthentication();
      if (!auth) {
        return {
          success: false,
          error: 'No authentication available'
        };
      }

      const fyers = this.authService.getFyersInstance(auth.appId, auth.accessToken);
      const config = SymbolConfigService.getSymbolConfig(indexKey);
      
      // Calculate date range (last 55 candles of 5-min data)
      const now = new Date();
      const fromDate = new Date(now.getTime() - (candles * 5 * 60 * 1000)); // 5 minutes per candle
      
      const response = await fyers.getHistory({
        symbol: config.index,
        resolution: timeframe === '1min' ? '1' : '5',
        date_format: '1',
        range_from: this.formatDateForApi(fromDate),
        range_to: this.formatDateForApi(now),
        cont_flag: '1'
      });

      if (response && response.s === 'ok' && response.candles && response.candles.length > 0) {
        console.log(`Received ${response.candles.length} candles for ${indexKey}`);
        
        // Process candles and calculate HMA
        const closePrices = response.candles.map((candle: any) => candle[4]); // Close price
        const hmaValues = HMAService.calculateHMA(closePrices, 55);
        
        const hmaData: HMAData[] = response.candles.map((candle: any, index: number) => ({
          timestamp: new Date(candle[0] * 1000), // Convert epoch to Date
          close: candle[4], // Close price
          hma55: hmaValues[index] || null
        }));

        this.recordApiCall();
        
        return {
          success: true,
          data: hmaData
        };
      } else {
        return {
          success: false,
          error: 'No historical data available'
        };
      }
    } catch (error: any) {
      console.error('Historical data fetch error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch historical data'
      };
    }
  }

  /**
   * Get option data for specific symbols
   */
  async getOptionData(symbols: string[]): Promise<ApiResponse<any>> {
    try {
      const auth = this.authService.getLastAuthentication();
      if (!auth) {
        return {
          success: false,
          error: 'No authentication available'
        };
      }

      const fyers = this.authService.getFyersInstance(auth.appId, auth.accessToken);
      
      const response = await fyers.getMarketDepth({
        symbol: symbols,
        ohlcv_flag: 1
      });

      if (response && response.s === 'ok' && response.d) {
        this.recordApiCall();
        
        return {
          success: true,
          data: response.d
        };
      } else {
        return {
          success: false,
          error: 'Failed to fetch option data'
        };
      }
    } catch (error: any) {
      console.error('Option data fetch error:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch option data'
      };
    }
  }

  /**
   * Format date for API calls (YYYY-MM-DD)
   */
  private formatDateForApi(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Record API call for rate limiting
   */
  private recordApiCall(): void {
    this.apiCallCount++;
    this.lastApiCallTime = new Date();
  }

  /**
   * Get API usage statistics
   */
  getUsageStats(): {
    dailyCallCount: number;
    dailyLimit: number;
    lastApiCall: Date | null;
  } {
    return {
      dailyCallCount: this.apiCallCount,
      dailyLimit: this.dailyLimit,
      lastApiCall: this.lastApiCallTime
    };
  }

  /**
   * Reset API call counter (should be called daily)
   */
  resetApiCallCounter(): void {
    this.apiCallCount = 0;
    console.log('🔄 API call counter reset');
  }

  /**
   * Check if we can make an API call (rate limiting)
   */
  canMakeApiCall(): boolean {
    return this.apiCallCount < this.dailyLimit;
  }
} 