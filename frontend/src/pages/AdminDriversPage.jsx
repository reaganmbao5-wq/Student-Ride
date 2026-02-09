import React, { useState, useEffect } from 'react';
import { Car, Search, Check, X, Star, AlertCircle, Wallet, Plus, Loader2 } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner, EmptyState } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';

const AdminDriversPage = () => {
  const { api } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // all, pending, approved, restricted

  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState(null);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpDescription, setTopUpDescription] = useState('Admin Top-up');
  const [isSubmittingTopUp, setIsSubmittingTopUp] = useState(false);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    try {
      const response = await api.get('/admin/drivers');
      setDrivers(response.data);
    } catch (error) {
      console.error('Error fetching drivers:', error);
      toast.error('Failed to load drivers');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (driverId) => {
    try {
      await api.post(`/admin/drivers/${driverId}/approve`);
      toast.success('Driver approved');
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to approve driver');
    }
  };

  const handleSuspend = async (driverId) => {
    try {
      await api.post(`/admin/drivers/${driverId}/suspend`);
      toast.success('Driver suspended');
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to suspend driver');
    }
  };

  const handleTopUp = async (e) => {
    e.preventDefault();
    if (!selectedDriver) return;

    setIsSubmittingTopUp(true);
    try {
      const response = await api.post(`/admin/drivers/${selectedDriver.id}/topup`, {
        amount: parseFloat(topUpAmount),
        description: topUpDescription
      });

      toast.success(`Successfully topped up K${parseFloat(topUpAmount).toFixed(2)}`);

      // Update local state to reflect change immediately
      setDrivers(prev => prev.map(d => {
        if (d.id === selectedDriver.id) {
          return {
            ...d,
            wallet_balance: response.data.new_balance,
            wallet_status: response.data.wallet_status
          };
        }
        return d;
      }));

      setTopUpModalOpen(false);
      setTopUpAmount('');
      setTopUpDescription('Admin Top-up');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to top up wallet');
    } finally {
      setIsSubmittingTopUp(false);
    }
  };

  const openTopUpModal = (driver) => {
    setSelectedDriver(driver);
    setTopUpAmount('');
    setTopUpModalOpen(true);
  };

  const filteredDrivers = drivers.filter(driver => {
    const matchesSearch =
      driver.user?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      driver.plate_number?.toLowerCase().includes(searchQuery.toLowerCase());

    if (filter === 'pending') return matchesSearch && !driver.is_approved;
    if (filter === 'approved') return matchesSearch && driver.is_approved;
    if (filter === 'restricted') return matchesSearch && driver.wallet_status === 'restricted';
    return matchesSearch;
  });

  const pendingCount = drivers.filter(d => !d.is_approved).length;
  const restrictedCount = drivers.filter(d => d.wallet_status === 'restricted').length;

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <LoadingSpinner size="lg" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6" data-testid="admin-drivers-page">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold text-white mb-2">
            Driver Management
          </h1>
          <p className="text-white/50">{drivers.length} total drivers</p>
        </div>

        {/* Alerts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pending Alert */}
          {pendingCount > 0 && (
            <GlassCard className="p-4 border-yellow-500/30" hover={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{pendingCount} driver(s) pending approval</p>
                  <p className="text-white/50 text-sm">Review applications</p>
                </div>
                <GoldButton size="sm" onClick={() => setFilter('pending')}>
                  Review
                </GoldButton>
              </div>
            </GlassCard>
          )}

          {/* Restricted Alert */}
          {restrictedCount > 0 && (
            <GlassCard className="p-4 border-red-500/30" hover={false}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-white font-medium">{restrictedCount} driver(s) restricted</p>
                  <p className="text-white/50 text-sm">Low wallet balance</p>
                </div>
                <GoldButton size="sm" onClick={() => setFilter('restricted')} className="bg-red-500 text-white hover:bg-red-600 border-none">
                  Check
                </GoldButton>
              </div>
            </GlassCard>
          )}
        </div>

        {/* Search & Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
            <GlassInput
              type="text"
              placeholder="Search drivers or plates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12"
              data-testid="search-drivers-input"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'pending', 'approved', 'restricted'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${filter === f
                    ? 'bg-gold text-black'
                    : 'bg-white/5 text-white/60 hover:bg-white/10'
                  }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Drivers List */}
        {filteredDrivers.length > 0 ? (
          <div className="space-y-3">
            {filteredDrivers.map((driver) => (
              <GlassCard key={driver.id} className="p-4" data-testid={`driver-card-${driver.id}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center shrink-0">
                      <Car className="w-6 h-6 text-gold" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-white">{driver.user?.name}</p>
                        {driver.is_online && (
                          <span className="w-2 h-2 rounded-full bg-emerald-500" title="Online" />
                        )}
                        {!driver.is_approved && (
                          <span className="px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-400 text-[10px] uppercase tracking-wider">Pending</span>
                        )}
                        {driver.wallet_status === 'restricted' && (
                          <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] uppercase tracking-wider">Restricted</span>
                        )}
                      </div>
                      <p className="text-sm text-white/50">{driver.user?.phone}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/40">
                        <span className="font-mono bg-white/5 px-1.5 py-0.5 rounded">{driver.plate_number}</span>
                        <span>{driver.vehicle_model}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                    {/* Wallet Stats */}
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className={`font-bold font-heading ${driver.wallet_balance < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                          K{driver.wallet_balance?.toFixed(2)}
                        </p>
                        <p className="text-xs text-white/40">Balance</p>
                      </div>
                      <div className="text-right hidden md:block">
                        <p className="text-white font-medium">K{driver.total_commission_paid?.toFixed(2)}</p>
                        <p className="text-xs text-white/40">Comm. Paid</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <Dialog open={topUpModalOpen && selectedDriver?.id === driver.id} onOpenChange={(open) => {
                        if (!open) {
                          setTopUpModalOpen(false);
                          setSelectedDriver(null);
                        }
                      }}>
                        <DialogTrigger asChild>
                          <button
                            onClick={() => openTopUpModal(driver)}
                            className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                            title="Top Up Wallet"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#121212] border-white/10">
                          <DialogHeader>
                            <DialogTitle className="text-white font-heading">Top Up Wallet</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleTopUp} className="space-y-4 mt-4">
                            <div className="p-4 bg-white/5 rounded-xl">
                              <p className="text-sm text-white/50 mb-1">Driver</p>
                              <p className="text-white font-bold">{selectedDriver?.user?.name}</p>
                              <p className="text-sm text-white/70">Current Balance: <span className={selectedDriver?.wallet_balance < 0 ? 'text-red-400' : 'text-emerald-400'}>K{selectedDriver?.wallet_balance?.toFixed(2)}</span></p>
                            </div>

                            <GlassInput
                              type="number"
                              placeholder="Amount (K)"
                              value={topUpAmount}
                              onChange={(e) => setTopUpAmount(e.target.value)}
                              required
                              min="1"
                              step="0.01"
                            />
                            <GlassInput
                              type="text"
                              placeholder="Description (Optional)"
                              value={topUpDescription}
                              onChange={(e) => setTopUpDescription(e.target.value)}
                            />

                            <GoldButton type="submit" className="w-full" disabled={isSubmittingTopUp}>
                              {isSubmittingTopUp ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirm Top Up'}
                            </GoldButton>
                          </form>
                        </DialogContent>
                      </Dialog>

                      {driver.is_approved ? (
                        <button
                          onClick={() => handleSuspend(driver.id)}
                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Suspend"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <GoldButton size="sm" onClick={() => handleApprove(driver.id)}>
                          <Check className="w-4 h-4 mr-1" />
                          Approve
                        </GoldButton>
                      )}
                    </div>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Car}
            title="No drivers found"
            description={searchQuery ? 'Try a different search term' : 'No drivers matching criteria'}
          />
        )}
      </div>
    </Layout>
  );
};

export default AdminDriversPage;
