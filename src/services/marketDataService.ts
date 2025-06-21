import { AuthService } from './authService';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MarketDataService {
  private static readonly BASE_URL = '/api/market';
  private static readonly RETRY_LIMIT = 3;
  private static readonly RETRY_DELAY = 1000; // ms

  static async getHistoricalData(
    symbol: string,
    resolution: string,
    rangeFrom?: string,
    rangeTo?: string
  ): Promise<CandleData[]> {
    try {
      const params = new URLSearchParams({
        symbol,
        resolution,
        date_format: '1',
        cont_flag: '1',
      });

      if (rangeFrom) params.append('range_from', rangeFrom);
      if (rangeTo) params.append('range_to', rangeTo);

      const response = await this.makeApiCall(`/history?${params.toString()}`);
      
      if (response.s === 'ok' && response.candles) {
        return response.candles.map((c: any) => ({
          timestamp: c[0],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5],
        }));
      } else if (response.s === 'no_data') {
        return [];
      } else {
        throw new Error(response.message || 'Failed to fetch historical data');
      }
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      throw error;
    }
  }

  private static rateLimit = {
    requests: 0,
    timestamp: Date.now(),
  };

  private static checkRateLimit(): boolean {
    const now = Date.now();
    if (now - this.rateLimit.timestamp > 1000) {
      this.rateLimit.timestamp = now;
      this.rateLimit.requests = 0;
    }
    this.rateLimit.requests++;
    return this.rateLimit.requests <= 10;
  }
  
  private static async makeApiCall(
    endpoint: string,
    method: 'GET' | 'POST' = 'GET',
    body?: any
  ): Promise<any> {
    if (!this.checkRateLimit()) {
      throw new Error('API rate limit exceeded');
    }

    const accessToken = AuthService.getAccessToken();
    const appId = AuthService.getAppId();

    if (!accessToken || !appId) {
      throw new Error('No access token or app ID available');
    }

    const headers: Record<string, string> = {
      'Authorization': `${appId}:${accessToken}`,
      'Content-Type': 'application/json'
    };

    const config: RequestInit = {
      method,
      headers
    };

    if (body && method === 'POST') {
      config.body = JSON.stringify(body);
    }

    const response = await fetch(`${this.BASE_URL}${endpoint}`, config);
    const data = await response.json();
    
    // The actual data is nested under the 'd' property for most successful responses
    return data.d || data;
  }
}

export interface HistoricalDataResponse {
  symbol: string;
  interval: string;
  candles: any[];
} 