import { getAccessToken } from './authService';

// Get API URL from environment or use default
const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';

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
  /**
   * Fetch market data for a given symbol
   */
  async fetchMarketData(symbol: string): Promise<LiveMarketData | null> {
    try {
      const token = getAccessToken();
      
      if (!token) {
        throw new Error('No valid authentication token found');
      }

      console.log(`📊 Fetching market data for ${symbol}`);

      // Use the backend API endpoint
      const response = await fetch(`${API_URL}/api/market-data/quotes?symbols=${symbol}`, {
        method: 'GET',
        headers: {
          'Authorization': token
        }
      });

      if (!response.ok) {
        throw new Error(`Market data API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // console.log('📊 Market data response:', data); // Verbose, can be enabled for debug

      if (data.success && data.data && data.data.length > 0) {
        const quote = data.data[0];
        return {
          symbol: quote.symbol,
          ltp: quote.ltp || 0,
          open: quote.open || 0,
          high: quote.high || 0,
          low: quote.low || 0,
          close: quote.close || 0,
          volume: quote.volume || 0,
          change: quote.change || 0,
          changePercent: quote.changePercent || 0,
          timestamp: new Date() // Always use current time for fresh timestamps
        };
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
      const token = getAccessToken();
      
      if (!token) {
        throw new Error('No valid authentication token found');
      }

      // Join symbols with comma for the API call
      const symbolsParam = symbols.join(',');
      console.log(`📊 Fetching market data for multiple symbols: ${symbolsParam}`);
      console.log(`📊 Using API URL: ${API_URL}/api/market-data/quotes`);
      console.log(`📊 Auth token available: ${token ? 'Yes' : 'No'}`);

      const response = await fetch(`${API_URL}/api/market-data/quotes?symbols=${symbolsParam}`, {
        method: 'GET',
        headers: {
          'Authorization': token,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`📊 Market data response status: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Market data API error: ${response.status} ${response.statusText}`);
        console.error(`❌ Error details: ${errorText}`);
        return results; // Return empty results
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        // Handle array format - this is what the server returns
        if (Array.isArray(data.data)) {
          data.data.forEach((quote: any) => {
            const marketData: LiveMarketData = {
              symbol: quote.symbol,
              ltp: quote.ltp || 0,
              open: quote.open || 0,
              high: quote.high || 0,
              low: quote.low || 0,
              close: quote.close || 0,
              volume: quote.volume || 0,
              change: quote.change || 0,
              changePercent: quote.changePercent || 0,
              timestamp: new Date() // Always use current time for fresh timestamps
            };
            results.set(quote.symbol, marketData);
          });
        } 
        // Handle object format (just in case)
        else if (typeof data.data === 'object') {
          // If the data is in object format with symbols as keys
          const quotes = data.data;
          for (const symbol in quotes) {
            if (quotes.hasOwnProperty(symbol)) {
              const quote = quotes[symbol];
              const marketData: LiveMarketData = {
                symbol: quote.symbol || symbol,
                ltp: quote.ltp || 0,
                open: quote.open || 0,
                high: quote.high || 0,
                low: quote.low || 0,
                close: quote.close || 0,
                volume: quote.volume || 0,
                change: quote.change || 0,
                changePercent: quote.changePercent || 0,
                timestamp: new Date() // Always use current time for fresh timestamps
              };
              results.set(symbol, marketData);
            }
          }
        } else {
          console.error('❌ Unexpected response data structure from market data API:', data);
        }
      } else {
        // If the response format is unexpected, log the error but don't throw
        console.error('❌ Unexpected response format from market data API:', data);
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