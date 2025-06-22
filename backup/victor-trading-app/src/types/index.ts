// Authentication types
export interface AuthCredentials {
  appId: string;
  secretKey: string;
  redirectUri: string;
}

export interface AuthStatus {
  isAuthenticated: boolean;
  accessToken?: string;
  isValid: boolean;
  lastChecked?: Date;
}

// Index types
export type IndexType = 'NIFTY' | 'BANKNIFTY' | 'SENSEX';

export interface IndexConfig {
  key: IndexType;
  name: string;
  index: string;
  futures: string;
  strikeInterval: number;
  expiryType: 'weekly' | 'monthly';
  lotSize: number;
}

// Option contract types
export interface OptionContract {
  symbol: string;
  type: 'CE' | 'PE';
  strike: number;
  expiry: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  openInterest: number;
}

// HMA calculation types
export interface HMAData {
  timestamp: Date;
  close: number;
  hma55: number;
}

// Trading strategy types
export interface TradeConfig {
  ceSymbol: string;
  peSymbol: string;
  ceLots: number;
  peLots: number;
  targetPoints: number;
  stopLossPoints: number;
  entryMethod: 'MARKET' | 'LIMIT';
}

export interface TradeStatus {
  isMonitoring: boolean;
  isEngineRunning: boolean;
  lastTradeTime?: Date;
  currentPosition?: {
    ceEntry?: number;
    peEntry?: number;
    entryTime?: Date;
  };
}

// Market data types
export interface MarketData {
  index: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
  };
  futures: {
    price: number;
    change: number;
    changePercent: number;
    openInterest: number;
  };
  lastUpdated: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Header status types
export interface HeaderStatus {
  authStatus: AuthStatus;
  selectedIndex: IndexType;
  isMonitoring: boolean;
  isOpenPriceLocked: boolean;
  tradeEngineStatus: 'RUNNING' | 'PAUSED' | 'STOPPED';
  apiHealth: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  lastTradeTime?: Date;
}

// Trade log types
export interface TradeLog {
  id: string;
  timestamp: Date;
  symbol: string;
  action: 'ENTRY' | 'EXIT';
  price: number;
  quantity: number;
  pnl?: number;
  exitReason?: 'TARGET' | 'STOP_LOSS' | 'MANUAL';
} 