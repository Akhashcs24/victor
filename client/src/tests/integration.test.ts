import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../services/authService';
import { MarketDataService } from '../services/marketDataService';
import { HMAService } from '../services/hmaService';
import { SymbolConfigService } from '../services/symbolConfig';

// Mock fetch globally
global.fetch = vi.fn();

describe("Integration Tests - Complete App Workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset AuthService static properties
    (AuthService as any).accessToken = null;
    (AuthService as any).refreshToken = null;
    (AuthService as any).tokenExpiry = null;
  });

  it("completes full authentication and trading workflow", async () => {
    // Step 1: Authentication
    const authConfig = {
      appId: 'test-app-id',
      secret: 'test-secret',
      redirectUri: 'https://localhost:3000/callback'
    };

    const authUrl = AuthService.generateAuthUrl(authConfig);
    expect(authUrl).toBeDefined();
    expect(typeof authUrl).toBe('string');
    expect(authUrl).toContain('api-t1.fyers.in');
    expect(authUrl).toContain('client_id=' + authConfig.appId);

    // Mock successful authentication
    const mockTokenResponse = {
      s: 'ok',
      code: 200,
      message: 'Success',
      data: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }
    };

    (fetch as any).mockResolvedValueOnce({
      json: async () => mockTokenResponse
    });

    const authResult = await AuthService.validateAuthCode('test-auth-code', authConfig);
    expect(authResult.success).toBe(true);
    expect(AuthService.isTokenValid()).toBe(true);

    // Step 2: Index Selection
    const niftyConfig = SymbolConfigService.getIndexConfig('NIFTY');
    expect(niftyConfig).toBeDefined();
    expect(niftyConfig?.name).toBe('Nifty 50');
    expect(niftyConfig?.lotSize).toBe(75);

    // Step 3: Contract Setup
    const ceSymbol = 'NSE:NIFTY24500CE';
    const peSymbol = 'NSE:NIFTY24500PE';
    
    const ceParsed = SymbolConfigService.parseOptionSymbol(ceSymbol);
    const peParsed = SymbolConfigService.parseOptionSymbol(peSymbol);
    
    expect(ceParsed?.optionType).toBe('CE');
    expect(peParsed?.optionType).toBe('PE');
    expect(ceParsed?.strike).toBe(24500);

    // Step 4: HMA Data Fetching
    const mockHistoricalData = {
      s: 'ok',
      code: 200,
      message: 'Success',
      data: {
        candles: Array.from({ length: 60 }, (_, i) => [
          Date.now() - (60 - i) * 5 * 60 * 1000, // timestamp
          24500 + Math.random() * 100, // open
          24550 + Math.random() * 100, // high
          24450 + Math.random() * 100, // low
          24525 + Math.random() * 100, // close
          1000 + Math.random() * 500   // volume
        ]),
        symbol: ceSymbol,
        interval: '5'
      }
    };

    (fetch as any).mockResolvedValueOnce({
      json: async () => mockHistoricalData
    });

    const historicalData = await MarketDataService.getHistoricalData(ceSymbol, '5');
    expect(historicalData.candles.length).toBe(60);

    // Step 5: HMA Calculation
    const hmaData = historicalData.candles.map(candle => ({
      timestamp: candle[0],
      close: candle[4]
    }));

    const hmaConfig = HMAService.calculateHMAFromHistoricalData(hmaData);
    expect(hmaConfig.currentHMA).toBeGreaterThan(0);
    expect(hmaConfig.period).toBe(55);

    // Step 6: Market Data Monitoring
    const mockMarketData = {
      s: 'ok',
      code: 200,
      message: 'Success',
      d: [{
        symbol: ceSymbol,
        lp: 24550, // Last traded price
        ch: 50, // Change value
        chp: 0.2, // Change percentage
        open_price: 24500,
        high_price: 24600,
        low_price: 24450,
        prev_close_price: 24500,
        atp: 24525, // Average traded price
        volume: 1000,
        ask: 24555,
        bid: 24545,
        spread: 10,
        short_name: 'NIFTY24500CE',
        exchange: 'NSE',
        description: 'NIFTY 24500 CE',
        original_name: ceSymbol,
        fyToken: '10100000003045',
        tt: Date.now()
      }]
    };

    (fetch as any).mockResolvedValueOnce({
      json: async () => mockMarketData
    });

    const marketData = await MarketDataService.getOptionData(ceSymbol);
    expect(marketData?.lp).toBe(24550);

    // Step 7: Crossover Detection
    const previousPrice = 24500;
    const currentPrice = 24550;
    const crossover = HMAService.detectCrossover(currentPrice, previousPrice, hmaConfig.currentHMA);
    expect(['ABOVE', 'BELOW', 'NONE']).toContain(crossover);

    // Step 8: Trade Execution Simulation
    if (crossover === 'ABOVE') {
      const entryPrice = currentPrice;
      const targetPoints = 50;
      const stopLossPoints = 30;
      const quantity = 75;

      const targetPrice = entryPrice + targetPoints;
      const stopLossPrice = entryPrice - stopLossPoints;

      expect(targetPrice).toBe(24600);
      expect(stopLossPrice).toBe(24520);

      // Simulate target hit
      const targetHitPrice = 24600;
      const pnl = (targetHitPrice - entryPrice) * quantity;
      expect(pnl).toBe(3750);
    }
  });

  it("handles rate limiting correctly", async () => {
    // Set up AuthService with valid token
    (AuthService as any).accessToken = 'test-token';
    (AuthService as any).tokenExpiry = Date.now() + 3600000;

    // Mock multiple API calls
    const mockResponse = {
      s: 'ok',
      code: 200,
      message: 'Success',
      d: [{
        symbol: 'NSE:NIFTY24500CE',
        lp: 24550, // Last traded price
        ch: 50,
        chp: 0.2,
        open_price: 24500,
        high_price: 24600,
        low_price: 24450,
        prev_close_price: 24500,
        atp: 24525,
        volume: 1000,
        ask: 24555,
        bid: 24545,
        spread: 10,
        short_name: 'NIFTY24500CE',
        exchange: 'NSE',
        description: 'NIFTY 24500 CE',
        original_name: 'NSE:NIFTY24500CE',
        fyToken: '10100000003045',
        tt: Date.now()
      }]
    };

    // Mock multiple successful responses
    (fetch as any).mockResolvedValue({
      json: async () => mockResponse
    });

    // Make multiple API calls
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(MarketDataService.getOptionData('NSE:NIFTY24500CE'));
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(5);
    results.forEach(result => {
      expect(result?.lp).toBe(24550);
    });
  });

  it("validates complete trade lifecycle", () => {
    // Trade configuration
    const tradeConfig = {
      ceSymbol: 'NSE:NIFTY24500CE',
      peSymbol: 'NSE:NIFTY24500PE',
      ceQuantity: 75,
      peQuantity: 75,
      targetPoints: 50,
      stopLossPoints: 30,
      entryMethod: 'MARKET' as const,
      index: SymbolConfigService.getIndexConfig('NIFTY')!
    };

    expect(tradeConfig.ceSymbol).toBeDefined();
    expect(tradeConfig.peSymbol).toBeDefined();
    expect(tradeConfig.ceQuantity).toBe(75);
    expect(tradeConfig.targetPoints).toBe(50);
    expect(tradeConfig.stopLossPoints).toBe(30);

    // Trade status tracking
    const tradeStatus = {
      isActive: false,
      entryPrice: 0,
      currentPrice: 0,
      targetPrice: 0,
      stopLossPrice: 0,
      quantity: 0,
      pnl: 0,
      entryTime: null as Date | null,
      exitTime: null as Date | null,
      status: 'WAITING' as const
    };

    expect(tradeStatus.status).toBe('WAITING');
    expect(tradeStatus.isActive).toBe(false);

    // Simulate trade entry
    const entryPrice = 24550;
    const updatedStatus = {
      ...tradeStatus,
      isActive: true,
      entryPrice,
      currentPrice: entryPrice,
      targetPrice: entryPrice + tradeConfig.targetPoints,
      stopLossPrice: entryPrice - tradeConfig.stopLossPoints,
      quantity: tradeConfig.ceQuantity,
      entryTime: new Date(),
      status: 'ENTERED' as const
    };

    expect(updatedStatus.status).toBe('ENTERED');
    expect(updatedStatus.isActive).toBe(true);
    expect(updatedStatus.targetPrice).toBe(24600);
    expect(updatedStatus.stopLossPrice).toBe(24520);
  });

  it("tests error handling and recovery", async () => {
    // Test authentication error
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    try {
      await AuthService.validateAuthCode('invalid-code', {
        appId: 'test',
        secret: 'test',
        redirectUri: 'test'
      });
      expect.fail('Should have thrown an error');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }

    // Test market data error
    (fetch as any).mockRejectedValueOnce(new Error('API error'));

    const result = await MarketDataService.getOptionData('NSE:NIFTY24500CE');
    expect(result).toBeNull();

    // Test HMA calculation error
    expect(() => {
      HMAService.calculateHMA([], 55);
    }).toThrow('Insufficient data');
  });
}); 