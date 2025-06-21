import React from 'react';
import { LiveMarketData } from '../services/liveMarketDataService';

interface MarketDepthCardProps {
  data: LiveMarketData | null;
  isLoading: boolean;
  symbol: string;
  displayName: string;
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

export const MarketDepthCard: React.FC<MarketDepthCardProps> = ({ 
  data, 
  isLoading, 
  symbol, 
  displayName 
}) => {
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) return '↗';
    if (change < 0) return '↘';
    return '→';
  };

  return (
    <div className="card relative">
      {/* Live Badge - Top Right Corner */}
      {isMarketOpenIST() && (
        <div className="absolute top-2 right-2">
          <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-50 text-green-700 border border-green-200 shadow-sm">
            Live
          </span>
        </div>
      )}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2" />
            {displayName}
          </h3>
          <p className="text-xs text-slate-400 font-mono">{symbol}</p>
          {/* Last Updated Time */}
          <p className="text-xs text-slate-300 mt-1">
            Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '--'}
          </p>
        </div>
        {isLoading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400" />
        )}
      </div>
      {data ? (
        <div className="space-y-3">
          {/* LTP and Change */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">LTP</span>
            <div className="text-right">
              <div className={`text-lg font-bold ${getChangeColor(data.change)}`}>₹{data.ltp.toLocaleString()}</div>
              <div className={`text-sm ${getChangeColor(data.change)}`}>{getChangeIcon(data.change)} {data.change.toFixed(2)} ({data.changePercent.toFixed(2)}%)</div>
            </div>
          </div>
          {/* Open Price */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Open</span>
            <span className="text-sm font-semibold text-slate-900">₹{data.open.toLocaleString()}</span>
          </div>
          {/* High/Low */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">High</span>
              <span className="text-sm font-semibold text-green-600">₹{data.high.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-500">Low</span>
              <span className="text-sm font-semibold text-red-600">₹{data.low.toLocaleString()}</span>
            </div>
          </div>
          {/* Volume */}
          <div className="flex justify-between items-center">
            <span className="text-sm text-slate-500">Volume</span>
            <span className="text-sm font-semibold text-slate-900">{data.volume.toLocaleString()}</span>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-slate-400">{isLoading ? 'Loading...' : 'No data available'}</p>
        </div>
      )}
    </div>
  );
}; 