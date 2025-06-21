import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Download, 
  Lock, 
  Play, 
  Pause, 
  Square,
  Target,
  AlertTriangle,
  Settings,
  RefreshCw
} from 'lucide-react';
import { HeaderStatus, TradeLog, TradeConfig, HMAConfig } from '../types';
import { SymbolConfigService, INDEX_CONFIGS } from '../services/symbolConfig';
import { HMAService } from '../services/hmaService';
import { LiveMarketDataService } from '../services/liveMarketDataService';
import { MarketDataService } from '../services/marketDataService';
import { StrategyMonitoringCard } from './StrategyMonitoringCard';
import { TradingService } from '../services/tradingService';

interface TradingInterfaceProps {
  headerStatus: HeaderStatus;
  onStatusUpdate: (updates: Partial<HeaderStatus>) => void;
  onTradeLog: (log: TradeLog) => void;
}

export const TradingInterface: React.FC<TradingInterfaceProps> = ({
  headerStatus,
  onStatusUpdate,
  onTradeLog
}) => {
  const indexConfigs = SymbolConfigService.getAllIndexConfigs();
  
  const [tradeConfig, setTradeConfig] = useState<TradeConfig>({
    index: indexConfigs[0],
    ceSymbol: '',
    peSymbol: '',
    ceLots: 1,
    peLots: 1,
    targetPoints: 50,
    stopLossPoints: 30,
    entryMethod: 'MARKET'
  });

  const [ceHMA, setCeHMA] = useState<HMAConfig | null>(null);
  const [peHMA, setPeHMA] = useState<HMAConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [liveData, setLiveData] = useState<{
    ceData: { ltp: number; hma: number; lastUpdate: Date } | null;
    peData: { ltp: number; hma: number; lastUpdate: Date } | null;
  }>({ ceData: null, peData: null });

  // Update live data periodically when monitoring is active
  useEffect(() => {
    if (headerStatus.monitoringStatus === 'ON') {
      const interval = setInterval(() => {
        const data = TradingService.getLiveDataForMonitoring();
        setLiveData(data);
      }, 5000); // Update every 5 seconds

      return () => clearInterval(interval);
    }
  }, [headerStatus.monitoringStatus]);

  const handleIndexChange = (indexKey: string) => {
    const config = SymbolConfigService.getIndexConfig(indexKey);
    if (config) {
      setTradeConfig(prev => ({ ...prev, index: config }));
      onStatusUpdate({ selectedIndex: indexKey });
    }
  };

  const fetchHMAData = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Fetch historical data for both symbols
      const [ceData, peData] = await Promise.all([
        MarketDataService.getHistoricalData(tradeConfig.ceSymbol, '5'),
        MarketDataService.getHistoricalData(tradeConfig.peSymbol, '5')
      ]);

      // Calculate HMA for both using the new method
      const ceHMAConfig = await HMAService.fetchAndCalculateHMA(tradeConfig.ceSymbol);
      const peHMAConfig = await HMAService.fetchAndCalculateHMA(tradeConfig.peSymbol);

      setCeHMA(ceHMAConfig);
      setPeHMA(peHMAConfig);
      setMessage({ type: 'success', text: 'HMA data fetched successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to fetch HMA data: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsLoading(false);
    }
  };

  const lockOpenPrices = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      const marketDataService = new LiveMarketDataService();
      const indexSymbols = marketDataService.getIndexSymbols();
      const openPricesData = await marketDataService.fetchMultipleMarketData(indexSymbols);
      
      // Store open prices (you might want to add this to your state)
      console.log('Open prices locked:', openPricesData);
      
      // onStatusUpdate({ openPriceLocked: true }); // Removed as not part of HeaderStatus interface
      setMessage({ type: 'success', text: 'Open prices locked successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: `Failed to lock open prices: ${error instanceof Error ? error.message : 'Unknown error'}` });
    } finally {
      setIsLoading(false);
    }
  };

  const startMonitoring = () => {
    if (!ceHMA || !peHMA) {
      setMessage({ type: 'error', text: 'Please fetch HMA data first' });
      return;
    }

    onStatusUpdate({ 
      monitoringStatus: 'ON',
      tradeEngineStatus: 'RUNNING'
    });
    setMessage({ type: 'success', text: 'Monitoring started' });
  };

  const stopMonitoring = () => {
    onStatusUpdate({ 
      monitoringStatus: 'OFF',
      tradeEngineStatus: 'STOPPED'
    });
    setMessage({ type: 'success', text: 'Monitoring stopped' });
  };

  return (
    <div className="space-y-6">
      {/* Index & Mode Selector */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Index & Mode Selection</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <TrendingUp className="w-4 h-4 inline mr-1" />
              Select Index
            </label>
            <select
              value={Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === tradeConfig.index.name) || ''}
              onChange={(e) => handleIndexChange(e.target.value)}
              className="input-field"
            >
              {Object.entries(INDEX_CONFIGS).map(([key, config]) => (
                <option key={key} value={key}>
                  {config.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Trading Mode</label>
            <div className="flex space-x-4">
              <label className="flex items-center">
                <input type="radio" name="mode" value="paper" className="mr-2" defaultChecked />
                Paper Trade
              </label>
              <label className="flex items-center">
                <input type="radio" name="mode" value="live" className="mr-2" />
                Live Trade
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* Contract Input & HMA Fetch */}
      <div className="card">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Contract Setup & HMA Configuration (Lots-Based)</h3>
        
        {message && (
          <div className={`mb-4 p-3 rounded-lg ${
            message.type === 'success' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
          }`}>
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">CE Symbol</label>
            <input
              type="text"
              value={tradeConfig.ceSymbol}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, ceSymbol: e.target.value }))}
              className="input-field"
              placeholder="e.g., NSE:NIFTY24500CE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">PE Symbol</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              CE Lots 🔥
              <span className="text-xs text-gray-500 ml-1">
                ({SymbolConfigService.calculateQuantityFromLots(
                  Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === tradeConfig.index.name) || 'NIFTY', 
                  tradeConfig.ceLots
                )} qty)
              </span>
            </label>
            <input
              type="number"
              value={tradeConfig.ceLots}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, ceLots: parseInt(e.target.value) || 1 }))}
              className="input-field"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PE Lots 🔥
              <span className="text-xs text-gray-500 ml-1">
                ({SymbolConfigService.calculateQuantityFromLots(
                  Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === tradeConfig.index.name) || 'NIFTY', 
                  tradeConfig.peLots
                )} qty)
              </span>
            </label>
            <input
              type="number"
              value={tradeConfig.peLots}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, peLots: parseInt(e.target.value) || 1 }))}
              className="input-field"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entry Method</label>
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
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Target className="w-4 h-4 inline mr-1" />
              Target (Points)
            </label>
            <input
              type="number"
              value={tradeConfig.targetPoints}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, targetPoints: parseInt(e.target.value) || 0 }))}
              className="input-field"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <AlertTriangle className="w-4 h-4 inline mr-1" />
              Stop Loss (Points)
            </label>
            <input
              type="number"
              value={tradeConfig.stopLossPoints}
              onChange={(e) => setTradeConfig(prev => ({ ...prev, stopLossPoints: parseInt(e.target.value) || 0 }))}
              className="input-field"
              min="0"
            />
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
          <button
            onClick={fetchHMAData}
            className="btn-primary flex items-center gap-2"
            disabled={isLoading || !tradeConfig.ceSymbol || !tradeConfig.peSymbol}
          >
            <Download className="w-4 h-4" />
            Fetch HMA Data
          </button>

          <button
            onClick={lockOpenPrices}
            className="btn-secondary flex items-center gap-2"
            disabled={isLoading}
          >
            <Lock className="w-4 h-4" />
            Lock Open Price
          </button>

          {headerStatus.monitoringStatus === 'OFF' ? (
            <button
              onClick={startMonitoring}
              className="btn-success flex items-center gap-2"
              disabled={!ceHMA || !peHMA}
            >
              <Play className="w-4 h-4" />
              Start Monitoring
            </button>
          ) : (
            <button
              onClick={stopMonitoring}
              className="btn-danger flex items-center gap-2"
            >
              <Square className="w-4 h-4" />
              Stop Monitoring
            </button>
          )}
        </div>
      </div>

      {/* Strategy Monitoring Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StrategyMonitoringCard
          title="CE Contract"
          symbol={tradeConfig.ceSymbol}
          hmaConfig={ceHMA}
          quantity={SymbolConfigService.calculateQuantityFromLots(
            Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === tradeConfig.index.name) || 'NIFTY', 
            tradeConfig.ceLots
          )}
          targetPoints={tradeConfig.targetPoints}
          stopLossPoints={tradeConfig.stopLossPoints}
          isMonitoring={headerStatus.monitoringStatus === 'ON'}
          onTradeLog={onTradeLog}
          liveData={liveData.ceData}
        />
        
        <StrategyMonitoringCard
          title="PE Contract"
          symbol={tradeConfig.peSymbol}
          hmaConfig={peHMA}
          quantity={SymbolConfigService.calculateQuantityFromLots(
            Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === tradeConfig.index.name) || 'NIFTY', 
            tradeConfig.peLots
          )}
          targetPoints={tradeConfig.targetPoints}
          stopLossPoints={tradeConfig.stopLossPoints}
          isMonitoring={headerStatus.monitoringStatus === 'ON'}
          onTradeLog={onTradeLog}
          liveData={liveData.peData}
        />
      </div>
    </div>
  );
}; 