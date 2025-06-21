// Authentication types
export interface AuthConfig {
  appId: string;
  secret: string;
  redirectUri: string;
}

export interface AuthToken {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface UserProfile {
  name?: string;
  email?: string;
  mobile?: string;
  pan?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  pin?: string;
  dob?: string;
  gender?: string;
  marital_status?: string;
  occupation?: string;
  annual_income?: string;
  bank_account?: string;
  bank_name?: string;
  bank_branch?: string;
  bank_ifsc?: string;
  [key: string]: any; // Allow additional properties from Fyers API
}

// Index configuration types
export interface IndexConfig {
  name: string;
  symbol: string;
  lotSize: number;
  tickSize: number;
  strikeInterval: number;
}

// Option contract types
export interface OptionContract {
  symbol: string;
  strike: number;
  expiry: string;
  type: 'CE' | 'PE';
  lotSize: number;
  tickSize: number;
}

// HMA data types
export interface HMAData {
  timestamp: number;
  close: number;
  hma: number;
}

export interface HMAConfig {
  period: number;
  data: HMAData[];
  currentHMA: number;
  lastUpdate: Date;
}

// New HMA service types
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

// Trade configuration types
export interface TradeConfig {
  ceSymbol: string;
  peSymbol: string;
  ceLots: number;
  peLots: number;
  targetPoints: number;
  stopLossPoints: number;
  entryMethod: 'MARKET' | 'LIMIT';
  index: IndexConfig;
}

export interface TradeStatus {
  isActive: boolean;
  entryPrice: number;
  currentPrice: number;
  targetPrice: number;
  stopLossPrice: number;
  quantity: number;
  pnl: number;
  entryTime: Date | null;
  exitTime: Date | null;
  status: 'WAITING' | 'ENTERED' | 'TARGET_HIT' | 'SL_HIT' | 'CLOSED';
}

// Market data types - Updated to match Fyers API response structure
export interface MarketData {
  symbol: string;
  lp: number; // Last traded price
  ch: number; // Change value
  chp: number; // Change percentage
  open_price: number;
  high_price: number;
  low_price: number;
  prev_close_price: number;
  atp: number; // Average traded price
  volume: number;
  ask: number;
  bid: number;
  spread: number;
  short_name: string;
  exchange: string;
  description: string;
  original_name: string;
  fyToken: string;
  tt: number; // Today's time
  timestamp?: Date; // Added for our internal use
}

// API response types - Updated to match Fyers API structure
export interface APIResponse<T> {
  s: string; // 'ok' or 'error'
  code: number;
  message: string;
  d?: T; // Fyers uses 'd' instead of 'data'
}

export interface HistoricalDataResponse {
  candles: number[][];
  symbol: string;
  interval: string;
}

// Market Depth types
export interface MarketDepth {
  symbol: string;
  totalbuyqty: number;
  totalsellqty: number;
  bids: Array<{
    price: number;
    volume: number;
    ord: number;
  }>;
  ask: Array<{
    price: number;
    volume: number;
    ord: number;
  }>;
  o: number; // Open
  h: number; // High
  l: number; // Low
  c: number; // Close
  chp: number; // Change percentage
  ch: number; // Change
  ltq: number; // Last traded quantity
  ltt: number; // Last traded time
  ltp: number; // Last traded price
  v: number; // Volume
  atp: number; // Average traded price
  lower_ckt: number; // Lower circuit
  upper_ckt: number; // Upper circuit
  expiry?: string;
  oi?: number; // Open interest
  oiflag?: boolean;
  pdoi?: number; // Previous day open interest
  oipercent?: number; // Open interest percentage change
}

// Market Status types
export interface MarketStatus {
  marketStatus: Array<{
    exchange: string;
    marketType: string;
    status: string;
    lastUpdatedTime: string;
  }>;
}

// Header status types
export interface HeaderStatus {
  authStatus: 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'EXPIRED';
  tokenValid: boolean;
  selectedIndex: string;
  monitoringStatus: 'ON' | 'OFF';
  tradeEngineStatus: 'RUNNING' | 'PAUSED' | 'STOPPED';
  apiHealth: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
  lastTradeTime: Date | null;
  profileName?: string; // Add profile name from Fyers
}

// Trade log types
export interface TradeLog {
  id: string;
  timestamp: Date;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT';
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  pnl?: number | null;
  remarks?: string;
  tradingMode: 'PAPER' | 'LIVE'; // Track if trade was executed on Paper or Live
}

// Trading Dashboard Types
export interface ContractInputs {
  ceSymbol: string;
  peSymbol: string;
  ceLots: number;
  peLots: number;
  targetPoints: number;
  stopLossPoints: number;
  entryMethod: 'MARKET' | 'LIMIT';
}

export interface StrategyMonitor {
  symbol: string;
  hmaValue: number | null;
  currentLTP: number | null;
  entryPrice: number | null;
  triggerStatus: 'WAITING' | 'ENTERED' | 'EXITED';
  lastUpdate: Date | null;
  pnl?: number | null;
  crossoverSignalTime?: Date | null; // Time when price first crossed over HMA
}

export interface TradeLogEntry {
  id: string;
  timestamp: Date;
  symbol: string;
  action: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  orderType: 'MARKET' | 'LIMIT';
  pnl: number | null;
  status: 'PENDING' | 'COMPLETED' | 'REJECTED';
  remarks?: string;
  tradingMode: 'PAPER' | 'LIVE'; // Track if trade was executed on Paper or Live
}

export interface MonitorEntry {
  id: string;
  symbol: string;
  type: 'CE' | 'PE';
  currentLTP: number | null;
  hmaValue: number | null;
  triggerStatus: 'WAITING' | 'ENTERED' | 'EXITED';
  entryPrice: number | null;
  lastUpdate: Date | null;
  crossoverSignalTime: Date | null;
  lots: number;
  targetPoints: number;
  stopLossPoints: number;
  entryMethod: 'MARKET' | 'LIMIT';
  addedAt: Date;
}

export interface MonitorState {
  symbol: string;
  hmaValue: number | null;
  currentLTP: number | null;
  entryPrice: number | null;
  triggerStatus: 'WAITING' | 'ENTERED' | 'EXITED';
  lastUpdate: Date | null;
  pnl?: number | null;
  crossoverSignalTime?: Date | null; // Time when price first crossed over HMA
}

export interface TradingState {
  contractInputs: ContractInputs;
  ceMonitor: MonitorState;
  peMonitor: MonitorState;
  tradeLogs: TradeLogEntry[];
  tradingMode: 'PAPER' | 'LIVE';
  selectedIndex: string;
  // New: Multi-symbol monitoring
  monitoredSymbols: MonitorEntry[];
} 