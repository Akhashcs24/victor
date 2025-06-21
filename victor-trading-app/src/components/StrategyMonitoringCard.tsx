import React from 'react';
import { TrendingUp, TrendingDown, AlertCircle, CheckCircle } from 'lucide-react';
import { OptionContract, MarketData, TradeConfig } from '../types';
import { HMAService } from '../services/hmaService';

interface StrategyMonitoringCardProps {
  type: 'CE' | 'PE';
  data: OptionContract | null;
  hmaValue: number | null;
  marketData: MarketData | null;
  config: TradeConfig;
}

export const StrategyMonitoringCard: React.FC<StrategyMonitoringCardProps> = ({
  type,
  data,
  hmaValue,
  marketData,
  config
}) => {
  const getTriggerStatus = (): { status: 'TRIGGERED' | 'WAITING' | 'NO_DATA'; message: string } => {
    if (!data || !hmaValue || !marketData) {
      return { status: 'NO_DATA', message: 'Waiting for data...' };
    }

    const currentPrice = data.ltp;
    const isAboveHMA = HMAService.isPriceAboveHMA(currentPrice, hmaValue);
    
    if (isAboveHMA) {
      return { status: 'TRIGGERED', message: 'Price above HMA - Entry signal!' };
    } else {
      return { status: 'WAITING', message: 'Price below HMA - Waiting for crossover' };
    }
  };

  const calculatePnL = (): { pnl: number; percentage: number } | null => {
    if (!data || !config) return null;
    
    // This is a simplified PnL calculation
    // In a real implementation, you'd track entry price and current position
    const entryPrice = data.open;
    const currentPrice = data.ltp;
    const lots = type === 'CE' ? config.ceLots : config.peLots;
    const quantity = lots * 75; // Default lot size, should be dynamic based on selectedIndex
    
    const pnl = (currentPrice - entryPrice) * quantity;
    const percentage = entryPrice > 0 ? (pnl / (entryPrice * quantity)) * 100 : 0;
    
    return { pnl, percentage };
  };

  const triggerStatus = getTriggerStatus();
  const pnlData = calculatePnL();

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {type} Strategy Monitoring
        </h3>
        <div className={`px-2 py-1 rounded-full text-xs font-medium ${
          triggerStatus.status === 'TRIGGERED' 
            ? 'bg-success-100 text-success-700' 
            : triggerStatus.status === 'WAITING'
            ? 'bg-warning-100 text-warning-700'
            : 'bg-gray-100 text-gray-700'
        }`}>
          {triggerStatus.status}
        </div>
      </div>

      {!data ? (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-8 h-8 mx-auto mb-2" />
          <p>No {type} data available</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Current LTP */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">Current LTP:</span>
            <span className="text-lg font-bold text-gray-900">
              ₹{data.ltp.toFixed(2)}
            </span>
          </div>

          {/* HMA-55 Value */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">HMA-55 Value:</span>
            <span className="text-lg font-bold text-gray-900">
              {hmaValue ? `₹${hmaValue.toFixed(2)}` : 'N/A'}
            </span>
          </div>

          {/* Trigger Status */}
          <div className="p-3 rounded-md border ${
            triggerStatus.status === 'TRIGGERED' 
              ? 'bg-success-50 border-success-200' 
              : triggerStatus.status === 'WAITING'
              ? 'bg-warning-50 border-warning-200'
              : 'bg-gray-50 border-gray-200'
          }">
            <div className="flex items-center space-x-2">
              {triggerStatus.status === 'TRIGGERED' ? (
                <CheckCircle className="w-4 h-4 text-success-500" />
              ) : (
                <AlertCircle className="w-4 h-4 text-warning-500" />
              )}
              <span className="text-sm font-medium">
                {triggerStatus.message}
              </span>
            </div>
          </div>

          {/* Entry & Exit Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700">Entry Price:</span>
              <div className="text-lg font-bold text-gray-900">
                ₹{data.open.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Quantity:</span>
              <div className="text-lg font-bold text-gray-900">
                {(type === 'CE' ? config.ceLots : config.peLots) * 75} {/* Should be dynamic based on selectedIndex */}
              </div>
            </div>
          </div>

          {/* Target & SL */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm font-medium text-gray-700">Target:</span>
              <div className="text-lg font-bold text-success-600">
                ₹{(data.open + config.targetPoints).toFixed(2)}
              </div>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700">Stop Loss:</span>
              <div className="text-lg font-bold text-danger-600">
                ₹{(data.open - config.stopLossPoints).toFixed(2)}
              </div>
            </div>
          </div>

          {/* PnL */}
          {pnlData && (
            <div className="p-3 rounded-md border border-gray-200">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Real-time PnL:</span>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    pnlData.pnl >= 0 ? 'text-success-600' : 'text-danger-600'
                  }`}>
                    ₹{pnlData.pnl.toFixed(2)}
                  </div>
                  <div className={`text-sm ${
                    pnlData.percentage >= 0 ? 'text-success-500' : 'text-danger-500'
                  }`}>
                    {pnlData.percentage >= 0 ? '+' : ''}{pnlData.percentage.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Additional Data */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">High:</span>
              <div className="font-medium">₹{data.high.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-600">Low:</span>
              <div className="font-medium">₹{data.low.toFixed(2)}</div>
            </div>
            <div>
              <span className="text-gray-600">Volume:</span>
              <div className="font-medium">{data.volume.toLocaleString()}</div>
            </div>
            <div>
              <span className="text-gray-600">OI:</span>
              <div className="font-medium">{data.openInterest.toLocaleString()}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}; 