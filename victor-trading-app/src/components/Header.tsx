import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  TrendingUp, 
  RefreshCw, 
  Lock, 
  Settings, 
  Wifi, 
  Clock,
  ChevronDown
} from 'lucide-react';
import { HeaderStatus, IndexType } from '../types';
import { SymbolConfigService } from '../services/symbolConfig';

interface HeaderProps {
  status: HeaderStatus;
  onIndexChange: (index: IndexType) => void;
  onMonitoringToggle: (isMonitoring: boolean) => void;
  onTradeEngineStatusChange: (status: 'RUNNING' | 'PAUSED' | 'STOPPED') => void;
  onOpenPriceLock: (isLocked: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  onIndexChange,
  onMonitoringToggle,
  onTradeEngineStatusChange,
  onOpenPriceLock
}) => {
  const getStatusIcon = (isValid: boolean) => {
    return isValid ? (
      <CheckCircle className="w-5 h-5 text-success-500" />
    ) : (
      <XCircle className="w-5 h-5 text-danger-500" />
    );
  };

  const getApiHealthIcon = (health: string) => {
    switch (health) {
      case 'HEALTHY':
        return <Wifi className="w-5 h-5 text-success-500" />;
      case 'DEGRADED':
        return <Wifi className="w-5 h-5 text-warning-500" />;
      case 'DOWN':
        return <Wifi className="w-5 h-5 text-danger-500" />;
      default:
        return <Wifi className="w-5 h-5 text-gray-400" />;
    }
  };

  const getTradeEngineIcon = (status: string) => {
    switch (status) {
      case 'RUNNING':
        return <Settings className="w-5 h-5 text-success-500 animate-spin" />;
      case 'PAUSED':
        return <Settings className="w-5 h-5 text-warning-500" />;
      case 'STOPPED':
        return <Settings className="w-5 h-5 text-gray-400" />;
      default:
        return <Settings className="w-5 h-5 text-gray-400" />;
    }
  };

  const formatLastTradeTime = (date?: Date) => {
    if (!date) return 'N/A';
    return date.toLocaleTimeString('en-IN', { 
      timeZone: 'Asia/Kolkata',
      hour12: false 
    });
  };

  return (
    <header className="bg-white shadow-md border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl font-bold text-gray-900">Victor 2.0</h1>
            <span className="text-sm text-gray-500">HMA-55 Trading App</span>
          </div>

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              {getStatusIcon(status.authStatus.isValid)}
              <span className="text-sm font-medium">
                {status.authStatus.isValid ? 'Auth Valid' : 'Auth Invalid'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-primary-500" />
              <div className="relative">
                <select
                  value={status.selectedIndex}
                  onChange={(e) => onIndexChange(e.target.value as IndexType)}
                  className="appearance-none bg-transparent text-sm font-medium text-gray-900 pr-6 focus:outline-none"
                >
                  {SymbolConfigService.getAvailableIndices().map(index => (
                    <option key={index} value={index}>
                      {SymbolConfigService.getSymbolConfig(index).name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-0 top-1/2 transform -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <RefreshCw className={`w-5 h-5 ${status.isMonitoring ? 'text-success-500 animate-spin' : 'text-gray-400'}`} />
              <span className="text-sm font-medium">
                {status.isMonitoring ? 'Monitoring ON' : 'Monitoring OFF'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Lock className={`w-5 h-5 ${status.isOpenPriceLocked ? 'text-success-500' : 'text-gray-400'}`} />
              <span className="text-sm font-medium">
                {status.isOpenPriceLocked ? 'Open Price Locked' : 'Open Price Unlocked'}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {getTradeEngineIcon(status.tradeEngineStatus)}
              <span className="text-sm font-medium">
                Trade Engine: {status.tradeEngineStatus}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              {getApiHealthIcon(status.apiHealth)}
              <span className="text-sm font-medium">
                API: {status.apiHealth}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-gray-400" />
              <span className="text-sm font-medium">
                {formatLastTradeTime(status.lastTradeTime)}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => onMonitoringToggle(!status.isMonitoring)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                status.isMonitoring 
                  ? 'bg-danger-100 text-danger-700 hover:bg-danger-200' 
                  : 'bg-success-100 text-success-700 hover:bg-success-200'
              }`}
            >
              {status.isMonitoring ? 'Stop' : 'Start'}
            </button>
            
            <button
              onClick={() => onTradeEngineStatusChange(status.tradeEngineStatus === 'RUNNING' ? 'PAUSED' : 'RUNNING')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                status.tradeEngineStatus === 'RUNNING'
                  ? 'bg-warning-100 text-warning-700 hover:bg-warning-200'
                  : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
              }`}
            >
              {status.tradeEngineStatus === 'RUNNING' ? 'Pause' : 'Resume'}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}; 