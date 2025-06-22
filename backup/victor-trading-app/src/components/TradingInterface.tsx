import React, { useState, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Square, 
  Download, 
  Lock, 
  Unlock
} from 'lucide-react';
import { 
  IndexType, 
  TradeConfig, 
  TradeStatus, 
  MarketData, 
  HMAData,
  OptionContract 
} from '../types';
import { MarketDataService } from '../services/marketDataService';
import { HMAService } from '../services/hmaService';
import { SymbolConfigService } from '../services/symbolConfig';
import { StrategyMonitoringCard } from './StrategyMonitoringCard';

interface TradingInterfaceProps {
  selectedIndex: IndexType;
  isMonitoring: boolean;
  isOpenPriceLocked: boolean;
  tradeEngineStatus: 'RUNNING' | 'PAUSED' | 'STOPPED';
  onMonitoringToggle: (isMonitoring: boolean) => void;
  onTradeEngineStatusChange: (status: 'RUNNING' | 'PAUSED' | 'STOPPED') => void;
  onOpenPriceLock: (isLocked: boolean) => void;
}

export const TradingInterface: React.FC<TradingInterfaceProps> = ({
  selectedIndex,
  isMonitoring,
  isOpenPriceLocked,
  tradeEngineStatus,
  onMonitoringToggle,
  onTradeEngineStatusChange,
  onOpenPriceLock
}) => {
  const [tradeConfig, setTradeConfig] = useState<TradeConfig>({
    ceSymbol: '',
    peSymbol: '',
    ceLots: 1,
    peLots: 1,
    targetPoints: 50,
    stopLossPoints: 25,
    entryMethod: 'MARKET'
  });

  const [tradeStatus, setTradeStatus] = useState<TradeStatus>({
    isMonitoring: false,
    isEngineRunning: false
  });

  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [hmaData, setHmaData] = useState<HMAData[]>([]);
  const [ceData, setCeData] = useState<OptionContract | null>(null);
  const [peData, setPeData] = useState<OptionContract | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const marketDataService = MarketDataService.getInstance();

  useEffect(() => {
    if (!isMonitoring) return;

    const fetchMarketData = async () => {
      try {
        const result = await marketDataService.getMarketData(selectedIndex);
        if (result.success && result.data) {
          setMarketData(result.data);
        }
      } catch (err) {
        console.error('Error fetching market data:', err);
      }
    };

    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60000);

    return () => clearInterval(interval);
  }, [isMonitoring, selectedIndex]);

  const handleFetchHMAData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await marketDataService.fetchHistoricalData(selectedIndex, '5min', 55);
      if (result.success && result.data) {
        setHmaData(result.data);
        console.log('HMA data fetched successfully');
      } else {
        setError(result.error || 'Failed to fetch HMA data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch HMA data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLockOpenPrice = async () => {
    setIsLoading(true);
    setError('');

    try {
      const result = await marketDataService.getMarketData(selectedIndex);
      if (result.success && result.data) {
        setMarketData(result.data);
        onOpenPriceLock(true);
        
        const atmStrike = SymbolConfigService.calculateATMStrike(result.data.index.price, selectedIndex);
        const expiry = SymbolConfigService.getExpiryDate(selectedIndex);
        
        const ceSymbol = SymbolConfigService.generateOptionSymbol(selectedIndex, atmStrike, 'CE', expiry);
        const peSymbol = SymbolConfigService.generateOptionSymbol(selectedIndex, atmStrike, 'PE', expiry);
        
        setTradeConfig(prev => ({
          ...prev,
          ceSymbol,
          peSymbol
        }));
      } else {
        setError(result.error || 'Failed to fetch open prices');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch open prices');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMonitoring = async () => {
    if (!tradeConfig.ceSymbol || !tradeConfig.peSymbol) {
      setError('Please enter CE and PE symbols');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await marketDataService.getOptionData([tradeConfig.ceSymbol, tradeConfig.peSymbol]);
      if (result.success && result.data) {
        const ceData = result.data[tradeConfig.ceSymbol];
        const peData = result.data[tradeConfig.peSymbol];
        
        if (ceData) setCeData(ceData);
        if (peData) setPeData(peData);
        
        setTradeStatus(prev => ({
          ...prev,
          isMonitoring: true,
          isEngineRunning: true
        }));
        
        onMonitoringToggle(true);
        onTradeEngineStatusChange('RUNNING');
      } else {
        setError('Failed to fetch option data');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start monitoring');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopMonitoring = () => {
    setTradeStatus(prev => ({
      ...prev,
      isMonitoring: false,
      isEngineRunning: false
    }));
    onMonitoringToggle(false);
    onTradeEngineStatusChange('STOPPED');
  };

  const getLatestHMAValue = (): number | null => {
    if (hmaData.length === 0) return null;
    return HMAService.getLatestHMAValue(hmaData);
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Index & Mode Selector</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trading Mode
            </label>
            <div className="flex space-x-2">
              <button className="btn-secondary flex-1">Paper Trade</button>
              <button className="btn-primary flex-1">Live Trade</button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Engine Status
            </label>
            <div className="flex space-x-2">
              <button
                onClick={() => onTradeEngineStatusChange('RUNNING')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${
                  tradeEngineStatus === 'RUNNING' 
                    ? 'bg-success-100 text-success-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Running
              </button>
              <button
                onClick={() => onTradeEngineStatusChange('PAUSED')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${
                  tradeEngineStatus === 'PAUSED' 
                    ? 'bg-warning-100 text-warning-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Paused
              </button>
              <button
                onClick={() => onTradeEngineStatusChange('STOPPED')}
                className={`flex-1 px-3 py-2 rounded-md text-sm font-medium ${
                  tradeEngineStatus === 'STOPPED' 
                    ? 'bg-danger-100 text-danger-700' 
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                Stopped
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Contract Setup & HMA Configuration (Lots-Based) 🔥</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-md">
            <p className="text-danger-700 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CE Symbol</label>
            <input
              type="text"
              value={tradeConfig.ceSymbol}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, ceSymbol: e.target.value }))}
              className="input-field"
              placeholder="e.g., NSE:NIFTY24500CE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PE Symbol</label>
            <input
              type="text"
              value={tradeConfig.peSymbol}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, peSymbol: e.target.value }))}
              className="input-field"
              placeholder="e.g., NSE:NIFTY24500PE"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">CE Lots 🔥</label>
            <input
              type="number"
              value={tradeConfig.ceLots}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, ceLots: parseInt(e.target.value) || 1 }))}
              className="input-field"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              ({SymbolConfigService.calculateQuantityFromLots(tradeConfig.ceLots, selectedIndex)} qty)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PE Lots 🔥</label>
            <input
              type="number"
              value={tradeConfig.peLots}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, peLots: parseInt(e.target.value) || 1 }))}
              className="input-field"
              min="1"
            />
            <p className="text-xs text-gray-500 mt-1">
              ({SymbolConfigService.calculateQuantityFromLots(tradeConfig.peLots, selectedIndex)} qty)
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Entry Method</label>
            <select
              value={tradeConfig.entryMethod}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, entryMethod: e.target.value as 'MARKET' | 'LIMIT' }))}
              className="input-field"
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target (Points)</label>
            <input
              type="number"
              value={tradeConfig.targetPoints}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, targetPoints: parseInt(e.target.value) || 0 }))}
              className="input-field"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Stop Loss (Points)</label>
            <input
              type="number"
              value={tradeConfig.stopLossPoints}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, stopLossPoints: parseInt(e.target.value) || 0 }))}
              className="input-field"
              min="0"
            />
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleFetchHMAData}
            disabled={isLoading}
            className="btn-secondary flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Fetch HMA Data</span>
          </button>
          
          <button
            onClick={handleLockOpenPrice}
            disabled={isLoading || isOpenPriceLocked}
            className="btn-secondary flex items-center space-x-2"
          >
            {isOpenPriceLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            <span>{isOpenPriceLocked ? 'Open Price Locked' : 'Lock Open Price'}</span>
          </button>
          
          <button
            onClick={isMonitoring ? handleStopMonitoring : handleStartMonitoring}
            disabled={isLoading}
            className="btn-primary flex items-center space-x-2"
          >
            {isMonitoring ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isMonitoring ? 'Stop Monitoring' : 'Start Monitoring'}</span>
          </button>
        </div>

        {hmaData.length > 0 && (
          <div className="mt-4 p-3 bg-primary-50 border border-primary-200 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-primary-700">
                HMA-55 Value: {getLatestHMAValue()?.toFixed(2) || 'N/A'}
              </span>
              <span className="text-xs text-primary-600">
                Last updated: {hmaData[hmaData.length - 1]?.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StrategyMonitoringCard
          type="CE"
          data={ceData}
          hmaValue={getLatestHMAValue()}
          marketData={marketData}
          config={tradeConfig}
        />
        <StrategyMonitoringCard
          type="PE"
          data={peData}
          hmaValue={getLatestHMAValue()}
          marketData={marketData}
          config={tradeConfig}
        />
      </div>
    </div>
  );
}; 