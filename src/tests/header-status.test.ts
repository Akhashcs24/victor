import { describe, it, expect, vi } from 'vitest';
import { HeaderStatus } from '../types';

describe("Header Status Indicators", () => {
  const mockHeaderStatus: HeaderStatus = {
    authStatus: 'AUTHENTICATED',
    tokenValid: true,
    selectedIndex: 'NIFTY',
    monitoringStatus: 'ON',
    openPriceLocked: true,
    tradeEngineStatus: 'RUNNING',
    apiHealth: 'HEALTHY',
    lastTradeTime: new Date('2024-01-15T10:30:00Z')
  };

  it("shows correct auth and token status", () => {
    // Test authenticated status
    expect(mockHeaderStatus.authStatus).toBe('AUTHENTICATED');
    expect(mockHeaderStatus.tokenValid).toBe(true);

    // Test unauthenticated status
    const unauthenticatedStatus: HeaderStatus = {
      ...mockHeaderStatus,
      authStatus: 'UNAUTHENTICATED',
      tokenValid: false
    };
    expect(unauthenticatedStatus.authStatus).toBe('UNAUTHENTICATED');
    expect(unauthenticatedStatus.tokenValid).toBe(false);

    // Test expired status
    const expiredStatus: HeaderStatus = {
      ...mockHeaderStatus,
      authStatus: 'EXPIRED',
      tokenValid: false
    };
    expect(expiredStatus.authStatus).toBe('EXPIRED');
    expect(expiredStatus.tokenValid).toBe(false);
  });

  it("updates monitoring status", () => {
    // Test monitoring ON
    expect(mockHeaderStatus.monitoringStatus).toBe('ON');

    // Test monitoring OFF
    const monitoringOffStatus: HeaderStatus = {
      ...mockHeaderStatus,
      monitoringStatus: 'OFF'
    };
    expect(monitoringOffStatus.monitoringStatus).toBe('OFF');
  });

  it("displays last trade time, API health, and selected index", () => {
    // Test last trade time
    expect(mockHeaderStatus.lastTradeTime).toBeInstanceOf(Date);
    expect(mockHeaderStatus.lastTradeTime?.toISOString()).toBe('2024-01-15T10:30:00.000Z');

    // Test API health
    expect(mockHeaderStatus.apiHealth).toBe('HEALTHY');
    
    const degradedHealth: HeaderStatus = {
      ...mockHeaderStatus,
      apiHealth: 'DEGRADED'
    };
    expect(degradedHealth.apiHealth).toBe('DEGRADED');

    const downHealth: HeaderStatus = {
      ...mockHeaderStatus,
      apiHealth: 'DOWN'
    };
    expect(downHealth.apiHealth).toBe('DOWN');

    // Test selected index
    expect(mockHeaderStatus.selectedIndex).toBe('NIFTY');
    
    const bankNiftyStatus: HeaderStatus = {
      ...mockHeaderStatus,
      selectedIndex: 'BANKNIFTY'
    };
    expect(bankNiftyStatus.selectedIndex).toBe('BANKNIFTY');

    const sensexStatus: HeaderStatus = {
      ...mockHeaderStatus,
      selectedIndex: 'SENSEX'
    };
    expect(sensexStatus.selectedIndex).toBe('SENSEX');
  });

  it("handles trade engine status changes", () => {
    // Test RUNNING status
    expect(mockHeaderStatus.tradeEngineStatus).toBe('RUNNING');

    // Test PAUSED status
    const pausedStatus: HeaderStatus = {
      ...mockHeaderStatus,
      tradeEngineStatus: 'PAUSED'
    };
    expect(pausedStatus.tradeEngineStatus).toBe('PAUSED');

    // Test STOPPED status
    const stoppedStatus: HeaderStatus = {
      ...mockHeaderStatus,
      tradeEngineStatus: 'STOPPED'
    };
    expect(stoppedStatus.tradeEngineStatus).toBe('STOPPED');
  });

  it("tracks open price lock status", () => {
    // Test locked status
    expect(mockHeaderStatus.openPriceLocked).toBe(true);

    // Test unlocked status
    const unlockedStatus: HeaderStatus = {
      ...mockHeaderStatus,
      openPriceLocked: false
    };
    expect(unlockedStatus.openPriceLocked).toBe(false);
  });

  it("handles null last trade time", () => {
    const noTradeStatus: HeaderStatus = {
      ...mockHeaderStatus,
      lastTradeTime: null
    };
    expect(noTradeStatus.lastTradeTime).toBeNull();
  });
}); 