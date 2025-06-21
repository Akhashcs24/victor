import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Filter,
  Download,
  BarChart3,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock
} from 'lucide-react';
import { TradeLog } from '../types';
import { TradeLogService } from '../services/tradeLogService';

interface AllLogsPageProps {
  onClose?: () => void;
}

export const AllLogsPage: React.FC<AllLogsPageProps> = ({ onClose }) => {
  const [historicalLogs, setHistoricalLogs] = useState<Record<string, TradeLog[]>>({});
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<'all' | 'ENTRY' | 'EXIT'>('all');
  const [stats, setStats] = useState({
    todayTrades: 0,
    todayPnL: 0,
    totalTrades: 0,
    totalPnL: 0,
    winRate: 0,
    avgPnL: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = () => {
    const logs = TradeLogService.getHistoricalTradeLogs();
    const statistics = TradeLogService.getTradeStats();
    setHistoricalLogs(logs);
    setStats(statistics);
  };

  const getActionIcon = (action: string) => {
    return action === 'ENTRY' ? 
      <TrendingUp className="w-4 h-4 text-green-500" /> : 
      <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getExitReasonIcon = (exitReason?: string) => {
    switch (exitReason) {
      case 'TARGET':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'STOP_LOSS':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'MANUAL':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getPnLColor = (pnl?: number) => {
    if (pnl === undefined) return 'text-gray-500';
    return pnl >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getFilteredLogs = () => {
    let logs: TradeLog[] = [];

    if (selectedDate === 'all') {
      logs = TradeLogService.getAllTradeLogsFlat();
    } else {
      logs = historicalLogs[selectedDate] || [];
    }

    if (filterAction !== 'all') {
      logs = logs.filter(log => log.action === filterAction);
    }

    return logs;
  };

  const exportLogs = () => {
    const data = TradeLogService.exportLogs();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `victor-trade-logs-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredLogs = getFilteredLogs();
  const sortedDates = Object.keys(historicalLogs).sort().reverse();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Trade History</h1>
                <p className="text-gray-600">Complete trading log for the last 2 months</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={exportLogs}
                className="btn-secondary flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              {onClose && (
                <button onClick={onClose} className="btn-primary">
                  Close
                </button>
              )}
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{stats.todayTrades}</div>
              <div className="text-sm text-blue-800">Today's Trades</div>
            </div>
            <div className={`p-4 rounded-lg ${stats.todayPnL >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${stats.todayPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{stats.todayPnL.toFixed(2)}
              </div>
              <div className={`text-sm ${stats.todayPnL >= 0 ? 'text-green-800' : 'text-red-800'}`}>Today's P&L</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">{stats.totalTrades}</div>
              <div className="text-sm text-gray-800">Total Trades</div>
            </div>
            <div className={`p-4 rounded-lg ${stats.totalPnL >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{stats.totalPnL.toFixed(2)}
              </div>
              <div className={`text-sm ${stats.totalPnL >= 0 ? 'text-green-800' : 'text-red-800'}`}>Total P&L</div>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.winRate.toFixed(1)}%</div>
              <div className="text-sm text-purple-800">Win Rate</div>
            </div>
            <div className={`p-4 rounded-lg ${stats.avgPnL >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-2xl font-bold ${stats.avgPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{stats.avgPnL.toFixed(2)}
              </div>
              <div className={`text-sm ${stats.avgPnL >= 0 ? 'text-green-800' : 'text-red-800'}`}>Avg P&L</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-500" />
              <span className="font-medium text-gray-700">Filters:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <select
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Dates</option>
                {sortedDates.map(date => (
                  <option key={date} value={date}>
                    {formatDate(date)} ({historicalLogs[date].length} trades)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value as 'all' | 'ENTRY' | 'EXIT')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Actions</option>
                <option value="ENTRY">Entry Only</option>
                <option value="EXIT">Exit Only</option>
              </select>
            </div>

            <div className="text-sm text-gray-600 ml-auto">
              Showing {filteredLogs.length} trades
            </div>
          </div>
        </div>

        {/* Trade Logs */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-blue-600" />
              Trade Logs
              {selectedDate !== 'all' && (
                <span className="text-sm font-normal text-gray-600">
                  - {formatDate(selectedDate)}
                </span>
              )}
            </h2>
          </div>

          <div className="max-h-[600px] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Clock className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">No trades found</p>
                <p className="text-sm">Try adjusting your filters or check back later</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        {getActionIcon(log.action)}
                        <div>
                          <span className="font-semibold text-lg text-gray-900">{log.symbol}</span>
                          <span className={`text-sm ml-3 px-2 py-1 rounded-full ${
                            log.action === 'ENTRY' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {log.action}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        {log.exitReason && (
                          <div className="flex items-center space-x-2">
                            {getExitReasonIcon(log.exitReason)}
                            <span className="text-sm font-medium text-gray-600">{log.exitReason}</span>
                          </div>
                        )}
                        <div className="text-right">
                          <div className="text-sm text-gray-500">
                            {log.timestamp.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                      <div>
                        <span className="text-sm font-medium text-gray-500">Price</span>
                        <div className="text-xl font-bold text-gray-900">₹{log.price.toFixed(2)}</div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Quantity</span>
                        <div className="text-xl font-bold text-gray-900">{log.quantity}</div>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">Value</span>
                        <div className="text-xl font-bold text-gray-900">₹{(log.price * log.quantity).toFixed(2)}</div>
                      </div>
                      {log.pnl !== undefined && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">P&L</span>
                          <div className={`text-xl font-bold ${getPnLColor(log.pnl)}`}>
                            ₹{log.pnl.toFixed(2)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}; 