import React, { useState } from 'react';
import { TradeLog } from '../types';
import { useNavigate } from 'react-router-dom';
import { Search, Calendar, ArrowLeft } from 'lucide-react';

interface AllLogsPageProps {
  logs: TradeLog[];
}

export const AllLogsPage: React.FC<AllLogsPageProps> = ({ logs }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Filter logs by search and date
  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      search === '' ||
      log.symbol.toLowerCase().includes(search.toLowerCase()) ||
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      (log.remarks && log.remarks.toLowerCase().includes(search.toLowerCase()));
    const logDate = new Date(log.timestamp);
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    const inDateRange =
      (!from || logDate >= from) &&
      (!to || logDate <= to);
    return matchesSearch && inDateRange;
  });

  const totalPnL = filteredLogs.reduce((sum, log) => sum + (log.pnl || 0), 0);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <h2 className="text-2xl font-bold text-slate-900">All Trade Logs</h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="input-field pl-8 w-48"
              placeholder="Search symbol, action, remarks"
            />
            <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="input-field w-32"
              max={dateTo || undefined}
            />
            <span className="mx-1 text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="input-field w-32"
              min={dateFrom || undefined}
            />
          </div>
        </div>
      </div>
      <div className="mb-4 flex justify-end">
        <span className="text-lg font-semibold text-slate-700">Cumulative P&L: </span>
        <span className={`ml-2 text-lg font-bold ${totalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>₹{totalPnL.toFixed(2)}</span>
      </div>
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-slate-100">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-slate-50">
              <th className="px-4 py-2 text-left font-semibold">Date</th>
              <th className="px-4 py-2 text-left font-semibold">Symbol</th>
              <th className="px-4 py-2 text-left font-semibold">Action</th>
              <th className="px-4 py-2 text-left font-semibold">Order Type</th>
              <th className="px-4 py-2 text-left font-semibold">Price</th>
              <th className="px-4 py-2 text-left font-semibold">Qty</th>
              <th className="px-4 py-2 text-left font-semibold">P&L</th>
              <th className="px-4 py-2 text-left font-semibold">Status</th>
              <th className="px-4 py-2 text-left font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-400">No logs found for the selected criteria.</td>
              </tr>
            ) : (
              filteredLogs.map(log => (
                <tr key={log.id} className="border-t border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-4 py-2 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{log.symbol}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{log.action}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{log.orderType}</td>
                  <td className="px-4 py-2 whitespace-nowrap">₹{log.price.toFixed(2)}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{log.quantity}</td>
                  <td className={`px-4 py-2 whitespace-nowrap font-bold ${log.pnl && log.pnl >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{log.pnl !== undefined ? `₹${log.pnl.toFixed(2)}` : '--'}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{log.status}</td>
                  <td className="px-4 py-2 whitespace-nowrap">{log.remarks || ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}; 