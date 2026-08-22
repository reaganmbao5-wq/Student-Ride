import React, { useState, useEffect, useMemo } from 'react';
import { 
  CurrencyDollar, 
  TrendUp, 
  Receipt, 
  Wallet, 
  Clock, 
  Car, 
  User, 
  ArrowClockwise, 
  FileText, 
  CheckCircle,
  MagnifyingGlass,
  ArrowDownRight,
  ArrowUpRight
} from '@phosphor-icons/react';
import { Layout } from '../components/layout/Layout';
import { GlassCard, EmptyState, StatusBadge } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

export const AccountantDashboard = () => {
  const { api, user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [driverBalances, setDriverBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'drivers' | 'transactions'
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchFinancialData();
  }, []);

  const fetchFinancialData = async () => {
    try {
      setLoading(true);
      const [summaryRes, transRes, balancesRes] = await Promise.allSettled([
        api.get('/accountant/summary'),
        api.get('/accountant/transactions?limit=100'),
        api.get('/accountant/driver-balances')
      ]);

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.data) {
        setSummary(summaryRes.value.data);
      }
      if (transRes.status === 'fulfilled' && transRes.value?.data) {
        setTransactions(transRes.value.data);
      }
      if (balancesRes.status === 'fulfilled' && balancesRes.value?.data) {
        setDriverBalances(balancesRes.value.data);
      }
    } catch (error) {
      console.error('Error fetching accountant data:', error);
      toast.error('Failed to load financial data');
    } finally {
      setLoading(false);
    }
  };

  const filteredDrivers = useMemo(() => {
    if (!searchQuery) return driverBalances;
    return driverBalances.filter(d => 
      d.driver_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.driver_phone?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      d.driver_id?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [driverBalances, searchQuery]);

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="accountant-dashboard">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Financial Audit Suite
              </span>
            </div>
            <h1 className="font-heading text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
              Accountant Ledger & Revenue
            </h1>
            <p className="text-muted-foreground text-sm">
              Comprehensive commission auditing, driver debt balances, and verified financial records
            </p>
          </div>

          <button
            onClick={fetchFinancialData}
            disabled={loading}
            className="p-2.5 rounded-2xl bg-muted border border-border text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer self-start sm:self-auto flex items-center gap-2 text-sm font-semibold"
          >
            <ArrowClockwise className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Ledger</span>
          </button>
        </div>

        {/* Financial KPI Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Gross Fare Volume */}
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
                  Gross Platform Volume
                </p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-foreground">
                  ZMW {summary?.gross_volume?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Receipt weight="duotone" className="w-3.5 h-3.5 text-gold" />
                  <span>{summary?.total_completed_rides || 0} completed rides</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center text-gold">
                <CurrencyDollar weight="duotone" className="w-5 h-5" />
              </div>
            </div>
          </GlassCard>

          {/* Card 2: 10% Platform Commission */}
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
                  10% Commission Earned
                </p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-emerald-400">
                  ZMW {summary?.total_commission_earned?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <TrendUp weight="duotone" className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Rate: {summary?.commission_rate_percent || 10}%</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <TrendUp weight="duotone" className="w-5 h-5" />
              </div>
            </div>
          </GlassCard>

          {/* Card 3: Driver Earnings */}
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
                  Driver Earnings (90%)
                </p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-blue-400">
                  ZMW {summary?.total_driver_earnings?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <Car weight="duotone" className="w-3.5 h-3.5 text-blue-400" />
                  <span>{summary?.active_drivers_count || 0} registered drivers</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Wallet weight="duotone" className="w-5 h-5" />
              </div>
            </div>
          </GlassCard>

          {/* Card 4: Accumulated Driver Debt */}
          <GlassCard className="p-5 border border-border/60" hover={false}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider mb-1">
                  Outstanding Driver Debt
                </p>
                <p className="font-heading text-2xl md:text-3xl font-bold text-amber-400">
                  ZMW {summary?.total_debt_outstanding?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '0.00'}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <CheckCircle weight="duotone" className="w-3.5 h-3.5 text-amber-400" />
                  <span>Settled: ZMW {summary?.total_commission_paid?.toFixed(2) || '0.00'}</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Receipt weight="duotone" className="w-5 h-5" />
              </div>
            </div>
          </GlassCard>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-border pb-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Driver Balances ({driverBalances.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors cursor-pointer ${
              activeTab === 'transactions'
                ? 'bg-gold/15 text-gold border border-gold/30'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            Ledger Transactions ({transactions.length})
          </button>
        </div>

        {/* TAB 1: Driver Balances Table */}
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative max-w-md">
              <MagnifyingGlass className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search driver by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card text-foreground text-sm rounded-2xl pl-10 pr-4 py-2.5 border border-border focus:outline-none focus:border-gold placeholder:text-muted-foreground"
              />
            </div>

            {filteredDrivers.length > 0 ? (
              <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
                <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-4">Driver Profile</div>
                  <div className="col-span-3">Vehicle Details</div>
                  <div className="col-span-3">Commission Debt Due</div>
                  <div className="col-span-2 text-right">Account Status</div>
                </div>

                {filteredDrivers.map((driver) => (
                  <div 
                    key={driver.driver_id}
                    className="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 lg:items-center hover:bg-muted/20 transition-colors"
                  >
                    <div className="lg:col-span-4">
                      <p className="font-bold text-foreground text-sm flex items-center gap-2">
                        <User weight="duotone" className="w-4 h-4 text-gold shrink-0" />
                        <span>{driver.driver_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground pl-6">
                        {driver.driver_phone || 'No phone'}
                      </p>
                    </div>

                    <div className="lg:col-span-3 text-xs space-y-0.5">
                      <p className="font-semibold text-foreground capitalize">
                        {driver.vehicle_type} ({driver.vehicle_capacity} seats)
                      </p>
                      <p className="text-muted-foreground text-[11px]">
                        ID: {driver.driver_id?.slice(0, 8)}...
                      </p>
                    </div>

                    <div className="lg:col-span-3">
                      <p className="text-sm font-bold text-amber-400">
                        ZMW {driver.total_commission_due?.toFixed(2)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Paid: ZMW {driver.total_commission_paid?.toFixed(2) || '0.00'}
                      </p>
                    </div>

                    <div className="lg:col-span-2 flex items-center lg:justify-end">
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                        driver.wallet_status === 'restricted'
                          ? 'bg-red-500/10 text-red-400 border-red-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      }`}>
                        {driver.wallet_status === 'restricted' ? 'Restricted' : 'Active'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={User}
                title="No driver records found"
                description="No drivers matched your search query"
              />
            )}
          </div>
        )}

        {/* TAB 2: Ledger Transactions */}
        {activeTab === 'transactions' && (
          <div className="space-y-4">
            {transactions.length > 0 ? (
              <div className="bg-card border border-border rounded-3xl overflow-hidden divide-y divide-border shadow-sm">
                <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3.5 bg-muted/40 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-4">Transaction / Description</div>
                  <div className="col-span-3">Driver Reference</div>
                  <div className="col-span-3">Amount</div>
                  <div className="col-span-2 text-right">Timestamp</div>
                </div>

                {transactions.map((tx, idx) => {
                  const isDeduction = tx.amount < 0 || tx.type === 'commission_deduction';
                  const formattedTime = tx.timestamp
                    ? new Date(tx.timestamp).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })
                    : 'N/A';

                  return (
                    <div 
                      key={tx.id || idx}
                      className="p-4 lg:px-6 lg:py-4 flex flex-col lg:grid lg:grid-cols-12 gap-3 lg:gap-4 lg:items-center hover:bg-muted/20 transition-colors"
                    >
                      <div className="lg:col-span-4 flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isDeduction ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                        }`}>
                          {isDeduction ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">
                            {tx.description || tx.type}
                          </p>
                          {tx.ride_id && (
                            <p className="text-[10px] text-muted-foreground">
                              Ride: #{tx.ride_id.slice(0, 8)}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="lg:col-span-3 text-xs text-muted-foreground">
                        Driver: {tx.driver_id?.slice(0, 10)}...
                      </div>

                      <div className="lg:col-span-3">
                        <span className={`text-sm font-bold ${isDeduction ? 'text-amber-400' : 'text-emerald-400'}`}>
                          {isDeduction ? '-' : '+'}ZMW {Math.abs(tx.amount || 0).toFixed(2)}
                        </span>
                      </div>

                      <div className="lg:col-span-2 text-right text-xs text-muted-foreground flex items-center justify-end gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formattedTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Receipt}
                title="No transactions recorded"
                description="Wallet ledger transactions will appear here as rides are completed and commissions settled."
              />
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AccountantDashboard;
