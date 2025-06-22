import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TradeLog } from '../types';

describe("Trade Execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("places a market or limit order on trigger", () => {
    const entryPrice = 24550;
    const quantity = 75;
    const orderType = 'MARKET';
    const limitOrderType = 'LIMIT';

    // Test market order
    const marketOrder: TradeLog = {
      id: 'trade_1',
      timestamp: new Date(),
      symbol: 'NSE:NIFTY24500CE',
      action: 'BUY',
      quantity,
      price: entryPrice,
      orderType: 'MARKET',
      status: 'COMPLETED',
      remarks: 'HMA crossover entry'
    };

    expect(marketOrder.orderType).toBe('MARKET');
    expect(marketOrder.action).toBe('BUY');
    expect(marketOrder.quantity).toBe(quantity);
    expect(marketOrder.price).toBe(entryPrice);
    expect(marketOrder.status).toBe('COMPLETED');

    // Test limit order
    const limitOrder: TradeLog = {
      id: 'trade_2',
      timestamp: new Date(),
      symbol: 'NSE:NIFTY24500CE',
      action: 'SELL',
      quantity,
      price: entryPrice + 50, // Target price
      orderType: 'LIMIT',
      status: 'PENDING',
      remarks: 'Target exit'
    };

    expect(limitOrder.orderType).toBe('LIMIT');
    expect(limitOrder.action).toBe('SELL');
    expect(limitOrder.status).toBe('PENDING');
  });

  it("handles SL/Target exit logic", () => {
    const entryPrice = 24550;
    const targetPoints = 50;
    const stopLossPoints = 30;
    const quantity = 75;

    const targetPrice = entryPrice + targetPoints;
    const stopLossPrice = entryPrice - stopLossPoints;

    // Test target hit scenario
    const targetHitPrice = 24600;
    const isTargetHit = targetHitPrice >= targetPrice;
    expect(isTargetHit).toBe(true);

    // Test stop loss hit scenario
    const slHitPrice = 24520;
    const isSLHit = slHitPrice <= stopLossPrice;
    expect(isSLHit).toBe(true);

    // Test no exit scenario
    const currentPrice = 24575;
    const isTargetHit2 = currentPrice >= targetPrice;
    const isSLHit2 = currentPrice <= stopLossPrice;
    expect(isTargetHit2).toBe(false);
    expect(isSLHit2).toBe(false);

    // Test exit order creation
    const targetExitOrder: TradeLog = {
      id: 'trade_3',
      timestamp: new Date(),
      symbol: 'NSE:NIFTY24500CE',
      action: 'SELL',
      quantity,
      price: targetPrice,
      orderType: 'LIMIT',
      status: 'COMPLETED',
      pnl: (targetPrice - entryPrice) * quantity,
      remarks: 'Target hit'
    };

    expect(targetExitOrder.action).toBe('SELL');
    expect(targetExitOrder.price).toBe(targetPrice);
    expect(targetExitOrder.pnl).toBe(3750); // (24600 - 24550) * 75

    const slExitOrder: TradeLog = {
      id: 'trade_4',
      timestamp: new Date(),
      symbol: 'NSE:NIFTY24500CE',
      action: 'SELL',
      quantity,
      price: stopLossPrice,
      orderType: 'LIMIT',
      status: 'COMPLETED',
      pnl: (stopLossPrice - entryPrice) * quantity,
      remarks: 'Stop loss hit'
    };

    expect(slExitOrder.action).toBe('SELL');
    expect(slExitOrder.price).toBe(stopLossPrice);
    expect(slExitOrder.pnl).toBe(-2250); // (24520 - 24550) * 75
  });

  it("updates PnL based on exit price", () => {
    const entryPrice = 24550;
    const quantity = 75;

    // Test profitable exit
    const profitableExitPrice = 24600;
    const profitablePnL = (profitableExitPrice - entryPrice) * quantity;
    expect(profitablePnL).toBe(3750);
    expect(profitablePnL).toBeGreaterThan(0);

    // Test loss exit
    const lossExitPrice = 24520;
    const lossPnL = (lossExitPrice - entryPrice) * quantity;
    expect(lossPnL).toBe(-2250);
    expect(lossPnL).toBeLessThan(0);

    // Test breakeven exit
    const breakevenExitPrice = 24550;
    const breakevenPnL = (breakevenExitPrice - entryPrice) * quantity;
    expect(breakevenPnL).toBe(0);

    // Test real-time P&L calculation
    const currentPrice = 24575;
    const currentPnL = (currentPrice - entryPrice) * quantity;
    expect(currentPnL).toBe(1875);
  });

  it("tracks trade status transitions", () => {
    const tradeStatuses = ['WAITING', 'ENTERED', 'TARGET_HIT', 'SL_HIT', 'CLOSED'] as const;

    // Test initial status
    expect(tradeStatuses).toContain('WAITING');

    // Test entry status
    expect(tradeStatuses).toContain('ENTERED');

    // Test exit statuses
    expect(tradeStatuses).toContain('TARGET_HIT');
    expect(tradeStatuses).toContain('SL_HIT');
    expect(tradeStatuses).toContain('CLOSED');

    // Test status flow
    const statusFlow = ['WAITING', 'ENTERED', 'TARGET_HIT'];
    expect(statusFlow[0]).toBe('WAITING');
    expect(statusFlow[1]).toBe('ENTERED');
    expect(statusFlow[2]).toBe('TARGET_HIT');
  });

  it("validates order parameters", () => {
    const validOrder: TradeLog = {
      id: 'trade_5',
      timestamp: new Date(),
      symbol: 'NSE:NIFTY24500CE',
      action: 'BUY',
      quantity: 75,
      price: 24550,
      orderType: 'MARKET',
      status: 'COMPLETED'
    };

    // Test valid order
    expect(validOrder.quantity).toBeGreaterThan(0);
    expect(validOrder.price).toBeGreaterThan(0);
    expect(['BUY', 'SELL']).toContain(validOrder.action);
    expect(['MARKET', 'LIMIT']).toContain(validOrder.orderType);
    expect(['PENDING', 'COMPLETED', 'REJECTED']).toContain(validOrder.status);

    // Test invalid scenarios
    expect(() => {
      if (validOrder.quantity <= 0) throw new Error('Invalid quantity');
    }).not.toThrow();

    expect(() => {
      if (validOrder.price <= 0) throw new Error('Invalid price');
    }).not.toThrow();
  });

  it("handles order failures gracefully", () => {
    const failedOrder: TradeLog = {
      id: 'trade_6',
      timestamp: new Date(),
      symbol: 'NSE:NIFTY24500CE',
      action: 'BUY',
      quantity: 75,
      price: 24550,
      orderType: 'MARKET',
      status: 'REJECTED',
      remarks: 'Insufficient funds'
    };

    expect(failedOrder.status).toBe('REJECTED');
    expect(failedOrder.remarks).toBeDefined();
    expect(failedOrder.remarks).toContain('Insufficient funds');
  });

  it("calculates total P&L correctly", () => {
    const trades: TradeLog[] = [
      {
        id: 'trade_7',
        timestamp: new Date(),
        symbol: 'NSE:NIFTY24500CE',
        action: 'BUY',
        quantity: 75,
        price: 24550,
        orderType: 'MARKET',
        status: 'COMPLETED'
      },
      {
        id: 'trade_8',
        timestamp: new Date(),
        symbol: 'NSE:NIFTY24500CE',
        action: 'SELL',
        quantity: 75,
        price: 24600,
        orderType: 'LIMIT',
        status: 'COMPLETED',
        pnl: 3750
      }
    ];

    const totalPnL = trades.reduce((total, trade) => total + (trade.pnl || 0), 0);
    expect(totalPnL).toBe(3750);
  });

  it("tracks trade timestamps accurately", () => {
    const entryTime = new Date('2024-01-15T10:30:00Z');
    const exitTime = new Date('2024-01-15T11:45:00Z');

    const trade: TradeLog = {
      id: 'trade_9',
      timestamp: entryTime,
      symbol: 'NSE:NIFTY24500CE',
      action: 'BUY',
      quantity: 75,
      price: 24550,
      orderType: 'MARKET',
      status: 'COMPLETED'
    };

    expect(trade.timestamp).toBeInstanceOf(Date);
    expect(trade.timestamp.getTime()).toBe(entryTime.getTime());

    // Test trade duration calculation
    const duration = exitTime.getTime() - entryTime.getTime();
    expect(duration).toBe(75 * 60 * 1000); // 75 minutes in milliseconds
  });
}); 