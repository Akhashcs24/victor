import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AuthPanel } from './components/AuthPanel';
import { MonitoringDashboard } from './components/MonitoringDashboard';
import { ActiveTradesTable } from './components/ActiveTradesTable';
import { TradeLog } from './components/TradeLog';
import { AllLogsPage } from './components/AllLogsPage';
import { 
  HeaderStatus, 
  ContractInputs,
  TradingState
} from './types';
import { AuthService } from './services/authService';
import { LiveMarketDataService, LiveMarketData } from './services/liveMarketDataService';
import { SymbolConfigService } from './services/symbolConfig';
import { TradingService } from './services/tradingService';
import { MultiSymbolMonitoringService } from './services/multiSymbolMonitoringService';
import { BackgroundService } from './services/backgroundService';
import { FixedSymbolService, StrikeSymbol } from './services/fixedSymbolService';
import { MarketService } from './services/marketService';
import { MarketDepthCard } from './components/MarketDepthCard';

function App() {
  const [headerStatus, setHeaderStatus] = useState<HeaderStatus>({
    authStatus: 'UNAUTHENTICATED',
    tokenValid: false,
    selectedIndex: 'NIFTY',
    monitoringStatus: 'OFF',
    tradeEngineStatus: 'STOPPED',
    apiHealth: 'DOWN',
    lastTradeTime: null
  });

  const [tradingState, setTradingState] = useState<TradingState>(TradingService.getTradingState());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileFetched, setProfileFetched] = useState(false);
  const [showAllLogs, setShowAllLogs] = useState(false);

  // Market data state
  const [marketData, setMarketData] = useState<Map<string, LiveMarketData>>(new Map());
  const [isLoadingMarketData, setIsLoadingMarketData] = useState(false);

  // Strike symbols state
  const [ceStrikeSymbols, setCeStrikeSymbols] = useState<StrikeSymbol[]>([]);
  const [peStrikeSymbols, setPeStrikeSymbols] = useState<StrikeSymbol[]>([]);

  // Services
  const marketDataService = new LiveMarketDataService();

  // Authentication status
  const isAuthenticated = headerStatus.authStatus === 'AUTHENTICATED' && headerStatus.tokenValid;

  // Update trading state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setTradingState(TradingService.getTradingState());
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Periodic token refresh to prevent expiration during live sessions
  useEffect(() => {
    if (isAuthenticated) {
      const tokenRefreshInterval = setInterval(async () => {
        try {
          // Use comprehensive authentication check
          const authStatus = await AuthService.checkAuthenticationStatus();
          
          if (!authStatus.isAuthenticated) {
            console.log('❌ Authentication check failed during refresh:', authStatus.message);
            
            if (authStatus.requiresFreshAuth) {
              console.log('🔄 Fresh authentication required - forcing logout');
              setError('Fresh authentication required after 8 AM IST. Please login again.');
              updateHeaderStatus();
            } else {
              updateHeaderStatus();
            }
          } else {
            console.log('✅ Authentication is still valid');
          }
        } catch (error) {
          console.error('❌ Token refresh check failed:', error);
          updateHeaderStatus();
        }
      }, 10 * 60 * 1000); // Check every 10 minutes

      return () => clearInterval(tokenRefreshInterval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // This effect runs once on component mount to set the initial header state
    checkAuthAndInitialize();
    
    const initializeServices = async () => {
      try {
        // Initialize TradingService with persistent logs
        await TradingService.initialize();
        
        // Stop any old monitoring from TradingService to prevent conflicts
        TradingService.stopMonitoring();
        
        // Initialize MultiSymbolMonitoringService
        MultiSymbolMonitoringService.initialize();
        
        // Initialize BackgroundService to keep app active
        BackgroundService.initialize();
        
        // Initialize Live P&L Tracking Service
        const { LivePnLTrackingService } = await import('./services/livePnLTrackingService');
        await LivePnLTrackingService.startTracking();
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    };
    
    initializeServices();
    
    // Cleanup function to stop all monitoring when component unmounts
    return () => {
      TradingService.stopMonitoring();
      MultiSymbolMonitoringService.stopMonitoring();
      BackgroundService.cleanup();
      
      // Stop P&L tracking
      import('./services/livePnLTrackingService').then(({ LivePnLTrackingService }) => {
        LivePnLTrackingService.stopTracking();
      });
    };
  }, []);

  const updateHeaderStatus = () => {
    const profile = AuthService.getProfile();
    const isMonitoring = TradingService.isCurrentlyMonitoring();
    
    setHeaderStatus(prev => ({
      ...prev,
      authStatus: AuthService.isAuthenticated() ? 'AUTHENTICATED' : 'UNAUTHENTICATED',
      tokenValid: AuthService.isAuthenticated(),
      apiHealth: 'HEALTHY', // Assuming healthy for now
      profileName: profile?.name || prev.profileName,
      monitoringStatus: isMonitoring ? 'ON' : 'OFF',
      tradeEngineStatus: isMonitoring ? 'RUNNING' : 'STOPPED'
    }));
  };

  const fetchUserProfile = async () => {
    if (profileFetched) return; // Prevent multiple fetches
    
    try {
      const result = await AuthService.getUserProfile();
      if (result.success && result.profile?.name) {
        setHeaderStatus(prev => ({ ...prev, profileName: result.profile!.name }));
      }
      setProfileFetched(true);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setProfileFetched(true); // Mark as fetched even on error to prevent retries
    }
  };

  const handleAuthSuccess = async () => {
    updateHeaderStatus();
    await fetchUserProfile();
  };

  const checkAuthAndInitialize = async () => {
      console.log('🚀 Initializing Victor Trading App...');
      
      try {
        // Use comprehensive authentication check
        const authStatus = await AuthService.checkAuthenticationStatus();
        
        if (authStatus.isAuthenticated) {
          console.log('✅ Authentication is valid');
        updateHeaderStatus();
          
          // Fetch user profile
          await fetchUserProfile();
        } else {
          console.log('❌ Authentication check failed:', authStatus.message);
          
          if (authStatus.requiresFreshAuth) {
            console.log('🔄 Fresh authentication required - forcing logout');
          updateHeaderStatus();
            
            // Show a notification to the user about fresh auth requirement
            setError('Fresh authentication required after 8 AM IST. Please login again.');
          } else {
          updateHeaderStatus();
          }
        }
      } catch (error) {
        console.error('❌ Error during app initialization:', error);
      updateHeaderStatus();
        setError('Failed to initialize app. Please refresh and try again.');
      }
    };

  const handleLogout = () => {
    AuthService.logout();
    updateHeaderStatus();
  };

  // Load option chain when index changes
  const handleIndexChange = async (index: string) => {
    TradingService.updateSelectedIndex(index);
    setHeaderStatus(prev => ({ ...prev, selectedIndex: index }));
    setTradingState(TradingService.getTradingState());
    
    // Clear existing strike symbols
    setCeStrikeSymbols([]);
    setPeStrikeSymbols([]);
    
    // Generate strike symbols if we have market data for the selected index
    await fixedSymbolService (index);
  };

  // Fetch market data for all indices
  const fetchMarketData = async () => {
    if (!isAuthenticated || isLoadingMarketData) return;
    
    setIsLoadingMarketData(true);
    try {
      const symbols = marketDataService.getIndexSymbols();
      const data = await marketDataService.fetchMultipleMarketData(symbols);
      setMarketData(data);
      
      // Generate strike symbols for the selected index if we have data
      if (data.size > 0) {
        await fixedSymbolService (headerStatus.selectedIndex);
      }
    } catch (error) {
      console.error('Error fetching market data:', error);
    } finally {
      setIsLoadingMarketData(false);
    }
  };

  // Generate strike symbols for the selected index
  const fixedSymbolService  = async (index: string) => {
    const indexSymbol = getIndexSymbol(index);
    const marketDataForIndex = marketData.get(indexSymbol);
    
    console.log(`🔍 Looking for market data for ${index} (symbol: ${indexSymbol})`);
    console.log(`📊 Available market data keys:`, Array.from(marketData.keys()));
    console.log(`📊 Market data for ${indexSymbol}:`, marketDataForIndex);
    
    if (!marketDataForIndex || !marketDataForIndex.open) {
      console.log(`No market data available for ${index}`);
      return;
    }

    // Generate strike symbols
    const result = FixedSymbolService.fixedSymbolService (
      index,
      marketDataForIndex.open
    );

    setCeStrikeSymbols(result.ce);
    setPeStrikeSymbols(result.pe);
    
    console.log(`Generated ${result.ce.length} CE and ${result.pe.length} PE strike symbols for ${index}`);
    console.log(`Sample CE symbols:`, result.ce.slice(0, 3).map(s => s.symbol));
    console.log(`Sample PE symbols:`, result.pe.slice(0, 3).map(s => s.symbol));
  };

  // Get index symbol for market data lookup
  const getIndexSymbol = (index: string): string => {
    const symbolMap: { [key: string]: string } = {
      'NIFTY': 'NSE:NIFTY50-INDEX',
      'BANKNIFTY': 'NSE:NIFTYBANK-INDEX',
      'SENSEX': 'BSE:SENSEX-INDEX'
    };
    return symbolMap[index] || index;
  };

  // Fetch market data when authenticated with intelligent interval management
  useEffect(() => {
    let marketDataInterval: NodeJS.Timeout | null = null;
    
    if (isAuthenticated) {
      const marketStatus = MarketService.getMarketStatus();
      console.log(`📊 Market Status: ${marketStatus.status} (${marketStatus.isOpen ? 'OPEN' : 'CLOSED'})`);
      
      if (marketStatus.timeToOpen) {
        console.log(`⏰ Market opens in: ${marketStatus.timeToOpen}`);
      }
      
      // Fetch data immediately
      fetchMarketData();
      
      // Set up interval based on market status
      const fetchInterval = MarketService.getDataFetchInterval();
      
      if (fetchInterval > 0) {
        console.log(`🔄 Setting up market data refresh every ${fetchInterval / 1000} seconds (market is open)`);
        marketDataInterval = setInterval(fetchMarketData, fetchInterval);
      } else {
        console.log('⏸️ Market is closed - no periodic data fetching');
      }
    }
    
    // Cleanup function
    return () => {
      if (marketDataInterval) {
        clearInterval(marketDataInterval);
        marketDataInterval = null;
        console.log('🛑 Market data interval cleared');
      }
    };
  }, [isAuthenticated]);

  // Generate strike symbols when market data changes
  useEffect(() => {
    if (marketData.size > 0) {
      fixedSymbolService (headerStatus.selectedIndex);
    }
  }, [marketData, headerStatus.selectedIndex]);

  // Trading dashboard handlers
  const handleContractInputChange = async (field: keyof ContractInputs, value: any) => {
    try {
      // Clear HMA cache and monitor data when symbols change
      if (field === 'ceSymbol' || field === 'peSymbol') {
        const currentState = TradingService.getTradingState();
        const oldSymbol = field === 'ceSymbol' ? currentState.contractInputs.ceSymbol : currentState.contractInputs.peSymbol;
        
        // Always reset monitor state when symbol changes (even if going from empty to selected)
        const contractType = field === 'ceSymbol' ? 'CE' : 'PE';
        TradingService.resetMonitorState(contractType);
        console.log(`🔄 Reset ${contractType} monitor state for symbol change`);
        
        if (oldSymbol && oldSymbol !== value) {
          console.log(`🔄 Symbol changed from ${oldSymbol} to ${value}, clearing HMA cache...`);
          // Clear cache for the old symbol
          const { HMAService } = await import('./services/hmaService');
          HMAService.clearCache(oldSymbol);
        }
      }
      
      await TradingService.updateContractInputs({ [field]: value });
      setTradingState(TradingService.getTradingState());
      
      // Log HMA cache stats for debugging
      const cacheStats = TradingService.getHMACacheStats();
      console.log('📊 HMA Cache Stats:', cacheStats);
    } catch (error) {
      console.error('Error updating contract inputs:', error);
    }
  };

  const handleFetchHMAData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('🚀 Starting HMA calculation and live data fetch...');
      
      // Fetch HMA data first
      await TradingService.fetchHMAData();
      console.log('✅ HMA data fetched successfully');
      
      // Also fetch live market data for the selected symbols
      const { ceSymbol, peSymbol } = tradingState.contractInputs;
      const symbolsToFetch = [];
      
      if (ceSymbol) symbolsToFetch.push(ceSymbol);
      if (peSymbol) symbolsToFetch.push(peSymbol);
      
      if (symbolsToFetch.length > 0) {
        console.log('📊 Fetching live market data for selected symbols...');
        const liveData = await marketDataService.fetchMultipleMarketData(symbolsToFetch);
        
                 // Update the trading state with live data
         if (ceSymbol && liveData.has(ceSymbol)) {
           const ceData = liveData.get(ceSymbol)!;
           TradingService.updateMonitorData('CE', ceData.ltp);
         }
         
         if (peSymbol && liveData.has(peSymbol)) {
           const peData = liveData.get(peSymbol)!;
           TradingService.updateMonitorData('PE', peData.ltp);
         }
        console.log('✅ Live market data updated successfully');
      }
      
      // Refresh the state
      setTradingState(TradingService.getTradingState());
      
      // Log cache stats after fetching
      const cacheStats = TradingService.getHMACacheStats();
      console.log('📊 HMA Cache Stats after fetch:', cacheStats);
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      console.error('❌ Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToMonitoring = async () => {
    const { 
      ceSymbol, 
      peSymbol, 
      ceLots, 
      peLots, 
      targetPoints, 
      stopLossPoints, 
      entryMethod,
      autoExitOnTarget,
      autoExitOnStopLoss,
      trailingStopLoss,
      trailingStopLossOffset,
      timeBasedExit,
      exitAtMarketClose,
      exitAfterMinutes,
      targetType,
      stopLossType
    } = tradingState.contractInputs;
    
    if (!ceSymbol && !peSymbol) {
      setError('Please select at least one option symbol (CE or PE) to monitor');
      return;
    }

    setIsLoading(true);
    try {
      const promises = [];
      
      if (ceSymbol) {
        promises.push(
          MultiSymbolMonitoringService.addSymbolToMonitoring(
            ceSymbol, 
            'CE', 
            ceLots, 
            targetPoints, 
            stopLossPoints, 
            entryMethod,
            autoExitOnTarget,
            autoExitOnStopLoss,
            trailingStopLoss,
            trailingStopLossOffset,
            timeBasedExit,
            exitAtMarketClose,
            exitAfterMinutes,
            targetType || 'POINTS',
            stopLossType || 'POINTS'
          )
        );
      }
      
      if (peSymbol) {
        promises.push(
          MultiSymbolMonitoringService.addSymbolToMonitoring(
            peSymbol, 
            'PE', 
            peLots, 
            targetPoints, 
            stopLossPoints, 
            entryMethod,
            autoExitOnTarget,
            autoExitOnStopLoss,
            trailingStopLoss,
            trailingStopLossOffset,
            timeBasedExit,
            exitAtMarketClose,
            exitAfterMinutes,
            targetType || 'POINTS',
            stopLossType || 'POINTS'
          )
        );
      }
      
      await Promise.all(promises);
      
      console.log('✅ Symbols added to monitoring successfully');
      
      // Clear the entire strategy setup after adding to monitoring
      TradingService.updateContractInputs({
        ceSymbol: '',
        peSymbol: '',
        ceLots: 1,
        peLots: 1,
        targetPoints: 50,
        stopLossPoints: 30,
        entryMethod: 'MARKET',
        autoExitOnTarget: true,
        autoExitOnStopLoss: true,
        trailingStopLoss: false,
        trailingStopLossOffset: 10,
        timeBasedExit: false,
        exitAtMarketClose: false,
        exitAfterMinutes: 60,
        targetType: 'POINTS',
        stopLossType: 'POINTS'
      });
      
      // Also clear the monitor states to reset the option details cards
      TradingService.resetMonitorState('CE');
      TradingService.resetMonitorState('PE');
      
      setTradingState(TradingService.getTradingState());
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add symbols to monitoring');
      console.error('❌ Error adding symbols to monitoring:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartMonitoring = () => {
    TradingService.startMonitoring();
    updateHeaderStatus();
  };

  const handleStopMonitoring = () => {
    // First stop TradingService monitoring
    TradingService.stopMonitoring();
    
    // Then completely clear MultiSymbolMonitoringService
    // Import directly from the service
    const { MultiSymbolMonitoringService } = require('./services/multiSymbolMonitoringService');
    MultiSymbolMonitoringService.clearAllMonitoring();
    
    // Clear the contract inputs to reset the UI
    TradingService.updateContractInputs({
      ceSymbol: '',
      peSymbol: '',
      ceLots: 1,
      peLots: 1,
      targetPoints: 50,
      stopLossPoints: 30,
      entryMethod: 'MARKET',
      autoExitOnTarget: true,
      autoExitOnStopLoss: true,
      trailingStopLoss: false,
      trailingStopLossOffset: 10,
      timeBasedExit: false,
      exitAtMarketClose: false,
      exitAfterMinutes: 60,
      targetType: 'POINTS',
      stopLossType: 'POINTS'
    });
    
    // Update the trading state to reflect changes
    setTradingState(TradingService.getTradingState());
    
    // Update header status
    updateHeaderStatus();
    
    console.log('🛑 All monitoring stopped from UI');
  };

  const handleTradingModeChange = (mode: 'PAPER' | 'LIVE') => {
    TradingService.updateTradingMode(mode);
    setTradingState(TradingService.getTradingState());
  };

  const handleStatusUpdate = (updates: Partial<HeaderStatus>) => {
    setHeaderStatus(prev => ({ ...prev, ...updates }));
  };

  const handleManualExit = (tradeId: string, exitPrice: number) => {
    TradingService.manualExit(tradeId, exitPrice);
    setTradingState(TradingService.getTradingState());
  };

  return (
          <div className="min-h-screen bg-slate-50">
              {isAuthenticated && <Header status={headerStatus} onStatusUpdate={handleStatusUpdate} onLogout={handleLogout} />}
      
      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                {error}
              </p>
              {error.includes('Fresh authentication required') && (
                <div className="mt-2">
                  <button
                    onClick={() => {
                      setError(null);
                      handleLogout();
                      window.location.reload();
                    }}
                    className="text-sm text-red-600 hover:text-red-500 underline"
                  >
                    Click here to login again
                  </button>
                </div>
              )}
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setError(null)}
                  className="inline-flex bg-red-50 rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-red-50 focus:ring-red-600"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className={`${isAuthenticated ? 'container mx-auto px-4 py-8' : ''}`}>
        {!isAuthenticated ? (
          <AuthPanel onAuthSuccess={handleAuthSuccess} />
        ) : (
          <div className="space-y-8">
            {/* Top Index Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <MarketDepthCard
                data={marketData.get('NSE:NIFTY50-INDEX') || null}
                isLoading={isLoadingMarketData}
                symbol="NSE:NIFTY50-INDEX"
                displayName="NIFTY 50"
                onRetry={fetchMarketData}
              />
              <MarketDepthCard
                data={marketData.get('NSE:NIFTYBANK-INDEX') || null}
                isLoading={isLoadingMarketData}
                symbol="NSE:NIFTYBANK-INDEX"
                displayName="Bank Nifty"
                onRetry={fetchMarketData}
              />
              <MarketDepthCard
                data={marketData.get('BSE:SENSEX-INDEX') || null}
                isLoading={isLoadingMarketData}
                symbol="BSE:SENSEX-INDEX"
                displayName="SENSEX"
                onRetry={fetchMarketData}
              />
            </div>
            
            {/* Main Grid: Strategy Setup and Monitors */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Strategy Setup spans 2 columns */}
              <div className="md:col-span-2">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-full flex flex-col">
                  <h3 className="text-xl font-semibold text-slate-900 mb-6 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Strategy Setup
                    </div>
                    
                    {/* Trading Mode moved to top right */}
                    <div className="flex items-center">
                      <div className={`px-3 py-1 rounded-md text-sm font-medium transition-colors mr-2 ${
                        tradingState.tradingMode === 'PAPER' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'text-slate-500'
                      }`}>
                        📊 Paper
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tradingState.tradingMode === 'LIVE'}
                          onChange={(e) => handleTradingModeChange(e.target.checked ? 'LIVE' : 'PAPER')}
                          className="sr-only peer"
                        />
                        <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                      </label>
                      <div className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ml-2 ${
                        tradingState.tradingMode === 'LIVE' 
                          ? 'bg-green-100 text-green-700' 
                          : 'text-slate-500'
                      }`}>
                        🚀 Live
                      </div>
                    </div>
                  </h3>
                  
                  {/* Index & Mode Selector */}
                  <div className="mb-6">
                    <h4 className="text-lg font-medium text-slate-800 mb-4">Index & Mode Selection</h4>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Selected Index</label>
                      <select 
                        value={headerStatus.selectedIndex}
                        onChange={(e) => handleIndexChange(e.target.value)}
                        className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors appearance-none cursor-pointer text-slate-900 font-medium"
                        style={{
                          backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                          backgroundPosition: 'right 0.75rem center',
                          backgroundRepeat: 'no-repeat',
                          backgroundSize: '1.5em 1.5em',
                          paddingRight: '2.5rem'
                        }}
                      >
                        <option value="NIFTY">Nifty 50</option>
                        <option value="BANKNIFTY">Bank Nifty</option>
                        <option value="SENSEX">Sensex</option>
                      </select>
                    </div>
                    
                    {/* Mode Description */}
                    <div className="mt-2 text-xs text-slate-600">
                      {tradingState.tradingMode === 'PAPER' ? (
                        <span>📊 <strong>Paper Trading:</strong> Simulated trades for testing strategies without real money</span>
                      ) : (
                        <span>🚀 <strong>Live Trading:</strong> Real orders will be sent to Fyers when criteria are met</span>
                      )}
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="border-t border-slate-200 my-6"></div>
                  
                  {/* Contract Input & HMA Fetch */}
                  <div>
                    <h4 className="text-lg font-medium text-slate-800 mb-4">Contract Setup & HMA Configuration</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                      {/* CE Options */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">🔥 CE Lots</label>
                        <div className="flex gap-2">
                          <select
                            value={tradingState.contractInputs.ceSymbol}
                            onChange={(e) => handleContractInputChange('ceSymbol', e.target.value)}
                            className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors appearance-none cursor-pointer text-slate-900"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.75rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1.5em 1.5em',
                              paddingRight: '2.5rem'
                            }}
                          >
                            <option value="">Select CE Option</option>
                            {ceStrikeSymbols.map((option) => (
                              <option key={option.symbol} value={option.symbol}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input 
                            type="number" 
                            placeholder="1"
                            min="1"
                            value={tradingState.contractInputs.ceLots}
                            onChange={(e) => handleContractInputChange('ceLots', parseInt(e.target.value) || 1)}
                            className="w-20 px-3 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors text-slate-900 placeholder-slate-500"
                            title="Number of lots"
                          />
                        </div>
                        {tradingState.contractInputs.ceSymbol && (
                          <p className="text-xs text-slate-500 mt-1">
                            ({SymbolConfigService.calculateQuantityFromLots(headerStatus.selectedIndex, tradingState.contractInputs.ceLots)} qty)
                          </p>
                        )}
                      </div>

                      {/* PE Options */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">🔥 PE Lots</label>
                        <div className="flex gap-2">
                          <select
                            value={tradingState.contractInputs.peSymbol}
                            onChange={(e) => handleContractInputChange('peSymbol', e.target.value)}
                            className="flex-1 px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors appearance-none cursor-pointer text-slate-900"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.75rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1.5em 1.5em',
                              paddingRight: '2.5rem'
                            }}
                          >
                            <option value="">Select PE Option</option>
                            {peStrikeSymbols.map((option) => (
                              <option key={option.symbol} value={option.symbol}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <input 
                            type="number" 
                            placeholder="1"
                            min="1"
                            value={tradingState.contractInputs.peLots}
                            onChange={(e) => handleContractInputChange('peLots', parseInt(e.target.value) || 1)}
                            className="w-20 px-3 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors text-slate-900 placeholder-slate-500"
                            title="Number of lots"
                          />
                        </div>
                        {tradingState.contractInputs.peSymbol && (
                          <p className="text-xs text-slate-500 mt-1">
                            ({SymbolConfigService.calculateQuantityFromLots(headerStatus.selectedIndex, tradingState.contractInputs.peLots)} qty)
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Additional Configuration */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      {/* Target with dropdown for points/percentage */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Target</label>
                        <div className="flex gap-2">
                          <select
                            value={tradingState.contractInputs.targetType || 'POINTS'}
                            onChange={(e) => handleContractInputChange('targetType', e.target.value as 'POINTS' | 'PERCENTAGE')}
                            className="w-1/3 px-2 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors appearance-none cursor-pointer text-slate-900 text-xs"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.5rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1em 1em',
                              paddingRight: '1.5rem'
                            }}
                          >
                            <option value="POINTS">Points</option>
                            <option value="PERCENTAGE">%</option>
                          </select>
                          <input 
                            type="number" 
                            placeholder="50"
                            value={tradingState.contractInputs.targetPoints}
                            onChange={(e) => handleContractInputChange('targetPoints', parseInt(e.target.value) || 0)}
                            className="w-2/3 px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors text-slate-900 placeholder-slate-500"
                          />
                        </div>
                      </div>

                      {/* Stop Loss with dropdown for points/percentage */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Stop Loss</label>
                        <div className="flex gap-2">
                          <select
                            value={tradingState.contractInputs.stopLossType || 'POINTS'}
                            onChange={(e) => handleContractInputChange('stopLossType', e.target.value as 'POINTS' | 'PERCENTAGE')}
                            className="w-1/3 px-2 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors appearance-none cursor-pointer text-slate-900 text-xs"
                            style={{
                              backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                              backgroundPosition: 'right 0.5rem center',
                              backgroundRepeat: 'no-repeat',
                              backgroundSize: '1em 1em',
                              paddingRight: '1.5rem'
                            }}
                          >
                            <option value="POINTS">Points</option>
                            <option value="PERCENTAGE">%</option>
                          </select>
                          <input 
                            type="number" 
                            placeholder="30"
                            value={tradingState.contractInputs.stopLossPoints}
                            onChange={(e) => handleContractInputChange('stopLossPoints', parseInt(e.target.value) || 0)}
                            className="w-2/3 px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors text-slate-900 placeholder-slate-500"
                          />
                        </div>
                      </div>

                      {/* Entry Method */}
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Entry Method</label>
                        <select 
                          value={tradingState.contractInputs.entryMethod}
                          onChange={(e) => handleContractInputChange('entryMethod', e.target.value as 'MARKET' | 'LIMIT')}
                          className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 hover:border-slate-400 transition-colors appearance-none cursor-pointer text-slate-900 font-medium"
                          style={{
                            backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e")`,
                            backgroundPosition: 'right 0.75rem center',
                            backgroundRepeat: 'no-repeat',
                            backgroundSize: '1.5em 1.5em',
                            paddingRight: '2.5rem'
                          }}
                        >
                          <option value="MARKET">Market</option>
                          <option value="LIMIT">Limit</option>
                        </select>
                      </div>
                    </div>

                    {/* Exit Strategy Settings - Removed grey background and title, arranged in 3 columns */}
                    <div className="mb-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Auto Exit on Target */}
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-700">Auto Exit on Target</label>
                          <div className="relative inline-block w-10 align-middle select-none">
                            <input 
                              type="checkbox" 
                              checked={tradingState.contractInputs.autoExitOnTarget ?? true}
                              onChange={(e) => handleContractInputChange('autoExitOnTarget', e.target.checked)}
                              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            />
                            <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                          </div>
                        </div>
                        
                        {/* Auto Exit on Stop Loss */}
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-700">Auto Exit on Stop Loss</label>
                          <div className="relative inline-block w-10 align-middle select-none">
                            <input 
                              type="checkbox" 
                              checked={tradingState.contractInputs.autoExitOnStopLoss ?? true}
                              onChange={(e) => handleContractInputChange('autoExitOnStopLoss', e.target.checked)}
                              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            />
                            <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                          </div>
                        </div>
                        
                        {/* Time-based Exit */}
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-700">Time-based Exit</label>
                          <div className="relative inline-block w-10 align-middle select-none">
                            <input 
                              type="checkbox" 
                              checked={tradingState.contractInputs.timeBasedExit ?? false}
                              onChange={(e) => handleContractInputChange('timeBasedExit', e.target.checked)}
                              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            />
                            <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                          </div>
                        </div>
                      </div>
                      
                      {/* Conditional inputs based on toggle states */}
                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {/* Trailing Stop Loss */}
                        <div className="flex items-center justify-between">
                          <label className="text-sm text-slate-700">Trailing Stop Loss</label>
                          <div className="relative inline-block w-10 align-middle select-none">
                            <input 
                              type="checkbox" 
                              checked={tradingState.contractInputs.trailingStopLoss ?? false}
                              onChange={(e) => handleContractInputChange('trailingStopLoss', e.target.checked)}
                              className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                            />
                            <label className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
                          </div>
                        </div>
                        
                        {tradingState.contractInputs.trailingStopLoss && (
                          <div className="col-span-1 sm:col-span-2 md:col-span-2">
                            <label className="block text-sm text-slate-700 mb-1">Trailing Offset (points)</label>
                            <input
                              type="number"
                              value={tradingState.contractInputs.trailingStopLossOffset ?? 10}
                              onChange={(e) => handleContractInputChange('trailingStopLossOffset', parseInt(e.target.value) || 5)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              min="1"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Time-based Exit Options */}
                      {tradingState.contractInputs.timeBasedExit && (
                        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm text-slate-700 mb-1">Exit after (minutes)</label>
                            <input
                              type="number"
                              value={tradingState.contractInputs.exitAfterMinutes ?? 60}
                              onChange={(e) => handleContractInputChange('exitAfterMinutes', parseInt(e.target.value) || 30)}
                              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                              min="1"
                            />
                          </div>
                          
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={tradingState.contractInputs.exitAtMarketClose ?? false}
                              onChange={(e) => handleContractInputChange('exitAtMarketClose', e.target.checked)}
                              className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label className="ml-2 text-sm text-slate-700">Exit at market close (3:30 PM)</label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex flex-wrap gap-3 justify-end">
                      <button 
                        onClick={handleFetchHMAData}
                        disabled={isLoading || !tradingState.contractInputs.ceSymbol || !tradingState.contractInputs.peSymbol}
                        className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg shadow-sm hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12 2 2m0 0l7 12L6 7l5-5L2 2Z" />
                            </svg>
                            Get Data
                          </>
                        )}
                      </button>
                      
                      <button 
                        onClick={handleAddToMonitoring}
                        disabled={isLoading || (!tradingState.contractInputs.ceSymbol && !tradingState.contractInputs.peSymbol)}
                        className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white font-semibold rounded-lg shadow-sm hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center gap-2"
                      >
                        {isLoading ? (
                          <>
                            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Adding...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Monitor & Trade
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* CE/PE Monitors stacked in 3rd column */}
              <div className="flex flex-col gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-[calc(50%-12px)] flex flex-col">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Call Option Details</h3>
                  {tradingState.contractInputs.ceSymbol ? (
                    <div className="space-y-3 flex-grow">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Symbol:</span>
                        <span className="font-semibold text-slate-900 text-xs">
                          {tradingState.contractInputs.ceSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Current LTP:</span>
                        <span className="font-semibold text-slate-900">
                          {tradingState.ceMonitor.currentLTP ? `₹${tradingState.ceMonitor.currentLTP.toFixed(2)}` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">HMA-55 Value:</span>
                        <span className="font-semibold text-slate-900">
                          {tradingState.ceMonitor.hmaValue ? `₹${tradingState.ceMonitor.hmaValue.toFixed(2)}` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Trigger Status:</span>
                        <span className={`font-semibold ${
                          tradingState.ceMonitor.triggerStatus === 'WAITING' ? 'text-yellow-600' :
                          tradingState.ceMonitor.triggerStatus === 'ENTERED' ? 'text-green-600' :
                          tradingState.ceMonitor.triggerStatus === 'EXITED' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {tradingState.ceMonitor.triggerStatus}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Entry Price:</span>
                        <span className="font-semibold text-slate-900">
                          {tradingState.ceMonitor.entryPrice ? `₹${tradingState.ceMonitor.entryPrice.toFixed(2)}` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">P&L:</span>
                        <span className={`font-semibold ${
                          tradingState.ceMonitor.pnl && tradingState.ceMonitor.pnl > 0 ? 'text-green-600' :
                          tradingState.ceMonitor.pnl && tradingState.ceMonitor.pnl < 0 ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          {tradingState.ceMonitor.pnl ? `₹${tradingState.ceMonitor.pnl.toFixed(2)}` : '--'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 flex-grow flex flex-col items-center justify-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm">No call option selected</p>
                      <p className="text-xs text-slate-400 mt-1">Select a CE symbol and click "Get Data"</p>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 h-[calc(50%-12px)] flex flex-col">
                  <h3 className="text-lg font-semibold text-slate-900 mb-4">Put Option Details</h3>
                  {tradingState.contractInputs.peSymbol ? (
                    <div className="space-y-3 flex-grow">
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Symbol:</span>
                        <span className="font-semibold text-slate-900 text-xs">
                          {tradingState.contractInputs.peSymbol}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Current LTP:</span>
                        <span className="font-semibold text-slate-900">
                          {tradingState.peMonitor.currentLTP ? `₹${tradingState.peMonitor.currentLTP.toFixed(2)}` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">HMA-55 Value:</span>
                        <span className="font-semibold text-slate-900">
                          {tradingState.peMonitor.hmaValue ? `₹${tradingState.peMonitor.hmaValue.toFixed(2)}` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Trigger Status:</span>
                        <span className={`font-semibold ${
                          tradingState.peMonitor.triggerStatus === 'WAITING' ? 'text-yellow-600' :
                          tradingState.peMonitor.triggerStatus === 'ENTERED' ? 'text-green-600' :
                          tradingState.peMonitor.triggerStatus === 'EXITED' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {tradingState.peMonitor.triggerStatus}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">Entry Price:</span>
                        <span className="font-semibold text-slate-900">
                          {tradingState.peMonitor.entryPrice ? `₹${tradingState.peMonitor.entryPrice.toFixed(2)}` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">P&L:</span>
                        <span className={`font-semibold ${
                          tradingState.peMonitor.pnl && tradingState.peMonitor.pnl > 0 ? 'text-green-600' :
                          tradingState.peMonitor.pnl && tradingState.peMonitor.pnl < 0 ? 'text-red-600' : 'text-slate-900'
                        }`}>
                          {tradingState.peMonitor.pnl ? `₹${tradingState.peMonitor.pnl.toFixed(2)}` : '--'}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500 flex-grow flex flex-col items-center justify-center">
                      <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-sm">No put option selected</p>
                      <p className="text-xs text-slate-400 mt-1">Select a PE symbol and click "Get Data"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Monitoring Dashboard */}
            <MonitoringDashboard onUpdate={() => {
              // Force re-render to show updated monitoring list
              setTradingState(prev => ({ ...prev }));
            }} />

            {/* Active Trades Table */}
            <ActiveTradesTable onUpdate={() => {
              // Force re-render to show updated trades
              setTradingState(prev => ({ ...prev }));
            }} />

            {/* Trade Log */}
            <TradeLog 
              logs={tradingState.tradeLogs} 
              onViewAllLogs={() => setShowAllLogs(true)}
              onManualExit={handleManualExit}
            />
          </div>
        )}
      </main>
      
      {/* All Logs Page Modal/Overlay */}
      {showAllLogs && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full h-full sm:rounded-2xl sm:shadow-2xl sm:w-full sm:max-w-7xl sm:max-h-[90vh] sm:h-auto overflow-hidden">
            <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg sm:text-2xl font-bold text-slate-900">All Trade Logs</h2>
              <button
                onClick={() => setShowAllLogs(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto h-full sm:max-h-[calc(90vh-80px)]">
              <AllLogsPage onClose={() => setShowAllLogs(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
  }
  
export default App; 