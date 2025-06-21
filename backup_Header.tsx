import React from 'react';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  RefreshCw, 
  Lock, 
  Settings, 
  Wifi, 
  Clock,
  ShieldCheck,
  Zap,
  ZapOff,
  Unlock,
  LogOut,
  Server,
  Globe,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export interface HeaderStatus {
  authStatus: 'AUTHENTICATED' | 'UNAUTHENTICATED' | 'EXPIRED';
  tokenValid: boolean;
  monitoringStatus: 'ON' | 'OFF';
  tradeEngineStatus: 'RUNNING' | 'PAUSED' | 'STOPPED';
  selectedIndex: string;
  apiHealth: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'DOWN';
  openPriceLocked: boolean;
  lastTradeTime?: Date | null;
  profileName?: string;
}

interface HeaderProps {
  status: HeaderStatus;
  onStatusUpdate: (updates: Partial<HeaderStatus>) => void;
  onLogout: () => void;
}

// Utility: Check if market is open (9:15–15:30 IST)
function isMarketOpenIST() {
  const now = new Date();
  const ist = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const hours = ist.getHours();
  const minutes = ist.getMinutes();
  const mins = hours * 60 + minutes;
  return mins >= 555 && mins <= 930; // 9:15 (555) to 15:30 (930)
}

export const Header: React.FC<HeaderProps> = ({ status, onStatusUpdate, onLogout }) => {
  const navigate = useNavigate();
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
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-blue-600" />
              Victor
            </h1>
          </div>
          {/* Right Side: Badges, Profile, Actions */}
          <div className="flex items-center space-x-4">
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
              {/* Market Status */}
              <span className={`status-indicator ${isMarketOpenIST() ? 'status-success' : 'status-danger'}`}> 
                <Globe className="w-4 h-4 mr-1" />
                Market: {isMarketOpenIST() ? 'Open' : 'Closed'}
              </span>
              {/* API Health */}
              <span className={`status-indicator ${status.apiHealth === 'HEALTHY' ? 'status-success' : status.apiHealth === 'DEGRADED' ? 'status-warning' : 'status-danger'}`}> 
                <Wifi className="w-4 h-4 mr-1" />
                {status.apiHealth}
              </span>
            </div>
            <div className="flex flex-col items-end">
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
    </header>
  );
}; 