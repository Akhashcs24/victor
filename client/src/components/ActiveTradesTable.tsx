import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  EyeOff, 
  Clock, 
  Target, 
  Shield, 
  TrendingUp, 
  Activity,
  DollarSign,
  X
} from 'lucide-react';
import { LivePnLTrackingService, LivePosition } from '../services/livePnLTrackingService';
import { PersistentTradeLogService } from '../services/persistentTradeLogService';
import { TradeLogEntry } from '../types';

interface ActiveTradesTableProps {
  onUpdate?: () => void;
}

export const ActiveTradesTable: React.FC<ActiveTradesTableProps> = ({ onUpdate }) => {
  const [activeTrades, setActiveTrades] = useState<TradeLogEntry[]>([]);
  const [livePositions, setLivePositions] = useState<LivePosition[]>([]);

  // Update active trades and live positions
  useEffect(() => {
    const updateData = async () => {
      try {
        // Get today's trades that are BUY orders and completed (active positions)
        const todayTrades = await PersistentTradeLogService.getTodayTradeLogs();
        console.log(`🔍 ActiveTradesTable: Found ${todayTrades.length} total trades today`);
        
        // More robust filtering for active trades - DEFENSIVE APPROACH
        const activeBuyTrades = todayTrades.filter(trade => {
          // Must be a BUY trade that's completed
          if (trade.action !== 'BUY' || trade.status !== 'COMPLETED') {
            return false;
          }
          
          console.log(`🔍 Checking BUY trade: ${trade.symbol} at ${trade.price} (ID: ${trade.id})`);
          
          // NEW APPROACH: Only hide a trade if there's a DEFINITIVE matching SELL trade
          // with EXACT same symbol, LATER timestamp, and EXACT or MORE quantity
          const matchingSellTrades = todayTrades.filter(sellTrade => {
            const isExactMatch = (
              sellTrade.action === 'SELL' && 
              sellTrade.symbol === trade.symbol &&
              sellTrade.timestamp > trade.timestamp &&
              sellTrade.status === 'COMPLETED' &&
              sellTrade.quantity >= trade.quantity // Must be exact or more quantity
            );
            
            if (isExactMatch) {
              console.log(`🎯 Found EXACT matching SELL for ${trade.symbol}: BUY ${trade.quantity} vs SELL ${sellTrade.quantity}`);
            }
            
            return isExactMatch;
          });
          
          // Only hide if there's a definitive matching sell
          const shouldHide = matchingSellTrades.length > 0;
          const shouldShow = !shouldHide;
          
          console.log(`🔍 Trade ${trade.symbol}: BUY=${trade.quantity}, Matching SELLs=${matchingSellTrades.length}, SHOW=${shouldShow}`);
          
          return shouldShow;
        });
        
        console.log(`🔍 ActiveTradesTable: Filtered to ${activeBuyTrades.length} active trades`);
        console.log(`📋 Active trades:`, activeBuyTrades.map(t => `${t.symbol} @ ₹${t.price}`));
        
        // DEFENSIVE: Only update if we have trades OR if this is the first load
        if (activeBuyTrades.length > 0 || activeTrades.length === 0) {
          setActiveTrades(activeBuyTrades);
        } else {
          console.log(`⚠️ No active trades found, keeping previous ${activeTrades.length} trades visible`);
        }
        
        // Get live positions - don't clear if fetch fails
        try {
          const positions = LivePnLTrackingService.getAllPositions();
          console.log(`🔍 ActiveTradesTable: Found ${positions.length} live positions`);
          
          // DEFENSIVE: Only update positions if we get valid data
          if (positions.length > 0 || livePositions.length === 0) {
            setLivePositions(positions);
          } else {
            console.log(`⚠️ No live positions found, keeping previous ${livePositions.length} positions`);
          }
        } catch (positionError) {
          console.warn('Could not update live positions, keeping previous data:', positionError);
          // Keep previous positions if fetch fails
        }
        
      } catch (error) {
        console.error('❌ Error updating active trades, keeping previous data:', error);
        // Don't clear active trades on error, keep showing previous data
      }
    };

    updateData(); // Initial update
    const interval = setInterval(updateData, 5000); // Reduced frequency to 5 seconds to reduce API load

    return () => clearInterval(interval);
  }, [activeTrades.length, livePositions.length]); // Add dependencies to prevent unnecessary updates

  // Get live data for a trade
  const getLiveData = (tradeId: string) => {
    const position = livePositions.find(pos => pos.tradeId === tradeId);
    return {
      currentPrice: position?.currentPrice || null,
      livePnL: position?.livePnL || null,
      lastUpdate: position?.lastUpdate || null
    };
  };

  // Calculate target and stop loss from remarks
  const getTargetSL = (trade: TradeLogEntry) => {
    try {
      if (trade.remarks) {
        // Extract target and SL from remarks like "Target: ₹123.45 - SL: ₹98.76"
        const targetMatch = trade.remarks.match(/Target:\s*₹([\d.]+)/);
        const slMatch = trade.remarks.match(/SL:\s*₹([\d.]+)/);
        
        if (targetMatch && slMatch) {
          const target = parseFloat(targetMatch[1]);
          const stopLoss = parseFloat(slMatch[1]);
          return {
            target,
            stopLoss,
            targetPoints: target - trade.price,
            stopLossPoints: trade.price - stopLoss
          };
        }
      }
      
      // Fallback to default points if parsing fails
      const targetPoints = 20;
      const stopLossPoints = 10;
      
      return {
        target: trade.price + targetPoints,
        stopLoss: trade.price - stopLossPoints,
        targetPoints,
        stopLossPoints
      };
    } catch (error) {
      return {
        target: trade.price + 20,
        stopLoss: trade.price - 10,
        targetPoints: 20,
        stopLossPoints: 10
      };
    }
  };

  // Get trade status based on current price
  const getTradeStatus = (trade: TradeLogEntry, currentPrice: number | null) => {
    if (!currentPrice) return 'IN PROGRESS';
    
    const { target, stopLoss } = getTargetSL(trade);
    
    if (currentPrice >= target) return 'TARGET HIT';
    if (currentPrice <= stopLoss) return 'SL HIT';
    return 'IN PROGRESS';
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'IN PROGRESS':
        return 'bg-blue-100 text-blue-700';
      case 'TARGET HIT':
        return 'bg-green-100 text-green-700';
      case 'SL HIT':
        return 'bg-red-100 text-red-700';
      case 'COMPLETED':
        return 'bg-gray-100 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Format time
  const formatTime = (date: Date | null) => {
    if (!date) return '--';
    return date.toLocaleString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      month: 'short',
      day: 'numeric',
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  // Get symbol display name
  const getSymbolDisplayName = (symbol: string) => {
    const match = symbol.match(/([A-Z]+):([A-Z]+)(\d+[A-Z]+\d+)(CE|PE)$/);
    if (match) {
      const [, exchange, index, expiry, type] = match;
      const strike = expiry.match(/\d+$/)?.[0];
      return `${index} ${strike} ${type}`;
    }
    return symbol;
  };

  // Handle manual exit
  const handleManualExit = async (trade: TradeLogEntry, currentPrice: number) => {
    try {
      const { target, stopLoss } = getTargetSL(trade);
      const pnl = (currentPrice - trade.price) * trade.quantity;
      
      // Add exit trade log
      await PersistentTradeLogService.addTradeLog({
        symbol: trade.symbol,
        action: 'SELL',
        quantity: trade.quantity,
        price: currentPrice,
        orderType: 'MARKET',
        status: 'COMPLETED',
        pnl: pnl,
        tradingMode: trade.tradingMode,
        remarks: `Manual exit - P&L: ₹${pnl.toFixed(2)}`
      });

      // Remove from live tracking
      LivePnLTrackingService.removePosition(trade.id);
      
      console.log(`✅ Manual exit executed for ${trade.symbol} at ₹${currentPrice} - P&L: ₹${pnl.toFixed(2)}`);
      onUpdate?.();
    } catch (error) {
      console.error('Error executing manual exit:', error);
    }
  };

  // Debug function to log detailed trade information
  const debugTrades = async () => {
    try {
      const todayTrades = await PersistentTradeLogService.getTodayTradeLogs();
      console.log('🐛 DEBUG: All trades today:', todayTrades.length);
      
      const buyTrades = todayTrades.filter(t => t.action === 'BUY' && t.status === 'COMPLETED');
      const sellTrades = todayTrades.filter(t => t.action === 'SELL' && t.status === 'COMPLETED');
      
      console.log('🐛 DEBUG: BUY trades:', buyTrades.length);
      console.log('🐛 DEBUG: SELL trades:', sellTrades.length);
      
      buyTrades.forEach(buyTrade => {
        const matchingSells = sellTrades.filter(sellTrade => 
          sellTrade.symbol === buyTrade.symbol && 
          sellTrade.timestamp > buyTrade.timestamp
        );
        console.log(`🐛 DEBUG: ${buyTrade.symbol} BUY @ ₹${buyTrade.price} has ${matchingSells.length} matching SELLs`);
      });
      
      const livePositions = LivePnLTrackingService.getAllPositions();
      console.log('🐛 DEBUG: Live positions:', livePositions.length);
      livePositions.forEach(pos => {
        console.log(`🐛 DEBUG: Position ${pos.symbol} @ ₹${pos.entryPrice}, current: ₹${pos.currentPrice}, P&L: ₹${pos.livePnL}`);
      });
      
    } catch (error) {
      console.error('🐛 DEBUG: Error:', error);
    }
  };

  // Reload positions function
  const reloadPositions = async () => {
    try {
      console.log('🔄 Manually reloading positions...');
      await LivePnLTrackingService.debugReloadPositions();
      
      // Force update the component
      const positions = LivePnLTrackingService.getAllPositions();
      setLivePositions(positions);
      
      console.log('✅ Positions reloaded successfully');
    } catch (error) {
      console.error('❌ Error reloading positions:', error);
    }
  };

  if (activeTrades.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <EyeOff className="w-5 h-5 text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-900">Active Trades</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
            <DollarSign className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No active trades</p>
          <p className="text-slate-400 text-xs mt-1">Executed trades will appear here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-5 h-5 text-green-600" />
        <h3 className="text-lg font-semibold text-slate-900">Active Trades</h3>
        <span className="ml-auto px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          {activeTrades.length} Active
        </span>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-600">Symbol</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-600">Entry</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-600">Current</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-600">
                <div className="flex items-center justify-end gap-1">
                  <Target className="w-3 h-3" />
                  Target
                </div>
              </th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-600">
                <div className="flex items-center justify-end gap-1">
                  <Shield className="w-3 h-3" />
                  SL
                </div>
              </th>
              <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Status</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-600">Live P&L</th>
              <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Qty</th>
              <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Last Update</th>
              <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {activeTrades.map((trade) => {
              const liveData = getLiveData(trade.id);
              const { target, stopLoss } = getTargetSL(trade);
              const status = getTradeStatus(trade, liveData.currentPrice);
              
              return (
                <tr key={trade.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">
                        {getSymbolDisplayName(trade.symbol)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        trade.tradingMode === 'LIVE' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {trade.tradingMode === 'LIVE' ? 'LIVE' : 'PAPER'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-semibold text-slate-900">
                      ₹{trade.price.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className="text-sm font-semibold text-blue-600">
                        {liveData.currentPrice ? `₹${liveData.currentPrice.toFixed(2)}` : '--'}
                      </span>
                      {liveData.currentPrice && (
                        <div className="flex items-center gap-1 text-xs">
                          <Activity className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">LIVE</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-semibold text-green-600">
                      ₹{target.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-semibold text-red-600">
                      ₹{stopLoss.toFixed(2)}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                      {status}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex flex-col items-end">
                      <span className={`text-sm font-bold ${
                        liveData.livePnL !== null 
                          ? liveData.livePnL >= 0 ? 'text-green-600' : 'text-red-600'
                          : 'text-slate-500'
                      }`}>
                        {liveData.livePnL !== null ? `₹${liveData.livePnL.toFixed(2)}` : '--'}
                      </span>
                      {liveData.livePnL !== null && (
                        <div className="flex items-center gap-1 text-xs">
                          <Activity className="w-3 h-3 text-green-500" />
                          <span className="text-green-500">LIVE</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-sm font-medium text-slate-700">
                      {trade.quantity}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatTime(liveData.lastUpdate)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <button
                      onClick={() => {
                        if (liveData.currentPrice) {
                          handleManualExit(trade, liveData.currentPrice);
                        } else {
                          const price = prompt(`Enter exit price for ${trade.symbol}:`);
                          if (price && !isNaN(Number(price))) {
                            handleManualExit(trade, Number(price));
                          }
                        }
                      }}
                      className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                      title={`Exit ${trade.symbol}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Summary Footer */}
      <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between text-sm text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            <span>Tracking {activeTrades.length} active positions</span>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Updates every 5 seconds • Live P&L tracking
        </div>
      </div>

      {/* Debug Section - Can be removed in production */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer hover:text-slate-700">Debug Info</summary>
            <div className="mt-2 space-y-1 font-mono">
              <div>Active Trades: {activeTrades.length}</div>
              <div>Live Positions: {livePositions.length}</div>
              <div>P&L Tracking: {LivePnLTrackingService.isCurrentlyTracking() ? 'Active' : 'Inactive'}</div>
              <div>Position Count: {LivePnLTrackingService.getPositionCount()}</div>
              <button 
                onClick={() => {
                  console.log('🔍 Debug Info:', LivePnLTrackingService.getDebugInfo());
                  console.log('🔍 Active Trades:', activeTrades);
                  console.log('🔍 Live Positions:', livePositions);
                }}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
              >
                Log Debug Info
              </button>
              <button 
                onClick={async () => {
                  await LivePnLTrackingService.debugReloadPositions();
                }}
                className="ml-2 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
              >
                Reload Positions
              </button>
              <button 
                onClick={async () => {
                  const todayTrades = await PersistentTradeLogService.getTodayTradeLogs();
                  console.log('🔍 All Today Trades:', todayTrades);
                  console.log('🔍 BUY Trades:', todayTrades.filter(t => t.action === 'BUY'));
                  console.log('🔍 SELL Trades:', todayTrades.filter(t => t.action === 'SELL'));
                  console.log('🔍 Active Trades Logic Result:', activeTrades);
                }}
                className="ml-2 px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs hover:bg-yellow-200"
              >
                Debug Trades
              </button>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}; 