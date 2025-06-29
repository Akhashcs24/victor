import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  DollarSign,
  CheckCircle,
  XCircle,
  AlertCircle,
  Eye
} from 'lucide-react';
import { TradeLog as TradeLogType } from '../types';

interface TradeLogProps {
  logs: TradeLogType[];
  onViewAllLogs?: () => void;
}

export const TradeLog: React.FC<TradeLogProps> = ({ logs, onViewAllLogs }) => {
  const getActionIcon = (action: string) => {
    return action === 'ENTRY' ? 
      <TrendingUp className="w-4 h-4 text-success-500" /> : 
      <TrendingDown className="w-4 h-4 text-danger-500" />;
  };

  const getExitReasonIcon = (exitReason?: string) => {
    switch (exitReason) {
      case 'TARGET':
        return <CheckCircle className="w-4 h-4 text-success-500" />;
      case 'STOP_LOSS':
        return <XCircle className="w-4 h-4 text-danger-500" />;
      case 'MANUAL':
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
                    <span className="text-xs text-slate-500 ml-2 bg-slate-200 px-2 py-1 rounded">{log.action}</span>
                  </div>
                </div>
                {log.exitReason && (
                  <div className="flex items-center space-x-2">
                    {getExitReasonIcon(log.exitReason)}
                    <span className="text-xs font-medium text-slate-600">{log.exitReason}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                <div className="flex justify-between">
                  <span className="text-slate-600">Price:</span>
                  <span className="font-semibold text-slate-900">₹{log.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Qty:</span>
                  <span className="font-semibold text-slate-900">{log.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Action:</span>
                  <span className="font-semibold text-slate-900">{log.action}</span>
                </div>
                {log.pnl !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-600">P&L:</span>
                    <span className={`font-bold ${getPnLColor(log.pnl)}`}>
                      ₹{log.pnl.toFixed(2)}
                    </span>
                  </div>
                )}
              </div>

              <div className="text-xs text-slate-500 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                {log.timestamp.toLocaleString()}
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
            <span className="text-gray-600">Total P&L:</span>
            <span className={`font-medium ${getPnLColor(
              logs.reduce((total, log) => total + (log.pnl || 0), 0)
            )}`}>
              ₹{logs.reduce((total, log) => total + (log.pnl || 0), 0).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}; 