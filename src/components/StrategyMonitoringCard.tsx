import React, { useState, useEffect } from 'react';
import { 
  Target, 
  AlertTriangle, 
  DollarSign,
  Activity
} from 'lucide-react';
import { HMAConfig, TradeLog, TradeStatus } from '../types';
import { HMAService } from '../services/hmaService';

interface StrategyMonitoringCardProps {
  title: string;
  symbol: string;
  hmaConfig: HMAConfig | null;
  quantity: number;
  targetPoints: number;
  stopLossPoints: number;
  isMonitoring: boolean;
  onTradeLog: (log: TradeLog) => void;
  liveData?: {
    ltp: number;
    hma: number;
    lastUpdate: Date;
  } | null;
}

export const StrategyMonitoringCard: React.FC<StrategyMonitoringCardProps> = ({
  title,
  symbol,
  hmaConfig,
  quantity,
  targetPoints,
  stopLossPoints,
  isMonitoring,
  onTradeLog,
  liveData
}) => {
  const [currentLTP, setCurrentLTP] = useState<number | null>(null);
  const [tradeStatus, setTradeStatus] = useState<TradeStatus>({
    isActive: false,
    entryPrice: 0,
    currentPrice: 0,
    targetPrice: 0,
    stopLossPrice: 0,
    quantity: 0,
    pnl: 0,
    entryTime: null,
    exitTime: null,
    status: 'WAITING'
  });
  const [lastCandleClose, setLastCandleClose] = useState<number | null>(null);

  // Update current LTP when live data changes
  useEffect(() => {
    if (liveData) {
      setCurrentLTP(liveData.ltp);
      setTradeStatus(prev => ({ ...prev, currentPrice: liveData.ltp }));
      
      // Check for HMA crossover
      if (hmaConfig && lastCandleClose !== null) {
        const crossover = HMAService.detectCrossover(liveData.ltp, lastCandleClose, hmaConfig.currentHMA);
        
        if (crossover === 'ABOVE' && tradeStatus.status === 'WAITING') {
          // Trigger entry
          const entryPrice = liveData.ltp;
          const targetPrice = entryPrice + targetPoints;
          const stopLossPrice = entryPrice - stopLossPoints;
          
          setTradeStatus({
            isActive: true,
            entryPrice,
            currentPrice: liveData.ltp,
            targetPrice,
            stopLossPrice,
            quantity,
            pnl: 0,
            entryTime: new Date(),
            exitTime: null,
            status: 'ENTERED'
          });

          // Log trade entry
          onTradeLog({
            id: `trade_${Date.now()}`,
            timestamp: new Date(),
            symbol,
            action: 'BUY',
            quantity,
            price: entryPrice,
            orderType: 'MARKET',
            status: 'COMPLETED',
            remarks: 'HMA crossover entry',
            tradingMode: 'PAPER'
          });
        }
      }
      
      setLastCandleClose(liveData.ltp);
    }
  }, [liveData, hmaConfig, lastCandleClose, tradeStatus.status, quantity, targetPoints, stopLossPoints, onTradeLog, symbol]);

  useEffect(() => {
    if (tradeStatus.isActive && currentLTP !== null) {
      // Check for target or stop loss
      if (currentLTP >= tradeStatus.targetPrice && tradeStatus.status === 'ENTERED') {
        // Target hit
        const pnl = (currentLTP - tradeStatus.entryPrice) * quantity;
        setTradeStatus(prev => ({
          ...prev,
          status: 'TARGET_HIT',
          exitTime: new Date(),
          pnl
        }));

        onTradeLog({
          id: `trade_${Date.now()}`,
          timestamp: new Date(),
          symbol,
          action: 'SELL',
          quantity,
          price: currentLTP,
          orderType: 'LIMIT',
          status: 'COMPLETED',
          pnl,
          remarks: 'Target hit',
          tradingMode: 'PAPER'
        });
      } else if (currentLTP <= tradeStatus.stopLossPrice && tradeStatus.status === 'ENTERED') {
        // Stop loss hit
        const pnl = (currentLTP - tradeStatus.entryPrice) * quantity;
        setTradeStatus(prev => ({
          ...prev,
          status: 'SL_HIT',
          exitTime: new Date(),
          pnl
        }));

        onTradeLog({
          id: `trade_${Date.now()}`,
          timestamp: new Date(),
          symbol,
          action: 'SELL',
          quantity,
          price: currentLTP,
          orderType: 'LIMIT',
          status: 'COMPLETED',
          pnl,
          remarks: 'Stop loss hit',
          tradingMode: 'PAPER'
        });
      } else if (tradeStatus.status === 'ENTERED') {
        // Update PnL
        const pnl = (currentLTP - tradeStatus.entryPrice) * quantity;
        setTradeStatus(prev => ({ ...prev, pnl }));
      }
    }
  }, [currentLTP, tradeStatus, quantity, onTradeLog, symbol]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'WAITING': return 'text-gray-500';
      case 'ENTERED': return 'text-blue-600';
      case 'TARGET_HIT': return 'text-success-600';
      case 'SL_HIT': return 'text-danger-600';
      default: return 'text-gray-500';
    }
  };

  const getPnLColor = (pnl: number) => {
    return pnl >= 0 ? 'text-success-600' : 'text-danger-600';
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        <div className={`flex items-center space-x-1 ${getStatusColor(tradeStatus.status)}`}>
          <Activity className="w-4 h-4" />
          <span className="text-sm font-medium">{tradeStatus.status}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Symbol and HMA */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Symbol</label>
            <div className="text-sm text-gray-900 font-mono">{symbol || 'Not set'}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">HMA-55</label>
            <div className="text-sm text-gray-900">
              {hmaConfig ? hmaConfig.currentHMA.toFixed(2) : 'Not calculated'}
            </div>
          </div>
        </div>

        {/* Current LTP */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Current LTP</label>
          <div className="text-lg font-bold text-gray-900">
            {currentLTP ? `₹${currentLTP.toFixed(2)}` : 'Loading...'}
          </div>
        </div>

        {/* Trade Info */}
        {tradeStatus.isActive && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Entry Price</label>
                <div className="text-sm text-gray-900">₹{tradeStatus.entryPrice.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <div className="text-sm text-gray-900">{tradeStatus.quantity}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <Target className="w-3 h-3 mr-1" />
                  Target
                </label>
                <div className="text-sm text-success-600">₹{tradeStatus.targetPrice.toFixed(2)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Stop Loss
                </label>
                <div className="text-sm text-danger-600">₹{tradeStatus.stopLossPrice.toFixed(2)}</div>
              </div>
            </div>

            {/* PnL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
                <DollarSign className="w-3 h-3 mr-1" />
                P&L
              </label>
              <div className={`text-lg font-bold ${getPnLColor(tradeStatus.pnl)}`}>
                ₹{tradeStatus.pnl.toFixed(2)}
              </div>
            </div>

            {/* Timestamps */}
            <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
              {tradeStatus.entryTime && (
                <div>
                  <span>Entry: {tradeStatus.entryTime.toLocaleTimeString()}</span>
                </div>
              )}
              {tradeStatus.exitTime && (
                <div>
                  <span>Exit: {tradeStatus.exitTime.toLocaleTimeString()}</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* Monitoring Status */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-sm text-gray-600">Monitoring</span>
          <div className={`flex items-center space-x-1 ${isMonitoring ? 'text-success-600' : 'text-gray-400'}`}>
            <div className={`w-2 h-2 rounded-full ${isMonitoring ? 'bg-success-500 animate-pulse' : 'bg-gray-300'}`}></div>
            <span className="text-sm">{isMonitoring ? 'Active' : 'Inactive'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}; 