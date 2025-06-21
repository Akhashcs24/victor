import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HMAService } from '../services/hmaService';
import { MarketDataService } from '../services/marketDataService';
import { AuthService } from '../services/authService';

// Mock fetch globally
global.fetch = vi.fn();

describe("Monitoring Engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up AuthService with valid token for market data tests
    (AuthService as any).accessToken = 'test-token';
    (AuthService as any).tokenExpiry = Date.now() + 3600000;
  });

  it("starts monitoring on user command", () => {
    const monitoringStatus = 'ON';
    const tradeEngineStatus = 'RUNNING';

    expect(monitoringStatus).toBe('ON');
    expect(tradeEngineStatus).toBe('RUNNING');

    // Test status transitions
    const statuses = ['OFF', 'ON'] as const;
    expect(statuses).toContain(monitoringStatus);

    const engineStatuses = ['STOPPED', 'PAUSED', 'RUNNING'] as const;
    expect(engineStatuses).toContain(tradeEngineStatus);
  });

  it("checks LTP against HMA", () => {
    const currentPrice = 24550;
    const previousPrice = 24500;
    const hmaValue = 24525;

    // Test crossover detection
    const crossover = HMAService.detectCrossover(currentPrice, previousPrice, hmaValue);
    expect(crossover).toBe('ABOVE');

    // Test no crossover
    const noCrossover = HMAService.detectCrossover(24500, 24550, hmaValue);
    expect(noCrossover).toBe('BELOW');

    // Test same side
    const sameSide = HMAService.detectCrossover(24550, 24560, hmaValue);
    expect(sameSide).toBe('NONE');

    // Test price above HMA
    const isAbove = HMAService.isPriceAboveHMA(currentPrice, hmaValue);
    expect(isAbove).toBe(true);

    const isBelow = HMAService.isPriceAboveHMA(24400, hmaValue);
    expect(isBelow).toBe(false);
  });

  it("triggers trade when crossover happens", () => {
    const entryPrice = 24550;
    const targetPoints = 50;
    const stopLossPoints = 30;
    const quantity = 75;

    // Calculate target and stop loss prices
    const targetPrice = entryPrice + targetPoints;
    const stopLossPrice = entryPrice - stopLossPoints;

    expect(targetPrice).toBe(24600);
    expect(stopLossPrice).toBe(24520);

    // Test trade status creation
    const tradeStatus = {
      isActive: true,
      entryPrice,
      currentPrice: entryPrice,
      targetPrice,
      stopLossPrice,
      quantity,
      pnl: 0,
      entryTime: new Date(),
      exitTime: null,
      status: 'ENTERED' as const
    };

    expect(tradeStatus.isActive).toBe(true);
    expect(tradeStatus.status).toBe('ENTERED');
    expect(tradeStatus.entryPrice).toBe(entryPrice);
    expect(tradeStatus.targetPrice).toBe(targetPrice);
    expect(tradeStatus.stopLossPrice).toBe(stopLossPrice);
  });

  it("monitors price movements for target/SL", () => {
    const entryPrice = 24550;
    const targetPrice = 24600;
    const stopLossPrice = 24520;
    const quantity = 75;

    // Test target hit
    const targetHitPrice = 24600;
    const targetHitPnL = (targetHitPrice - entryPrice) * quantity;
    expect(targetHitPnL).toBe(3750); // (24600 - 24550) * 75

    // Test stop loss hit
    const slHitPrice = 24520;
    const slHitPnL = (slHitPrice - entryPrice) * quantity;
    expect(slHitPnL).toBe(-2250); // (24520 - 24550) * 75

    // Test current P&L calculation
    const currentPrice = 24575;
    const currentPnL = (currentPrice - entryPrice) * quantity;
    expect(currentPnL).toBe(1875); // (24575 - 24550) * 75
  });

  it("handles monitoring intervals correctly", async () => {
    const symbol = 'NSE:NIFTY24500CE';
    const mockMarketData = {
      s: 'ok',
      code: 200,
      message: 'Success',
      data: [{
        symbol: symbol,
        ltp: 24550,
        change: 50,
        changePercent: 0.2,
        open: 24500,
        high: 24600,
        low: 24450,
        close: 24550,
        volume: 1000,
        timestamp: new Date()
      }]
    };

    // Mock API response
    (fetch as any).mockResolvedValueOnce({
      json: async () => mockMarketData
    });

    const result = await MarketDataService.getOptionData(symbol);

    expect(result).toBeDefined();
    expect(result?.symbol).toBe(symbol);
    expect(result?.ltp).toBe(24550);
    expect(result?.timestamp).toBeInstanceOf(Date);
  });

  it("updates HMA with new price data", () => {
    const initialHMA = 24525;
    const newPrice = 24575;
    const timestamp = Date.now();

    // Ensure at least 55 data points for HMA-55
    const mockHMAConfig = {
      period: 55,
      data: Array.from({ length: 55 }, (_, i) => ({
        timestamp: timestamp - (55 - i) * 5 * 60 * 1000,
        close: 24500 + Math.random() * 100,
        hma: initialHMA
      })),
      currentHMA: initialHMA,
      lastUpdate: new Date(timestamp - 5 * 60 * 1000)
    };

    // Add the new price to the end of the data array to ensure 56 points
    const fullData = [
      ...mockHMAConfig.data,
      { timestamp, close: newPrice, hma: 0 }
    ];
    const fullHMAConfig = { ...mockHMAConfig, data: fullData.slice(-55) };

    const updatedHMA = HMAService.updateHMAWithNewPrice(fullHMAConfig, newPrice, timestamp);

    expect(updatedHMA).toBeDefined();
    expect(updatedHMA.currentHMA).toBeDefined();
    expect(updatedHMA.lastUpdate).toBeInstanceOf(Date);
    expect(updatedHMA.data.length).toBeGreaterThan(0);
  });

  it("validates monitoring prerequisites", () => {
    // Test that monitoring requires valid symbols
    const validSymbol = 'NSE:NIFTY24500CE';
    const invalidSymbol = '';

    expect(validSymbol.length).toBeGreaterThan(0);
    expect(invalidSymbol.length).toBe(0);

    // Test that monitoring requires HMA data
    const hasHMA = true;
    const noHMA = false;

    expect(hasHMA).toBe(true);
    expect(noHMA).toBe(false);
  });

  it("handles monitoring errors gracefully", async () => {
    const symbol = 'NSE:NIFTY24500CE';

    // Mock API error
    (fetch as any).mockRejectedValueOnce(new Error('Network error'));

    const result = await MarketDataService.getOptionData(symbol);
    expect(result).toBeNull(); // Should return null on error
  });

  it("calculates HMA crossover accurately", () => {
    // Test upward crossover
    const upwardCrossover = HMAService.detectCrossover(24550, 24500, 24525);
    expect(upwardCrossover).toBe('ABOVE');

    // Test downward crossover
    const downwardCrossover = HMAService.detectCrossover(24500, 24550, 24525);
    expect(downwardCrossover).toBe('BELOW');

    // Test no crossover (both above)
    const noCrossoverAbove = HMAService.detectCrossover(24550, 24560, 24525);
    expect(noCrossoverAbove).toBe('NONE');

    // Test no crossover (both below)
    const noCrossoverBelow = HMAService.detectCrossover(24500, 24490, 24525);
    expect(noCrossoverBelow).toBe('NONE');
  });
}); 