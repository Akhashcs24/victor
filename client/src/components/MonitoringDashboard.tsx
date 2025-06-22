import React from 'react';
import { MultiSymbolMonitoringService } from '../services/multiSymbolMonitoringService';
import { OrderService } from '../services/orderService';
import { Eye, EyeOff, TrendingUp, Clock, Plus, Target, Shield } from 'lucide-react';

interface MonitoringDashboardProps {
  onUpdate?: () => void;
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({ onUpdate }) => {
  const monitoredSymbols = MultiSymbolMonitoringService.getMonitoredSymbols();

  const handleStopMonitoring = (symbolId: string) => {
    MultiSymbolMonitoringService.removeSymbolFromMonitoring(symbolId);
    onUpdate?.();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING': return 'text-yellow-600 bg-yellow-50';
      case 'ENTERED': return 'text-green-600 bg-green-50';
      case 'EXITED': return 'text-red-600 bg-red-50';
      default: return 'text-blue-600 bg-blue-50';
    }
  };

  const formatTime = (date: Date | null) => {
    if (!date) return '--';
    return date.toLocaleTimeString('en-IN', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getSymbolDisplayName = (symbol: string) => {
    // Extract readable name from symbol like "NSE:NIFTY25JUN24550CE" -> "NIFTY 24550 CE"
    const match = symbol.match(/([A-Z]+):([A-Z]+)(\d+[A-Z]+\d+)(CE|PE)$/);
    if (match) {
      const [, exchange, index, expiry, type] = match;
      const strike = expiry.match(/\d+$/)?.[0];
      return `${index} ${strike} ${type}`;
    }
    return symbol;
  };

  // Calculate target and stop loss prices based on current LTP
  const calculateTargetSL = (currentLTP: number | null, targetPoints: number, stopLossPoints: number) => {
    if (!currentLTP) return { target: null, stopLoss: null };
    
    return {
      target: currentLTP + targetPoints,
      stopLoss: currentLTP - stopLossPoints
    };
  };

  // Demo function to show order format (for debugging/testing)
  const handleDemoOrder = (entry: any) => {
    const orderData = OrderService.formatOrderData(
      entry.symbol,
      entry.lots,
      'BUY',
      entry.entryMethod,
      entry.currentLTP || 0,
      'INTRADAY',
      `Victor2.0-Demo-${Date.now()}`
    );
    
    // Also show validation
    const validation = OrderService.validateOrderData(orderData);
    
    OrderService.logOrderData(orderData, 'Demo Order');
    console.log('📋 Order Validation:', validation);
    console.log('📋 Order Summary:', OrderService.getOrderSummary(orderData));
  };

  if (monitoredSymbols.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <EyeOff className="w-5 h-5 text-slate-500" />
          <h3 className="text-lg font-semibold text-slate-900">Active Monitoring</h3>
        </div>
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 rounded-full flex items-center justify-center">
            <Eye className="w-8 h-8 text-slate-400" />
          </div>
          <p className="text-slate-500 text-sm">No symbols are currently being monitored</p>
          <p className="text-slate-400 text-xs mt-1">Select options and click "Monitor & Trade" to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Eye className="w-5 h-5 text-green-600" />
        <h3 className="text-lg font-semibold text-slate-900">Active Monitoring</h3>
        <span className="ml-auto px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full">
          {monitoredSymbols.length} Active
        </span>
        <button
          onClick={() => {
            // First clear all monitoring which will remove symbols and stop monitoring
            MultiSymbolMonitoringService.clearAllMonitoring();
            
            // Also explicitly remove from localStorage to ensure complete cleanup
            localStorage.removeItem('victor_monitored_symbols');
            localStorage.removeItem('victor_monitoring_active');
            
            console.log('🛑 All monitoring stopped and cleared from dashboard');
            onUpdate?.();
          }}
          className="ml-2 px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
          title="Stop all monitoring"
        >
          Stop All
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-3 text-sm font-medium text-slate-600">Symbol</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-600">LTP</th>
              <th className="text-right py-2 px-3 text-sm font-medium text-slate-600">HMA</th>
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
              <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Lots</th>
              <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Updated</th>
              <th className="text-center py-2 px-3 text-sm font-medium text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody>
            {monitoredSymbols.map((item) => {
              const { target, stopLoss } = calculateTargetSL(item.currentLTP, item.targetPoints, item.stopLossPoints);
              
              return (
                <tr key={item.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        item.type === 'CE' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-sm font-medium text-slate-900">
                        {getSymbolDisplayName(item.symbol)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-semibold text-slate-900">
                      {item.currentLTP ? `₹${item.currentLTP.toFixed(2)}` : '--'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-semibold text-slate-700">
                      {item.hmaValue ? `₹${item.hmaValue.toFixed(2)}` : '--'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-semibold text-green-600">
                      {target ? `₹${target.toFixed(2)}` : '--'}
                    </span>
                    {item.currentLTP && (
                      <div className="text-xs text-green-500">
                        +{item.targetPoints}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <span className="text-sm font-semibold text-red-600">
                      {stopLoss ? `₹${stopLoss.toFixed(2)}` : '--'}
                    </span>
                    {item.currentLTP && (
                      <div className="text-xs text-red-500">
                        -{item.stopLossPoints}
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(item.triggerStatus)}`}>
                      {item.triggerStatus}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span className="text-sm font-medium text-slate-700">
                      {item.lots}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      {formatTime(item.lastUpdate)}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleStopMonitoring(item.id)}
                        className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                        title={`Stop monitoring ${item.symbol}`}
                      >
                        Stop
                      </button>
                      {process.env.NODE_ENV === 'development' && (
                        <button
                          onClick={() => handleDemoOrder(item)}
                          className="px-2 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                          title="Show order format (dev only)"
                        >
                          📋
                        </button>
                      )}
                    </div>
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
            <span>Monitoring {monitoredSymbols.length} symbols for HMA crossovers</span>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          Updates every 2 seconds during market hours
        </div>
      </div>
      
      {/* Order Format Info (Development Mode) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-700 font-medium mb-1">🔧 Development Info</div>
          <div className="text-xs text-blue-600">
            Click 📋 button to see Fyers API order format in console. Target/SL calculated as LTP ± points.
          </div>
        </div>
      )}
    </div>
  );
}; 