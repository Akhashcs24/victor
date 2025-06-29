import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye,
  Activity
} from 'lucide-react';
import { TradeLog as TradeLogType } from '../types';
import { LivePnLTrackingService, LivePosition } from '../services/livePnLTrackingService';

interface TradeLogProps {
  logs: TradeLogType[];
  onViewAllLogs?: () => void;
  onManualExit?: (tradeId: string, currentPrice: number) => void;
}

export const TradeLog: React.FC<TradeLogProps> = ({ logs, onViewAllLogs, onManualExit }) => {
  const [livePositions, setLivePositions] = useState<LivePosition[]>([]);

  // Update live positions every 5 seconds
  useEffect(() => {
    const updatePositions = () => {
      setLivePositions(LivePnLTrackingService.getAllPositions());
    };

    updatePositions(); // Initial update
    const interval = setInterval(updatePositions, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  // Get live P&L for a trade ID
  const getLivePnL = (tradeId: string): number | null => {
    const position = livePositions.find(pos => pos.tradeId === tradeId);
    return position?.livePnL || null;
  };

  // Get current price for a trade ID
  const getCurrentPrice = (tradeId: string): number | null => {
    const position = livePositions.find(pos => pos.tradeId === tradeId);
    return position?.currentPrice || null;
  };
  const getActionIcon = (action: string) => {
    return action === 'BUY' ? 
      <TrendingUp className="w-4 h-4 text-success-500" /> : 
      <TrendingDown className="w-4 h-4 text-danger-500" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-success-500" />;
      case 'REJECTED':
        return <XCircle className="w-4 h-4 text-danger-500" />;
      case 'PENDING':
        return <AlertCircle className="w-4 h-4 text-warning-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPnLColor = (pnl?: number) => {
    if (pnl === undefined) return 'text-gray-500';
    return pnl >= 0 ? 'text-success-600' : 'text-danger-600';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-blue-600" />
          Trade Log
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{logs.length} trades</span>
          {onViewAllLogs && (
            <button
              onClick={onViewAllLogs}
              className="btn-secondary flex items-center gap-2 text-xs px-3 py-1"
            >
              <Eye className="w-3 h-3" />
              View all logs
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No trades yet</p>
            <p className="text-sm">Trades will appear here when monitoring starts</p>
          </div>
        ) : (
          logs.slice(0, 5).map((log) => (
            <div key={log.id} className="bg-slate-50 border border-slate-200 rounded-lg p-4 hover:bg-slate-100 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getActionIcon(log.action)}
                  <div>
                    <span className="font-semibold text-sm text-slate-900">{log.symbol}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-slate-500 bg-slate-200 px-2 py-1 rounded">{log.action}</span>
                      <span className={`text-xs font-medium px-2 py-1 rounded ${
                        log.tradingMode === 'LIVE' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {log.tradingMode === 'LIVE' ? '🚀 Live' : '📊 Paper'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusIcon(log.status)}
                  <span className="text-xs font-medium text-slate-600">{log.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Entry Price:</span>
                  <span className="font-semibold text-slate-900">₹{log.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Qty:</span>
                  <span className="font-semibold text-slate-900">{log.quantity}</span>
                </div>
                
                {/* Show current price for BUY orders */}
                {log.action === 'BUY' && log.status === 'COMPLETED' && getCurrentPrice(log.id) && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      Current:
                    </span>
                    <span className="font-semibold text-blue-600">₹{getCurrentPrice(log.id)!.toFixed(2)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span className="text-slate-600">Type:</span>
                  <span className="font-semibold text-slate-900">{log.orderType}</span>
                </div>
                
                {/* Show live P&L for open positions or static P&L for closed positions */}
                {(() => {
                  const livePnL = log.action === 'BUY' && log.status === 'COMPLETED' ? getLivePnL(log.id) : null;
                  const displayPnL = livePnL !== null ? livePnL : log.pnl;
                  
                  if (displayPnL !== undefined && displayPnL !== null) {
                    return (
                      <div className="flex justify-between">
                        <span className="text-slate-600 flex items-center gap-1">
                          {livePnL !== null && (
                            <Activity className="w-3 h-3 text-green-500" />
                          )}
                          P&L:
                        </span>
                        <span className={`font-bold ${getPnLColor(displayPnL)} flex items-center gap-1`}>
                          {livePnL !== null && <span className="text-xs">LIVE</span>}
                          ₹{displayPnL.toFixed(2)}
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {log.remarks && (
                <div className="mb-2 text-xs text-slate-700 bg-slate-200 p-2 rounded">
                  {log.remarks}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-500 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {log.timestamp.toLocaleString()}
                </div>
                
                {/* Manual Exit Button for BUY orders that are active */}
                {log.action === 'BUY' && log.status === 'COMPLETED' && onManualExit && (
                  <button
                    onClick={() => {
                      const currentPrice = prompt(`Enter current market price for ${log.symbol}:`);
                      if (currentPrice && !isNaN(Number(currentPrice))) {
                        onManualExit(log.id, Number(currentPrice));
                      }
                    }}
                    className="text-xs px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                  >
                    Manual Exit
                  </button>
                )}
              </div>
            </div>
          ))
        )}
        
        {logs.length > 5 && (
          <div className="text-center py-2">
            <span className="text-xs text-slate-500">
              Showing 5 of {logs.length} trades
            </span>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 flex items-center gap-1">
              <Activity className="w-4 h-4 text-green-500" />
              Total P&L (Live):
            </span>
            <span className={`font-medium ${getPnLColor(
              (() => {
                const totalPnL = logs.reduce((total, log) => {
                  // Use live P&L for open BUY positions, otherwise use static P&L
                  const livePnL = log.action === 'BUY' && log.status === 'COMPLETED' ? getLivePnL(log.id) : null;
                  const pnl = livePnL !== null ? livePnL : (log.pnl ?? 0);
                  return total + pnl;
                }, 0);
                return totalPnL;
              })()
            )}`}>
              ₹{(() => {
                const totalPnL = logs.reduce((total, log) => {
                  const livePnL = log.action === 'BUY' && log.status === 'COMPLETED' ? getLivePnL(log.id) : null;
                  const pnl = livePnL !== null ? livePnL : (log.pnl ?? 0);
                  return total + pnl;
                }, 0);
                return totalPnL.toFixed(2);
              })()}
            </span>
          </div>
          
          {/* Show live tracking status */}
          <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
            <span>Live positions: {livePositions.length}</span>
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Updates every 5s
            </span>
          </div>
        </div>
      )}
    </div>
  );
}; 