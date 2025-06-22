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
  Clock,
  X
} from 'lucide-react';
import { TradeLogEntry } from '../types';
import { PersistentTradeLogService } from '../services/persistentTradeLogService';

interface AllLogsPageProps {
  onClose?: () => void;
}

export const AllLogsPage: React.FC<AllLogsPageProps> = ({ onClose }) => {
  const [historicalLogs, setHistoricalLogs] = useState<Record<string, TradeLogEntry[]>>({});
  const [selectedDate, setSelectedDate] = useState<string>('all');
  const [filterAction, setFilterAction] = useState<'all' | 'BUY' | 'SELL'>('all');
  const [filteredLogs, setFilteredLogs] = useState<TradeLogEntry[]>([]);
  const [stats, setStats] = useState({
    todayTrades: 0,
    todayPnL: 0,
    totalTrades: 0,
    totalPnL: 0,
    winRate: 0,
    avgPnL: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    updateFilteredLogs();
  }, [selectedDate, filterAction, historicalLogs]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const logs = await PersistentTradeLogService.getHistoricalTradeLogs();
      const statistics = await PersistentTradeLogService.getTradeStats();
      
      setHistoricalLogs(logs);
      setStats(statistics);
    } catch (error) {
      console.error('Error loading trade logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateFilteredLogs = async () => {
    try {
      let logs: TradeLogEntry[] = [];
      
      if (selectedDate === 'all') {
        logs = await PersistentTradeLogService.getAllTradeLogsFlat();
      } else {
        logs = historicalLogs[selectedDate] || [];
      }
      
      if (filterAction !== 'all') {
        logs = logs.filter(log => log.action === filterAction);
      }
      
      setFilteredLogs(logs);
    } catch (error) {
      console.error('Error updating filtered logs:', error);
      setFilteredLogs([]);
    }
  };

  const getActionIcon = (action: string) => {
    return action === 'BUY' ? 
      <TrendingUp className="w-4 h-4 text-green-500" /> : 
      <TrendingDown className="w-4 h-4 text-red-500" />;
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'CANCELLED':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'PENDING':
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getPnLColor = (pnl?: number | null) => {
    if (pnl === undefined || pnl === null) return 'text-gray-500';
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

  const exportLogs = async () => {
    try {
      const data = await PersistentTradeLogService.exportLogs();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `victor-trade-logs-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting logs:', error);
    }
  };

  const sortedDates = Object.keys(historicalLogs).sort().reverse();

  return (
    <div className="min-h-screen bg-gray-50 p-3 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 sm:mb-6">
            <div className="flex items-center gap-3 mb-4 sm:mb-0">
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Trade History</h1>
                <p className="text-sm sm:text-base text-gray-600">Complete trading log for the last 2 months</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={exportLogs}
                className="btn-secondary flex items-center gap-2 text-sm px-3 py-2"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Export</span>
              </button>
              {onClose && (
                <button onClick={onClose} className="btn-primary flex items-center gap-2 text-sm px-3 py-2 sm:hidden">
                  <X className="w-4 h-4" />
                  Close
                </button>
              )}
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-blue-600">{stats.todayTrades}</div>
              <div className="text-xs sm:text-sm text-blue-800">Today's Trades</div>
            </div>
            <div className={`p-3 sm:p-4 rounded-lg ${stats.todayPnL >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-lg sm:text-2xl font-bold ${stats.todayPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{stats.todayPnL.toFixed(2)}
              </div>
              <div className={`text-xs sm:text-sm ${stats.todayPnL >= 0 ? 'text-green-800' : 'text-red-800'}`}>Today's P&L</div>
            </div>
            <div className="bg-gray-50 p-3 sm:p-4 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-gray-600">{stats.totalTrades}</div>
              <div className="text-xs sm:text-sm text-gray-800">Total Trades</div>
            </div>
            <div className={`p-3 sm:p-4 rounded-lg ${stats.totalPnL >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-lg sm:text-2xl font-bold ${stats.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{stats.totalPnL.toFixed(2)}
              </div>
              <div className={`text-xs sm:text-sm ${stats.totalPnL >= 0 ? 'text-green-800' : 'text-red-800'}`}>Total P&L</div>
            </div>
            <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
              <div className="text-lg sm:text-2xl font-bold text-purple-600">{stats.winRate.toFixed(1)}%</div>
              <div className="text-xs sm:text-sm text-purple-800">Win Rate</div>
            </div>
            <div className={`p-3 sm:p-4 rounded-lg ${stats.avgPnL >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
              <div className={`text-lg sm:text-2xl font-bold ${stats.avgPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ₹{stats.avgPnL.toFixed(2)}
              </div>
              <div className={`text-xs sm:text-sm ${stats.avgPnL >= 0 ? 'text-green-800' : 'text-red-800'}`}>Avg P&L</div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              <span className="font-medium text-gray-700 text-sm sm:text-base">Filters:</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 flex-1">
              <div className="flex items-center gap-2 flex-1">
                <Calendar className="w-4 h-4 text-gray-500" />
                <select
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Dates</option>
                  {sortedDates.map(date => (
                    <option key={date} value={date}>
                      {formatDate(date)} ({historicalLogs[date].length})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 flex-1">
                <TrendingUp className="w-4 h-4 text-gray-500" />
                <select
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value as 'all' | 'BUY' | 'SELL')}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Actions</option>
                  <option value="BUY">Buy Only</option>
                  <option value="SELL">Sell Only</option>
                </select>
              </div>
            </div>

            <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
              Showing {filteredLogs.length} trades
            </div>
          </div>
        </div>

        {/* Trade Logs */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="p-4 sm:p-6 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 flex items-center gap-2">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              Trade Logs
              {selectedDate !== 'all' && (
                <span className="text-xs sm:text-sm font-normal text-gray-600">
                  - {formatDate(selectedDate)}
                </span>
              )}
            </h2>
          </div>

          <div className="max-h-[400px] sm:max-h-[600px] overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-8 sm:py-12 text-gray-500">
                <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-blue-500 mx-auto mb-3 sm:mb-4"></div>
                <p className="text-base sm:text-lg">Loading trade logs...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-500">
                <Clock className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-3 sm:mb-4 text-gray-300" />
                <p className="text-base sm:text-lg">No trades found</p>
                <p className="text-xs sm:text-sm">Try adjusting your filters or check back later</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <div key={log.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
                      <div className="flex items-center space-x-3 mb-2 sm:mb-0">
                        {getActionIcon(log.action)}
                        <span className={`font-medium ${log.action === 'BUY' ? 'text-green-600' : 'text-red-600'}`}>
                          {log.action}
                        </span>
                        <span className="text-gray-500">•</span>
                        <span className="text-gray-800 font-medium">{log.symbol}</span>
                        {log.status && (
                          <>
                            <span className="text-gray-500">•</span>
                            <div className="flex items-center space-x-1">
                              {getStatusIcon(log.status)}
                              <span className="text-xs text-gray-600">{log.status}</span>
                            </div>
                          </>
                        )}
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString('en-IN')}
                        </div>
                        {log.pnl !== undefined && log.pnl !== null && (
                          <div className={`font-medium ${getPnLColor(log.pnl)}`}>
                            {log.pnl >= 0 ? '+' : ''}{log.pnl.toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-4 text-xs sm:text-sm">
                      <div className="text-gray-600">
                        <span className="font-medium">Quantity:</span> {log.quantity}
                      </div>
                      {log.price && (
                        <div className="text-gray-600">
                          <span className="font-medium">Price:</span> ₹{log.price.toFixed(2)}
                        </div>
                      )}
                      {log.exitPrice && (
                        <div className="text-gray-600">
                          <span className="font-medium">Exit:</span> ₹{log.exitPrice.toFixed(2)}
                        </div>
                      )}
                      {log.trigger && (
                        <div className="text-gray-600">
                          <span className="font-medium">Trigger:</span> {log.trigger}
                        </div>
                      )}
                      {log.notes && (
                        <div className="text-gray-600 flex-1">
                          <span className="font-medium">Notes:</span> {log.notes}
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