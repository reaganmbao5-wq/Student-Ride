import React, { useState, useEffect, useMemo } from 'react';
import { Search, Download } from 'lucide-react';
import { GlassCard, StatusBadge } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { AdminRidesSkeleton } from '../components/common/PageSkeletons';
import { AppCache } from '../utils/AppCache';
import { toast } from 'sonner';

const AccountantLedgerPage = () => {
  const { api } = useAuth();
  const [rides, setRides] = useState(() => AppCache.get('accountant_rides') || []);
  const [loading, setLoading] = useState(() => !AppCache.get('accountant_rides'));
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchRides(Boolean(AppCache.get('accountant_rides')));
  }, []);

  const fetchRides = async (isBackground = false) => {
    try {
      if (!isBackground && rides.length === 0) setLoading(true);
      const res = await api.get('/admin/rides?limit=500');
      setRides(res.data);
      AppCache.set('accountant_rides', res.data);
    } catch (e) {
      toast.error('Failed to load transaction ledger');
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const processedRides = useMemo(() => {
    return rides.filter(r => {
      const sName = (r.student?.name || '').toLowerCase();
      const dName = (r.driver?.user?.name || '').toLowerCase();
      const q = searchQuery.toLowerCase();
      const matchesSearch = sName.includes(q) || dName.includes(q) || (r.id && r.id.toLowerCase().includes(q));
      const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rides, searchQuery, statusFilter]);

  // Export to CSV Function
  const exportToCSV = () => {
    if (processedRides.length === 0) {
      toast.error('No transactions to export');
      return;
    }

    const headers = ['Transaction ID', 'Date', 'Passenger', 'Driver', 'Mode', 'Distance (km)', 'Gross Fare (ZMW)', 'Driver Earning (ZMW)', 'Platform Profit (ZMW)', 'Status'];
    const rows = processedRides.map(r => [
      r.id,
      r.created_at ? new Date(r.created_at).toISOString() : '',
      `"${r.student?.name || 'Passenger'}"`,
      `"${r.driver?.user?.name || 'Driver'}"`,
      r.ride_mode || 'shared',
      r.distance_km?.toFixed(2) || '0.00',
      r.fare?.toFixed(2) || '0.00',
      r.driver_earning?.toFixed(2) || (r.fare * 0.9).toFixed(2),
      (r.fare - (r.driver_earning || (r.fare * 0.9))).toFixed(2),
      r.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `JaeyRide_Ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Ledger exported successfully!');
  };

  if (loading && rides.length === 0) {
    return (
      <Layout>
        <AdminRidesSkeleton />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Transaction & Rides Ledger</h1>
            <p className="text-muted-foreground text-sm">Granular financial records of all campus passenger trips</p>
          </div>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gold text-zinc-950 font-bold hover:brightness-105 transition-all cursor-pointer shadow-md"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by passenger, driver, or trip ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-card border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none"
          >
            <option value="all">All Trip Statuses</option>
            <option value="completed">Completed Only</option>
            <option value="cancelled">Cancelled Only</option>
          </select>
        </div>

        {/* Ledger Table */}
        <GlassCard className="overflow-hidden border border-border/60 p-0" hover={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-4">Date / ID</th>
                  <th className="p-4">Passenger</th>
                  <th className="p-4">Driver</th>
                  <th className="p-4">Mode</th>
                  <th className="p-4 text-right">Gross Fare</th>
                  <th className="p-4 text-right">Driver (90%)</th>
                  <th className="p-4 text-right">Profit (10%)</th>
                  <th className="p-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {processedRides.map((ride) => {
                  const gross = ride.fare || 0;
                  const driverShare = ride.driver_earning || (gross * 0.9);
                  const commission = gross - driverShare;

                  return (
                    <tr key={ride.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-4 font-mono text-xs text-muted-foreground">
                        {ride.created_at ? new Date(ride.created_at).toLocaleDateString() : 'N/A'}
                        <div className="text-[10px] text-muted-foreground/60">{ride.id?.slice(0, 8)}...</div>
                      </td>
                      <td className="p-4 font-semibold text-foreground">{ride.student?.name || 'Passenger'}</td>
                      <td className="p-4 text-muted-foreground">{ride.driver?.user?.name || 'Driver'}</td>
                      <td className="p-4 capitalize text-xs">{ride.ride_mode || 'shared'}</td>
                      <td className="p-4 text-right font-bold text-foreground">K{gross.toFixed(2)}</td>
                      <td className="p-4 text-right text-emerald-400 font-medium">K{driverShare.toFixed(2)}</td>
                      <td className="p-4 text-right text-gold font-bold">K{commission.toFixed(2)}</td>
                      <td className="p-4 text-center">
                        <StatusBadge status={ride.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>
    </Layout>
  );
};

export default AccountantLedgerPage;
