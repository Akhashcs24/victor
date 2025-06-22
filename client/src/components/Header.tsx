import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Lock, 
  Settings, 
  Wifi, 
  Clock,
  Trophy,
  Zap,
  LogOut,
  Server,
  Globe,
  User
} from 'lucide-react';
import { MarketService } from '../services/marketService';
export interface HeaderStatus {
  authStatus: 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'EXPIRED';
  tokenValid: boolean;
  monitoringStatus: 'ON' | 'OFF';
  tradeEngineStatus: 'RUNNING' | 'PAUSED' | 'STOPPED';
  selectedIndex: string;
  apiHealth: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
  lastTradeTime?: Date | null;
  profileName?: string;
}

interface HeaderProps {
  status: HeaderStatus;
  onStatusUpdate: (updates: Partial<HeaderStatus>) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({ status, onStatusUpdate, onLogout }) => {
  const marketStatus = MarketService.getMarketStatus();
  
  const getStatusIcon = (type: string, value: boolean | string) => {
    switch (type) {
      case 'auth':
        return value ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />;
      case 'monitoring':
        return value === 'ON' ? <RefreshCw className="w-4 h-4 text-green-500 animate-spin" /> : <RefreshCw className="w-4 h-4 text-gray-400" />;
      case 'engine':
        return <Settings className="w-4 h-4 text-blue-500" />;
      case 'health':
        return <Wifi className="w-4 h-4 text-green-500" />;
      case 'lock':
        return value ? <Lock className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-gray-400" />;
      case 'time':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (type: string, value: boolean | string) => {
    switch (type) {
      case 'auth':
        return value ? 'status-success' : 'status-danger';
      case 'monitoring':
        return value === 'ON' ? 'status-success' : 'status-warning';
      case 'engine':
        return 'status-info';
      case 'health':
        return value === 'HEALTHY' ? 'status-success' : value === 'DEGRADED' ? 'status-warning' : 'status-danger';
      case 'lock':
        return value ? 'status-success' : 'status-warning';
      default:
        return 'status-info';
    }
  };

  const toggleMonitoring = () => {
    onStatusUpdate({
      monitoringStatus: status.monitoringStatus === 'ON' ? 'OFF' : 'ON'
    });
  };

  const toggleTradeEngine = () => {
    const newStatus = status.tradeEngineStatus === 'RUNNING' ? 'PAUSED' : 
                     status.tradeEngineStatus === 'PAUSED' ? 'STOPPED' : 'RUNNING';
    onStatusUpdate({ tradeEngineStatus: newStatus });
  };

  const getApiHealthColor = () => {
    switch (status.apiHealth) {
      case 'HEALTHY': return 'bg-emerald-500';
      case 'DEGRADED': return 'bg-yellow-500';
      default: return 'bg-red-500';
    }
  };

  const getMarketStatusColor = () => {
    switch (marketStatus.status) {
      case 'OPEN': return 'status-success';
      case 'PRE_MARKET': return 'status-warning';
      case 'POST_MARKET': return 'status-warning';
      default: return 'status-danger';
    }
  };

  const getMarketStatusText = () => {
    switch (marketStatus.status) {
      case 'OPEN': return 'Market Open';
      case 'PRE_MARKET': return `Pre-Market (${marketStatus.timeToOpen})`;
      case 'POST_MARKET': return `Post-Market (${marketStatus.timeToOpen})`;
      default: return `Market Closed (${marketStatus.timeToOpen})`;
    }
  };

  const StatusPill: React.FC<{
    icon: React.ElementType;
    label: string;
    colorClass: string;
    subtle?: boolean;
  }> = ({ icon: Icon, label, colorClass, subtle }) => (
    <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${
      subtle
        ? `bg-slate-200 text-slate-700`
        : `${colorClass} text-white`
    }`}>
      <Icon className="w-4 h-4" />
      <span>{label}</span>
    </div>
  );

  return (
    <header className="bg-white border-b border-slate-100 sticky top-0 z-10">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Left Side: Logo */}
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl md:text-3xl font-bold text-yellow-800 tracking-wider flex items-center gap-2" style={{ fontFamily: "'Cherry Bomb One', cursive" }}>
              <Trophy className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />
              <span className="hidden sm:inline">Victor</span>
              <span className="sm:hidden">V</span>
            </h1>
          </div>

          {/* Mobile Layout */}
          <div className="flex md:hidden items-center space-x-2">
            {/* Most Critical Status on Mobile */}
            <div className="flex items-center space-x-1">
              {/* Auth Status - Most Important */}
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${status.tokenValid ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}> 
                <User className="w-3 h-3" />
                <span className="hidden xs:inline">{status.tokenValid ? 'Auth' : 'No Auth'}</span>
              </span>
              
              {/* Market Status */}
              <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getMarketStatusColor().replace('status-', 'bg-').replace('success', 'green-100 text-green-800').replace('warning', 'yellow-100 text-yellow-800').replace('danger', 'red-100 text-red-800')}`}> 
                <Globe className="w-3 h-3" />
                <span className="hidden xs:inline">{marketStatus.status}</span>
              </span>
              
              {/* Monitoring Status */}
              {status.monitoringStatus === 'ON' && (
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 flex items-center gap-1"> 
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="hidden xs:inline">ON</span>
                </span>
              )}
            </div>

            {/* Profile & Logout */}
            <div className="flex items-center space-x-2">
              <div className="text-right">
                <span className="text-xs font-medium text-slate-900 block truncate max-w-20">
                  {status.profileName?.split(' ')[0] || 'User'}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="p-1.5 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              {/* Auth Status */}
              <span className={`status-indicator ${status.tokenValid ? 'status-success' : 'status-danger'}`}> 
                <User className="w-4 h-4 mr-1" />
                {status.tokenValid ? 'Authenticated' : 'Not Authenticated'}
              </span>
              
              {/* Monitoring Status */}
              <span className={`status-indicator ${status.monitoringStatus === 'ON' ? 'status-success' : 'status-warning'}`}> 
                <Zap className="w-4 h-4 mr-1" />
                {status.monitoringStatus === 'ON' ? 'Monitoring' : 'Not Monitoring'}
              </span>
              
              {/* Trade Engine Status */}
              <span className={`status-indicator status-info`}> 
                <Settings className="w-4 h-4 mr-1" />
                {status.tradeEngineStatus}
              </span>
              
              {/* Server Status */}
              <span className={`status-indicator ${status.tokenValid ? 'status-success' : 'status-danger'}`}> 
                <Server className="w-4 h-4 mr-1" />
                Server: {status.tokenValid ? 'Connected' : 'Stopped'}
              </span>
              
              {/* Enhanced Market Status */}
              <span className={`status-indicator ${getMarketStatusColor()}`}> 
                <Globe className="w-4 h-4 mr-1" />
                {getMarketStatusText()}
              </span>
              
              {/* API Health */}
              <span className={`status-indicator ${status.apiHealth === 'HEALTHY' ? 'status-success' : status.apiHealth === 'DEGRADED' ? 'status-warning' : 'status-danger'}`}> 
                <Wifi className="w-4 h-4 mr-1" />
                {status.apiHealth}
              </span>
            </div>
            
            <div className="flex items-center space-x-3">
              <div className="text-right">
                <span className="text-sm font-semibold text-slate-900 flex items-center gap-1">
                  <User className="w-4 h-4" />
                  {status.profileName}
                </span>
              </div>
              <button
                onClick={onLogout}
                className="p-2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}; 