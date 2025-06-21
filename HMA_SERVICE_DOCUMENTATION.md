# HMA Service Documentation

## Overview

The new HMA (Hull Moving Average) service has been completely rewritten from scratch to provide robust, market-aware HMA-55 calculations for option trading strategies. This service implements the exact Pine Script logic from TradingView and includes advanced features like live monitoring, intelligent caching, and market hours awareness.

## 🎯 Key Features

### 1. **Dual Symbol Support**
- Accepts both CE and PE option symbols simultaneously
- Calculates HMA for both symbols in parallel
- Returns structured results for easy UI integration

### 2. **Market-Aware Data Fetching**
- **Trading Hours Filtering**: Only fetches candles between 9:15 AM - 3:30 PM IST
- **Rolling Window**: Collects exactly 300 market minutes (60 x 5-min candles)
- **Intelligent Date Range**: Automatically determines date range based on current time context
- **Weekend Handling**: Skips weekends when fetching historical data

### 3. **Advanced Caching System**
- **Per-Symbol Cache**: Each symbol maintains its own cache
- **Time-Based Validation**: Cache expires after 5 minutes
- **Symbol Change Detection**: Automatically clears cache when symbols change
- **Memory Management**: Efficient storage with automatic cleanup

### 4. **Live Monitoring Mode**
- **Automatic Activation**: Starts monitoring when within market hours
- **5-Minute Updates**: Fetches new candles every 5 minutes
- **Real-Time HMA**: Recalculates HMA with each new candle
- **Smart Deduplication**: Prevents duplicate candle processing

### 5. **Pine Script Compliance**
- **Exact Implementation**: Follows Pine Script HMA formula precisely
- **WMA Calculations**: Proper weighted moving average implementation
- **Period Handling**: Supports HMA-55 with configurable periods

## 📊 API Reference

### Main Methods

#### `fetchHMAForSymbols(ceSymbol, peSymbol)`
```typescript
static async fetchHMAForSymbols(
  ceSymbol: string, 
  peSymbol: string
): Promise<{
  ce: HMAConfig;
  pe: HMAConfig;
}>
```

**Purpose**: Main entry point for fetching HMA for both CE and PE symbols.

**Parameters**:
- `ceSymbol`: Fyers-compatible CE option symbol (e.g., `NSE:NIFTY24500CE`)
- `peSymbol`: Fyers-compatible PE option symbol (e.g., `NSE:NIFTY24500PE`)

**Returns**: Object containing HMA configurations for both symbols.

**Example**:
```typescript
const hmaResults = await HMAService.fetchHMAForSymbols(
  'NSE:NIFTY24500CE',
  'NSE:NIFTY24500PE'
);
console.log(`CE HMA: ${hmaResults.ce.currentHMA}`);
console.log(`PE HMA: ${hmaResults.pe.currentHMA}`);
```

#### `fetchAndCalculateHMA(symbol)`
```typescript
static async fetchAndCalculateHMA(symbol: string): Promise<HMAConfig>
```

**Purpose**: Fetch and calculate HMA for a single symbol.

**Parameters**:
- `symbol`: Fyers-compatible option symbol

**Returns**: HMA configuration object.

### Utility Methods

#### `detectCrossover(currentPrice, previousPrice, hmaValue)`
```typescript
static detectCrossover(
  currentPrice: number, 
  previousPrice: number, 
  hmaValue: number
): 'ABOVE' | 'BELOW' | 'NONE'
```

**Purpose**: Detect if price has crossed above or below HMA.

#### `isPriceAboveHMA(price, hmaValue)`
```typescript
static isPriceAboveHMA(price: number, hmaValue: number): boolean
```

**Purpose**: Check if current price is above HMA value.

#### `getHMATrend(hmaConfig)`
```typescript
static getHMATrend(hmaConfig: HMAConfig): 'BULLISH' | 'BEARISH' | 'NEUTRAL'
```

**Purpose**: Determine HMA trend direction.

#### `validateHMAData(hmaConfig)`
```typescript
static validateHMAData(hmaConfig: HMAConfig): boolean
```

**Purpose**: Validate HMA data quality and completeness.

### Cache Management

#### `getCacheStats()`
```typescript
static getCacheStats(): {
  symbol: string;
  candleCount: number;
  lastUpdate: Date;
  isLiveMonitoring: boolean;
}[]
```

**Purpose**: Get statistics for all cached symbols.

#### `clearCache(symbol)`
```typescript
static clearCache(symbol: string): void
```

**Purpose**: Clear cache for a specific symbol.

#### `clearAllCache()`
```typescript
static clearAllCache(): void
```

**Purpose**: Clear all cached data.

## 🔧 Configuration

### Trading Hours
```typescript
private static readonly TRADING_START_HOUR = 9;
private static readonly TRADING_START_MINUTE = 15;
private static readonly TRADING_END_HOUR = 15;
private static readonly TRADING_END_MINUTE = 30;
```

### HMA Parameters
```typescript
private static readonly HMA_PERIOD = 55;
private static readonly REQUIRED_CANDLES = 60; // 300 market minutes
```

### Cache Settings
```typescript
// Cache expires after 5 minutes
const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
```

## 📈 Data Flow

### 1. **Initial Request**
```
User selects CE & PE symbols → fetchHMAForSymbols() → Parallel API calls
```

### 2. **Cache Check**
```
Check cache for each symbol → If valid, return cached HMA → If expired, fetch fresh data
```

### 3. **Data Fetching**
```
Determine date range → Fetch historical data → Filter trading hours → Collect 60 candles
```

### 4. **HMA Calculation**
```
Convert to Candle objects → Calculate HMA for each point → Return latest HMA value
```

### 5. **Live Monitoring**
```
If within market hours → Start 5-minute timer → Fetch new candles → Update HMA → Repeat
```

## 🛡️ Error Handling

### Common Error Messages

1. **Insufficient Data**:
   ```
   "Not enough trading data available to calculate HMA(55) for {symbol}. Found {count} candles, need 60"
   ```

2. **API Errors**:
   ```
   "Unable to fetch historical candles for {symbol}. Please check if it's active or try a different strike."
   ```

3. **Invalid Symbols**:
   ```
   "Invalid option symbol format. Expected format: NSE:NIFTY24500CE"
   ```

### Error Recovery

- **Automatic Retry**: Failed API calls are retried up to 5 times
- **Graceful Degradation**: Returns cached data if available during errors
- **User Feedback**: Clear error messages for troubleshooting

## 📝 Logging

The service provides comprehensive logging for debugging and monitoring:

### Info Logs
```
🎯 Fetching HMA for CE: NSE:NIFTY24500CE, PE: NSE:NIFTY24500PE
📊 Fetching candles for NSE:NIFTY24500CE on 2024-01-15, attempt 1
📊 Found 45 trading hours candles for 2024-01-15
✅ Calculated HMA(55): 24578.79 for NSE:NIFTY24500CE
🔄 Starting live monitoring for NSE:NIFTY24500CE
```

### Error Logs
```
❌ Error fetching candles for 2024-01-15: Network timeout
❌ Error calculating HMA for NSE:NIFTY24500CE: Insufficient data
```

### Cache Logs
```
📊 Using cached candles for NSE:NIFTY24500CE: 60 candles
✅ Added new candle to HMA cache for NSE:NIFTY24500CE
🗑️ Cleared cache for NSE:NIFTY24500CE
```

## 🔄 Live Monitoring

### Activation Conditions
- Current time is between 9:15 AM - 3:30 PM IST
- Symbol has valid cached data
- User hasn't manually stopped monitoring

### Update Process
1. **Timer Trigger**: Every 5 minutes
2. **Data Fetch**: Get latest candles for current day
3. **Deduplication**: Check if candle already exists in cache
4. **Update**: Add new candle, remove oldest
5. **Recalculation**: Update HMA with new data
6. **Logging**: Record update in console

### Deactivation
- User changes symbols
- App is unmounted
- Monitoring is manually stopped
- Market hours end

## 🧪 Testing

### Unit Tests
Run the HMA calculation test:
```bash
node test-hma-calculation.js
```

### Integration Tests
The service integrates with:
- `MarketDataService`: For historical data fetching
- `AuthService`: For API authentication
- UI Components: For real-time display

## 🚀 Performance Optimizations

### Memory Management
- **Efficient Caching**: Only stores necessary candle data
- **Automatic Cleanup**: Removes old cache entries
- **Symbol Isolation**: Each symbol maintains separate cache

### API Efficiency
- **Rate Limiting**: Respects Fyers API limits
- **Parallel Requests**: Fetches CE and PE data simultaneously
- **Smart Caching**: Reduces redundant API calls

### Calculation Optimization
- **Incremental Updates**: Only recalculates when new data arrives
- **Efficient Algorithms**: Optimized WMA and HMA calculations
- **Minimal Memory**: Processes data in streaming fashion

## 🔮 Future Enhancements

### Planned Features
1. **Multi-Timeframe Support**: HMA calculations for different intervals
2. **Advanced Caching**: Redis-based distributed caching
3. **WebSocket Integration**: Real-time price updates
4. **Backtesting Mode**: Historical strategy testing
5. **Performance Metrics**: HMA accuracy and latency tracking

### Configuration Options
1. **Custom Periods**: Configurable HMA periods beyond 55
2. **Time Zone Support**: Multiple market time zones
3. **Data Sources**: Support for multiple data providers
4. **Alert System**: Price crossover notifications

## 📚 References

### Pine Script Implementation
```pinescript
//@version=6
indicator(title="Hull Moving Average", shorttitle="HMA", overlay=true, timeframe="", timeframe_gaps=true)
length = input.int(9, "Length", minval = 2)
src    = input(close, "Source")
hullma = ta.wma(2*ta.wma(src, length/2)-ta.wma(src, length), math.floor(math.sqrt(length)))
plot(hullma, "HMA")
```

### Mathematical Formula
```
HMA = WMA(2 * WMA(period/2) - WMA(period), sqrt(period))
```

Where:
- `WMA` = Weighted Moving Average
- `period` = 55 (for HMA-55)
- `sqrt(period)` = 7 (for HMA-55)

This implementation ensures 100% compatibility with TradingView's Pine Script HMA indicator. 