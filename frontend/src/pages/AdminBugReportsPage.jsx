import React, { useState, useEffect } from 'react';
import { Bug, AlertTriangle, CheckCircle, Clock, Smartphone, MapPin, RefreshCw, ChevronDown, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Layout } from '../components/layout/Layout';
import { toast } from 'sonner';

export const AdminBugReportsPage = () => {
  const { api } = useAuth();
  const [activeTab, setActiveTab] = useState('user-reports'); // 'user-reports' | 'auto-errors'
  const [bugReports, setBugReports] = useState([]);
  const [systemErrors, setSystemErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reportsRes, errorsRes] = await Promise.all([
        api.get('/admin/bug-reports'),
        api.get('/admin/system-errors')
      ]);
      setBugReports(reportsRes.data || []);
      setSystemErrors(errorsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch admin diagnostics:', error);
      toast.error('Failed to load bug reports & system diagnostics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleStatusChange = async (reportId, newStatus) => {
    try {
      await api.patch(`/admin/bug-reports/${reportId}/status`, { status: newStatus });
      toast.success(`Report status updated to ${newStatus}`);
      setBugReports((prev) =>
        prev.map((r) => (r.id === reportId ? { ...r, status: newStatus } : r))
      );
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredUserReports = bugReports.filter((r) => {
    if (statusFilter === 'all') return true;
    return r.status === statusFilter;
  });

  return (
    <Layout title="Bug Reports & Auto-Diagnostics">
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Top Header & Tabs */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h1 className="text-2xl font-bold font-heading text-white flex items-center gap-3">
              <Bug className="w-7 h-7 text-gold-400" />
              Bug Reports & System Diagnostics
            </h1>
            <p className="text-sm text-zinc-400">
              Review user-submitted bug reports and automated system crash logs.
            </p>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="self-start md:self-auto px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 bg-[#1A1A1A] p-1.5 rounded-2xl border border-white/10 w-fit">
          <button
            onClick={() => setActiveTab('user-reports')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'user-reports'
                ? 'bg-gold-500 text-black shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Bug className="w-4 h-4" />
            User Feedback ({bugReports.length})
          </button>

          <button
            onClick={() => setActiveTab('auto-errors')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === 'auto-errors'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            Auto-Captured Errors ({systemErrors.length})
          </button>
        </div>

        {/* TAB 1: USER BUG REPORTS */}
        {activeTab === 'user-reports' && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-zinc-400">Status:</span>
              {['all', 'open', 'investigating', 'resolved'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                    statusFilter === st
                      ? 'bg-white text-black'
                      : 'bg-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="py-16 text-center text-zinc-500">Loading user reports...</div>
            ) : filteredUserReports.length === 0 ? (
              <div className="py-16 text-center bg-[#1A1A1A] rounded-2xl border border-white/5 text-zinc-400">
                No user bug reports found.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {filteredUserReports.map((report) => (
                  <div
                    key={report.id}
                    className="bg-[#212121] border border-white/10 rounded-2xl p-5 space-y-4 shadow-lg"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-gold-500/20 text-gold-400 font-semibold text-xs rounded-full border border-gold-500/30">
                          {report.category}
                        </span>
                        <span className="text-xs text-zinc-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(report.created_at).toLocaleString()}
                        </span>
                      </div>

                      {/* Status Dropdown */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400">Status:</span>
                        <select
                          value={report.status}
                          onChange={(e) => handleStatusChange(report.id, e.target.value)}
                          className="bg-zinc-800 border border-white/10 text-white text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none"
                        >
                          <option value="open">Open</option>
                          <option value="investigating">Investigating</option>
                          <option value="resolved">Resolved</option>
                        </select>
                      </div>
                    </div>

                    {/* User Info & Description */}
                    <div>
                      <h4 className="text-sm font-semibold text-zinc-300">
                        {report.user_name || 'Anonymous User'} ({report.user_email || 'No email'})
                      </h4>
                      <p className="text-base text-white mt-1 font-medium bg-[#181818] p-4 rounded-xl border border-white/5 whitespace-pre-wrap">
                        {report.description}
                      </p>
                    </div>

                    {/* Attached Active-Ride Screenshot */}
                    {report.device_info?.screenshot && (
                      <div className="space-y-1.5">
                        <span className="text-xs font-semibold text-zinc-400">Attached Active-Ride Screenshot:</span>
                        <div className="rounded-xl overflow-hidden border border-white/10 max-w-sm bg-black">
                          <img
                            src={report.device_info.screenshot}
                            alt="Active Ride Screenshot"
                            className="w-full h-auto object-cover max-h-64 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(report.device_info.screenshot, '_blank')}
                          />
                        </div>
                      </div>
                    )}

                    {/* Device & Location Diagnostics */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-zinc-400 bg-[#1A1A1A] p-3 rounded-xl border border-white/5">
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-zinc-500 shrink-0" />
                        <span>
                          <strong>Platform:</strong> {report.device_info?.platform || 'Web'} | Screen:{' '}
                          {report.device_info?.screenWidth}x{report.device_info?.screenHeight}
                        </span>
                      </div>

                      {report.location_data && Object.keys(report.location_data).length > 0 && (
                        <div className="flex items-center gap-2">
                          <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            <strong>GPS:</strong> Lat {report.location_data?.lat?.toFixed(4)}, Lng{' '}
                            {report.location_data?.lng?.toFixed(4)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AUTO-CAPTURED SYSTEM ERRORS */}
        {activeTab === 'auto-errors' && (
          <div className="space-y-4">
            {loading ? (
              <div className="py-16 text-center text-zinc-500">Loading system crash logs...</div>
            ) : systemErrors.length === 0 ? (
              <div className="py-16 text-center bg-[#1A1A1A] rounded-2xl border border-white/5 text-zinc-400">
                No automated system errors recorded. Clean run! 🎉
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {systemErrors.map((err) => (
                  <div
                    key={err.id}
                    className="bg-[#212121] border border-rose-500/20 rounded-2xl p-5 space-y-3 shadow-lg"
                  >
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        {err.error_message}
                      </div>
                      <span className="text-xs text-zinc-400">
                        {new Date(err.created_at).toLocaleString()}
                      </span>
                    </div>

                    {err.url_route && (
                      <div className="text-xs text-zinc-400 flex items-center gap-2">
                        <Monitor className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Route: <code className="text-white bg-zinc-800 px-2 py-0.5 rounded">{err.url_route}</code></span>
                      </div>
                    )}

                    {err.stack_trace && (
                      <pre className="p-3 bg-black/80 text-rose-300 text-xs font-mono rounded-xl overflow-x-auto border border-white/5 max-h-48 overflow-y-auto">
                        {err.stack_trace}
                      </pre>
                    )}

                    <div className="text-xs text-zinc-500 flex items-center gap-2">
                      <Smartphone className="w-3.5 h-3.5" />
                      <span>Platform: {err.device_info?.platform || 'Web'} | User: {err.user_email || err.user_id}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};
export default AdminBugReportsPage;
