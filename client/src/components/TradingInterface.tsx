import React, { useState, useEffect, useCallback } from 'react';
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
  RefreshCw,
  PlayCircle,
  StopCircle,
  Trash
} from 'lucide-react';
import { HeaderStatus, TradeLog, TradeConfig, HMAConfig, ContractInputs } from '../types';
import { SymbolConfigService, INDEX_CONFIGS } from '../services/symbolConfig';
import { HMAService } from '../services/hmaService';
import { LiveMarketDataService } from '../services/liveMarketDataService';
import { MarketDataService } from '../services/marketDataService';
import { StrategyMonitoringCard } from './StrategyMonitoringCard';
import { TradingService } from '../services/tradingService';
import { MultiSymbolMonitoringService } from '../services/multiSymbolMonitoringService';

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
  
  const [contractInputs, setContractInputs] = useState<ContractInputs>({
    ceSymbol: '',
    peSymbol: '',
    ceLots: 1,
    peLots: 1,
    targetPoints: 50,
    stopLossPoints: 30,
    entryMethod: 'MARKET',
    // Initialize new strategy options with default values
    autoExitOnTarget: true,
    autoExitOnStopLoss: true,
    trailingStopLoss: false,
    trailingStopLossOffset: 10,
    timeBasedExit: false,
    exitAtMarketClose: false,
    exitAfterMinutes: 60
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
      setContractInputs(prev => ({ ...prev, index: config }));
      onStatusUpdate({ selectedIndex: indexKey });
    }
  };

  const fetchHMAData = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      // Fetch historical data for both symbols
      const [ceData, peData] = await Promise.all([
        MarketDataService.getHistoricalData(contractInputs.ceSymbol, '5'),
        MarketDataService.getHistoricalData(contractInputs.peSymbol, '5')
      ]);

      // Calculate HMA for both using the new method
      const ceHMAConfig = await HMAService.fetchAndCalculateHMA(contractInputs.ceSymbol);
      const peHMAConfig = await HMAService.fetchAndCalculateHMA(contractInputs.peSymbol);

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

  const handleAddToMonitoring = async () => {
    try {
      setIsLoading(true);
      
      console.log('🚀 Adding contracts to monitoring...');
      
      await Promise.all([
        MultiSymbolMonitoringService.addSymbolToMonitoring(
          contractInputs.ceSymbol,
          'CE',
          contractInputs.ceLots,
          contractInputs.targetPoints,
          contractInputs.stopLossPoints,
          contractInputs.entryMethod,
          contractInputs.autoExitOnTarget,
          contractInputs.autoExitOnStopLoss,
          contractInputs.trailingStopLoss,
          contractInputs.trailingStopLossOffset,
          contractInputs.timeBasedExit,
          contractInputs.exitAtMarketClose,
          contractInputs.exitAfterMinutes
        ),
        MultiSymbolMonitoringService.addSymbolToMonitoring(
          contractInputs.peSymbol,
          'PE',
          contractInputs.peLots,
          contractInputs.targetPoints,
          contractInputs.stopLossPoints,
          contractInputs.entryMethod,
          contractInputs.autoExitOnTarget,
          contractInputs.autoExitOnStopLoss,
          contractInputs.trailingStopLoss,
          contractInputs.trailingStopLossOffset,
          contractInputs.timeBasedExit,
          contractInputs.exitAtMarketClose,
          contractInputs.exitAfterMinutes
        )
      ]);
      
      onStatusUpdate({ monitoringStatus: 'ON' });
      console.log('✅ Contracts added to monitoring successfully');
      
    } catch (error) {
      console.error('❌ Error adding contracts to monitoring:', error);
    } finally {
      setIsLoading(false);
    }
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
              value={Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === contractInputs.index.name) || ''}
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
              value={contractInputs.ceSymbol}
              onChange={(e) => setContractInputs(prev => ({ ...prev, ceSymbol: e.target.value }))}
              className="input-field"
              placeholder="e.g., NSE:NIFTY24500CE"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">PE Symbol</label>
            <input
              type="text"
              value={contractInputs.peSymbol}
              onChange={(e) => setContractInputs(prev => ({ ...prev, peSymbol: e.target.value }))}
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
                  Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === contractInputs.index.name) || 'NIFTY', 
                  contractInputs.ceLots
                )} qty)
              </span>
            </label>
            <input
              type="number"
              value={contractInputs.ceLots}
              onChange={(e) => setContractInputs(prev => ({ ...prev, ceLots: parseInt(e.target.value) || 1 }))}
              className="input-field"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              PE Lots 🔥
              <span className="text-xs text-gray-500 ml-1">
                ({SymbolConfigService.calculateQuantityFromLots(
                  Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === contractInputs.index.name) || 'NIFTY', 
                  contractInputs.peLots
                )} qty)
              </span>
            </label>
            <input
              type="number"
              value={contractInputs.peLots}
              onChange={(e) => setContractInputs(prev => ({ ...prev, peLots: parseInt(e.target.value) || 1 }))}
              className="input-field"
              min="1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Entry Method</label>
            <select
              value={contractInputs.entryMethod}
              onChange={(e) => setContractInputs(prev => ({ ...prev, entryMethod: e.target.value as 'MARKET' | 'LIMIT' }))}
              className="input-field"
            >
              <option value="MARKET">Market</option>
              <option value="LIMIT">Limit</option>
            </select>
          </div>
        </div>

        {/* Target and Stop Loss */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Target Points</label>
            <input
              type="number"
              value={contractInputs.targetPoints}
              onChange={(e) => setContractInputs(prev => ({ ...prev, targetPoints: parseInt(e.target.value) || 0 }))}
              className="input-field"
              min="0"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Stop Loss Points</label>
            <input
              type="number"
              value={contractInputs.stopLossPoints}
              onChange={(e) => setContractInputs(prev => ({ ...prev, stopLossPoints: parseInt(e.target.value) || 0 }))}
              className="input-field"
              min="0"
            />
          </div>
        </div>

        {/* Auto Exit Options */}
        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Exit Strategy Settings</h4>
          
          <div className="space-y-3">
            {/* Auto Exit Toggles */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Auto Exit on Target</label>
              <div className="relative inline-block w-10 align-middle select-none">
                <input 
                  type="checkbox" 
                  checked={contractInputs.autoExitOnTarget}
                  onChange={(e) => setContractInputs(prev => ({ ...prev, autoExitOnTarget: e.target.checked }))}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Auto Exit on Stop Loss</label>
              <div className="relative inline-block w-10 align-middle select-none">
                <input 
                  type="checkbox" 
                  checked={contractInputs.autoExitOnStopLoss}
                  onChange={(e) => setContractInputs(prev => ({ ...prev, autoExitOnStopLoss: e.target.checked }))}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
              </div>
            </div>
            
            {/* Trailing Stop Loss */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Trailing Stop Loss</label>
              <div className="relative inline-block w-10 align-middle select-none">
                <input 
                  type="checkbox" 
                  checked={contractInputs.trailingStopLoss}
                  onChange={(e) => setContractInputs(prev => ({ ...prev, trailingStopLoss: e.target.checked }))}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
              </div>
            </div>
            
            {contractInputs.trailingStopLoss && (
              <div className="pl-4 border-l-2 border-gray-200">
                <label className="block text-sm text-gray-700 mb-1">Trailing Offset (points)</label>
                <input
                  type="number"
                  value={contractInputs.trailingStopLossOffset}
                  onChange={(e) => setContractInputs(prev => ({ ...prev, trailingStopLossOffset: parseInt(e.target.value) || 5 }))}
                  className="input-field"
                  min="1"
                />
              </div>
            )}
            
            {/* Time-based Exit */}
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700">Time-based Exit</label>
              <div className="relative inline-block w-10 align-middle select-none">
                <input 
                  type="checkbox" 
                  checked={contractInputs.timeBasedExit}
                  onChange={(e) => setContractInputs(prev => ({ ...prev, timeBasedExit: e.target.checked }))}
                  className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
              </div>
            </div>
            
            {contractInputs.timeBasedExit && (
              <div className="pl-4 border-l-2 border-gray-200 space-y-3">
                <div>
                  <label className="block text-sm text-gray-700 mb-1">Exit after (minutes)</label>
                  <input
                    type="number"
                    value={contractInputs.exitAfterMinutes}
                    onChange={(e) => setContractInputs(prev => ({ ...prev, exitAfterMinutes: parseInt(e.target.value) || 30 }))}
                    className="input-field"
                    min="1"
                  />
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={contractInputs.exitAtMarketClose}
                    onChange={(e) => setContractInputs(prev => ({ ...prev, exitAtMarketClose: e.target.checked }))}
                    className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm text-gray-700">Exit at market close (3:30 PM)</label>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
          <button
            onClick={fetchHMAData}
            className="btn-primary flex items-center gap-2"
            disabled={isLoading || !contractInputs.ceSymbol || !contractInputs.peSymbol}
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
              onClick={handleAddToMonitoring}
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
          symbol={contractInputs.ceSymbol}
          hmaConfig={ceHMA}
          quantity={SymbolConfigService.calculateQuantityFromLots(
            Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === contractInputs.index.name) || 'NIFTY', 
            contractInputs.ceLots
          )}
          targetPoints={contractInputs.targetPoints}
          stopLossPoints={contractInputs.stopLossPoints}
          isMonitoring={headerStatus.monitoringStatus === 'ON'}
          onTradeLog={onTradeLog}
          liveData={liveData.ceData}
        />
        
        <StrategyMonitoringCard
          title="PE Contract"
          symbol={contractInputs.peSymbol}
          hmaConfig={peHMA}
          quantity={SymbolConfigService.calculateQuantityFromLots(
            Object.keys(INDEX_CONFIGS).find(key => INDEX_CONFIGS[key].name === contractInputs.index.name) || 'NIFTY', 
            contractInputs.peLots
          )}
          targetPoints={contractInputs.targetPoints}
          stopLossPoints={contractInputs.stopLossPoints}
          isMonitoring={headerStatus.monitoringStatus === 'ON'}
          onTradeLog={onTradeLog}
          liveData={liveData.peData}
        />
      </div>
    </div>
  );
}; 