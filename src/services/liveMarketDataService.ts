import { AuthService } from './authService';
// import { FyersMarketStatus } from '../types/fyers';

export interface LiveMarketData {
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: Date;
}

export class LiveMarketDataService {
  private baseUrl = '/api/data';

  /**
   * Fetch market data for a given symbol
   */
  async fetchMarketData(symbol: string): Promise<LiveMarketData | null> {
    try {
      const token = await AuthService.getValidAccessToken();
      const appId = AuthService.getAppId();
      
      if (!token || !appId) {
        throw new Error('No valid authentication token found');
      }

      console.log(`📊 Fetching market data for ${symbol}`);

      // Use the enhanced quotes API endpoint
      const response = await fetch(`${this.baseUrl}/quotes?symbols=${symbol}`, {
        method: 'GET',
        headers: {
          'Authorization': `${appId}:${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Market data API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // console.log('📊 Market data response:', data); // Verbose, can be enabled for debug

      if (data.s === 'ok' && data.d && data.d.length > 0) {
        const quote = data.d[0];
        if (quote.s === 'ok' && quote.v) {
        return {
            symbol: quote.n, // Use `n` for symbol name
            ltp: quote.v.lp || 0,
            open: quote.v.open_price || 0,
            high: quote.v.high_price || 0,
            low: quote.v.low_price || 0,
            close: quote.v.prev_close_price || 0,
            volume: quote.v.volume || 0,
            change: quote.v.ch || 0,
            changePercent: quote.v.chp || 0,
            timestamp: new Date((quote.v.tt || Date.now() / 1000) * 1000) // Use fyers timestamp
        };
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching market data:', error);
      return null;
    }
  }

  /**
   * Fetch market data for multiple symbols
   */
  async fetchMultipleMarketData(symbols: string[]): Promise<Map<string, LiveMarketData>> {
    const results = new Map<string, LiveMarketData>();
    
    try {
      const token = await AuthService.getValidAccessToken();
      const appId = AuthService.getAppId();
      
      if (!token || !appId) {
        throw new Error('No valid authentication token found');
      }

      // Join symbols with comma for the API call
      const symbolsParam = symbols.join(',');
      console.log(`📊 Fetching market data for multiple symbols: ${symbolsParam}`);

      const response = await fetch(`${this.baseUrl}/quotes?symbols=${symbolsParam}`, {
        method: 'GET',
        headers: {
          'Authorization': `${appId}:${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Market data API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('📊 Multiple market data response:', data);

      if (data.s === 'ok' && data.d && Array.isArray(data.d)) {
        data.d.forEach((quote: any) => {
          // console.log(`📊 Processing quote:`, quote); // Verbose
          if (quote.s === 'ok' && quote.v) {
            const marketData: LiveMarketData = {
              symbol: quote.n, // Use 'n' for symbol name
              ltp: quote.v.lp || 0,
              open: quote.v.open_price || 0,
              high: quote.v.high_price || 0,
              low: quote.v.low_price || 0,
              close: quote.v.prev_close_price || 0,
              volume: quote.v.volume || 0,
              change: quote.v.ch || 0,
              changePercent: quote.v.chp || 0,
              timestamp: new Date((quote.v.tt || Date.now() / 1000) * 1000) // Use fyers timestamp
            };
            // console.log(`✅ Processed market data for ${quote.n}:`, marketData); // Verbose
            results.set(quote.n, marketData);
          } else {
            console.log(`❌ Invalid quote data for ${quote.n}:`, quote.v);
          }
        });
      }
    } catch (error) {
      console.error('❌ Error fetching multiple market data:', error);
    }
    
    return results;
  }

  /**
   * Get index symbols for market data
   */
  getIndexSymbols(): string[] {
    return [
      'NSE:NIFTY50-INDEX',
      'NSE:NIFTYBANK-INDEX',
      'BSE:SENSEX-INDEX'
    ];
  }
} 