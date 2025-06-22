import { getAccessToken, getAppId } from './authService';

// Get API URL from environment or use default
const API_URL = (import.meta as any).env.VITE_API_URL || 'http://localhost:5000';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class MarketDataService {
  static async getHistoricalData(
    symbol: string,
    resolution: string,
    rangeFrom?: string,
    rangeTo?: string
  ): Promise<CandleData[]> {
    try {
      const accessToken = getAccessToken();
      const appId = getAppId();
      
      if (!accessToken) {
        throw new Error('No access token found');
      }
      
      // Format the token correctly as appId:token
      const formattedToken = appId && accessToken ? `${appId}:${accessToken}` : accessToken;
      
      const params = new URLSearchParams({
        symbol,
        resolution,
      });

      if (rangeFrom) params.append('from', rangeFrom);
      if (rangeTo) params.append('to', rangeTo);

      console.log(`📊 Fetching historical data for ${symbol} with resolution ${resolution}`);
      
      const response = await fetch(`${API_URL}/api/market-data/historical?${params.toString()}`, {
        headers: {
          'Authorization': formattedToken
        }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch historical data');
      }
      
      if (data.success && data.candles) {
        return data.candles.map((c: any) => ({
          timestamp: c[0],
          open: c[1],
          high: c[2],
          low: c[3],
          close: c[4],
          volume: c[5],
        }));
      } else if (data.status === 'no_data') {
        return [];
      } else {
        throw new Error(data.message || 'Failed to fetch historical data');
      }
    } catch (error) {
      console.error(`Error fetching historical data for ${symbol}:`, error);
      throw error;
    }
  }
}

export interface HistoricalDataResponse {
  symbol: string;
  interval: string;
  candles: any[];
} 