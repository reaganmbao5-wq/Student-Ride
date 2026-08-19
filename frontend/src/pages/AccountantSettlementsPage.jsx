import React, { useState, useEffect } from 'react';
import { Search, DollarSign } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton } from '../components/common/GlassComponents';
import { Layout } from '../components/layout/Layout';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const AccountantSettlementsPage = () => {
  const { api } = useAuth();
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Settle Modal State
  const [settleModalOpen, setSettleModalOpen] = useState(false);
  const [targetDriver, setTargetDriver] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('Physical Commission Settlement');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDrivers();
  }, []);

  const fetchDrivers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/drivers');
      setDrivers(res.data);
    } catch (e) {
      toast.error('Failed to load driver financial wallets');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettle = (driver) => {
    setTargetDriver(driver);
    setSettleAmount(driver.total_commission_due ? Math.abs(driver.total_commission_due).toString() : (driver.wallet_balance ? Math.abs(driver.wallet_balance).toString() : '0'));
    setSettleModalOpen(true);
  };

  const handleConfirmSettle = async (e) => {
    e.preventDefault();
    if (!targetDriver || !settleAmount || parseFloat(settleAmount) <= 0) {
      toast.error('Please enter a valid settlement amount');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/admin/drivers/${targetDriver.id}/settle-commission`, {
        amount: parseFloat(settleAmount),
        notes: settleNotes
      });
      toast.success(`Commission debt settled for ${targetDriver.user?.name || 'Driver'}`);
      setSettleModalOpen(false);
      fetchDrivers();
    } catch (error) {
      toast.error('Failed to settle commission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDrivers = drivers.filter(d => {
    const name = (d.user?.name || '').toLowerCase();
    const phone = (d.user?.phone || '').toLowerCase();
    return name.includes(searchQuery.toLowerCase()) || phone.includes(searchQuery.toLowerCase());
  });

  return (
    <Layout>
      <div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">Driver Debt & Commission Settlements</h1>
          <p className="text-muted-foreground text-sm">Monitor driver debt wallets, K500 restriction limits & record cash remittances</p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search driver by name or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-card border border-border rounded-xl pl-11 pr-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold"
          />
        </div>

        {/* Drivers Wallet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDrivers.map((driver) => {
            const debt = driver.total_commission_due ?? driver.wallet_balance ?? 0;
            const isRestricted = driver.wallet_status === 'restricted' || debt >= 500;

            return (
              <GlassCard key={driver.id} className="p-5 border border-border/60 flex flex-col justify-between" hover={false}>
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-base text-foreground">{driver.user?.name || 'Driver'}</h3>
                      <p className="text-xs text-muted-foreground">{driver.user?.phone || driver.phone || 'No phone'}</p>
                    </div>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase ${
                      isRestricted ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {isRestricted ? 'Restricted' : 'Normal'}
                    </span>
                  </div>

                  <div className="p-3 bg-muted/40 rounded-xl space-y-1">
                    <p className="text-xs text-muted-foreground">Commission Debt Balance</p>
                    <p className={`text-xl font-heading font-bold ${isRestricted ? 'text-red-400' : 'text-foreground'}`}>
                      K{debt.toFixed(2)} <span className="text-xs text-muted-foreground font-normal">/ K500.00 Limit</span>
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    onClick={() => handleOpenSettle(driver)}
                    className="w-full py-2.5 rounded-xl bg-gold/15 hover:bg-gold/25 border border-gold/30 text-gold font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Settlement
                  </button>
                </div>
              </GlassCard>
            );
          })}
        </div>

        {/* Settle Modal */}
        <Dialog open={settleModalOpen} onOpenChange={setSettleModalOpen}>
          <DialogContent className="bg-zinc-950 border-border text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Record Commission Settlement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleConfirmSettle} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Driver Name</label>
                <p className="text-sm font-bold text-white">{targetDriver?.user?.name || targetDriver?.name || 'Driver'}</p>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Settlement Amount (ZMW)</label>
                <GlassInput
                  type="number"
                  step="0.5"
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Audit Notes</label>
                <GlassInput
                  type="text"
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                />
              </div>
              <GoldButton type="submit" loading={isSubmitting} className="w-full mt-4">
                Confirm & Clear Debt
              </GoldButton>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default AccountantSettlementsPage;
