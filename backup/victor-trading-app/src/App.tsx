import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AuthPanel } from './components/AuthPanel';
import { TradingInterface } from './components/TradingInterface';
import { TradeLog } from './components/TradeLog';
import { AllLogsPage } from './components/AllLogsPage';
import { AuthService } from './services/authService';
import { TradeLogService } from './services/tradeLogService';
import { HeaderStatus, AuthStatus, IndexType, TradeLog as TradeLogType } from './types';

function App() {
  const [headerStatus, setHeaderStatus] = useState<HeaderStatus>({
    authStatus: {
      isAuthenticated: false,
      isValid: false
    },
    selectedIndex: 'NIFTY',
    isMonitoring: false,
    isOpenPriceLocked: false,
    tradeEngineStatus: 'STOPPED',
    apiHealth: 'DOWN'
  });

  const [showAuthPanel, setShowAuthPanel] = useState(true);
  const [todayTradeLogs, setTodayTradeLogs] = useState<TradeLogType[]>([]);
  const [showAllLogs, setShowAllLogs] = useState(false);

  useEffect(() => {
    // Check for existing authentication on app start
    const authService = AuthService.getInstance();
    const auth = authService.getLastAuthentication();
    
    if (auth) {
      setHeaderStatus(prev => ({
        ...prev,
        authStatus: authService.getAuthStatus()
      }));
      setShowAuthPanel(false);
    }

    // Load today's trade logs
    loadTodayTradeLogs();

    // Set up periodic token validation
    const interval = setInterval(async () => {
      if (auth) {
        const isValid = await authService.verifyToken(auth.appId, auth.accessToken);
        setHeaderStatus(prev => ({
          ...prev,
          authStatus: {
            ...prev.authStatus,
            isValid,
            lastChecked: new Date()
          }
        }));
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  const loadTodayTradeLogs = () => {
    const logs = TradeLogService.getTodayTradeLogs();
    setTodayTradeLogs(logs);
  };

  // Function to add a new trade log (to be called by trading logic)
  const addTradeLog = (trade: Omit<TradeLogType, 'id' | 'timestamp'>) => {
    const newLog = TradeLogService.addTradeLog(trade);
    setTodayTradeLogs(prev => [newLog, ...prev]);
  };

  // Demo function to add sample trades (for testing when market is closed)
  const addSampleTrade = () => {
    const sampleTrades = [
      {
        symbol: 'NSE:NIFTY25JAN25000CE',
        action: 'ENTRY' as const,
        price: 125.50,
        quantity: 75,
        pnl: undefined,
        exitReason: undefined
      },
      {
        symbol: 'NSE:NIFTY25JAN25000CE',
        action: 'EXIT' as const,
        price: 142.75,
        quantity: 75,
        pnl: 1293.75,
        exitReason: 'TARGET' as const
      },
      {
        symbol: 'NSE:BANKNIFTY25JAN51000PE',
        action: 'ENTRY' as const,
        price: 89.25,
        quantity: 30,
        pnl: undefined,
        exitReason: undefined
      },
      {
        symbol: 'NSE:BANKNIFTY25JAN51000PE',
        action: 'EXIT' as const,
        price: 67.50,
        quantity: 30,
        pnl: -652.50,
        exitReason: 'STOP_LOSS' as const
      }
    ];

    const randomTrade = sampleTrades[Math.floor(Math.random() * sampleTrades.length)];
    addTradeLog(randomTrade);
  };

  const handleAuthSuccess = (authStatus: AuthStatus) => {
    setHeaderStatus(prev => ({
      ...prev,
      authStatus
    }));
    setShowAuthPanel(false);
  };

  const handleIndexChange = (index: IndexType) => {
    setHeaderStatus(prev => ({
      ...prev,
      selectedIndex: index
    }));
  };

  const handleMonitoringToggle = (isMonitoring: boolean) => {
    setHeaderStatus(prev => ({
      ...prev,
      isMonitoring
    }));
  };

  const handleTradeEngineStatusChange = (status: 'RUNNING' | 'PAUSED' | 'STOPPED') => {
    setHeaderStatus(prev => ({
      ...prev,
      tradeEngineStatus: status
    }));
  };

  const handleOpenPriceLock = (isLocked: boolean) => {
    setHeaderStatus(prev => ({
      ...prev,
      isOpenPriceLocked: isLocked
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header 
        status={headerStatus}
        onIndexChange={handleIndexChange}
        onMonitoringToggle={handleMonitoringToggle}
        onTradeEngineStatusChange={handleTradeEngineStatusChange}
        onOpenPriceLock={handleOpenPriceLock}
      />
      
      <main className="container mx-auto px-4 py-6">
        {showAuthPanel ? (
          <AuthPanel onAuthSuccess={handleAuthSuccess} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TradingInterface 
                selectedIndex={headerStatus.selectedIndex}
                isMonitoring={headerStatus.isMonitoring}
                isOpenPriceLocked={headerStatus.isOpenPriceLocked}
                tradeEngineStatus={headerStatus.tradeEngineStatus}
                onMonitoringToggle={handleMonitoringToggle}
                onTradeEngineStatusChange={handleTradeEngineStatusChange}
                onOpenPriceLock={handleOpenPriceLock}
              />
            </div>
            <div className="lg:col-span-1 space-y-4">
              {/* Demo Button for Testing (Remove when market is open) */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800 mb-2">Market Closed - Testing Mode</p>
                <button
                  onClick={addSampleTrade}
                  className="btn-secondary text-sm"
                >
                  Add Sample Trade
                </button>
              </div>
              
              <TradeLog 
                logs={todayTradeLogs} 
                onViewAllLogs={() => setShowAllLogs(true)}
              />
            </div>
          </div>
        )}

        {/* All Logs Modal */}
        {showAllLogs && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
              <AllLogsPage onClose={() => setShowAllLogs(false)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 