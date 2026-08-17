import React, { useState } from 'react';
import { Broadcast, BellSimpleRinging, PaperPlaneRight, UsersThree, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { GlassCard, GoldButton } from '../common/GlassComponents';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

export const AdminPushNotifications = () => {
    const { api } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        url: '',
        target_role: 'all'
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.message) {
            toast.error('Title and message are required');
            return;
        }

        try {
            setLoading(true);
            const res = await api.post('/admin/notifications/broadcast', formData);
            if (res.data.status === 'success') {
                toast.success(res.data.message || `Broadcast delivered to ${res.data.sent || 0} active devices`);
                setFormData({ title: '', message: '', url: '', target_role: 'all' });
            } else {
                toast.error(res.data.message || 'Failed to dispatch broadcast');
            }
        } catch (err) {
            console.error('Failed to broadcast:', err);
            toast.error(err.response?.data?.detail || 'Failed to send broadcast');
        } finally {
            setLoading(false);
        }
    };

    return (
        <GlassCard className="p-6 border border-border/60 flex flex-col" hover={false}>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center shrink-0">
                    <Broadcast weight="duotone" className="w-5 h-5 text-gold" />
                </div>
                <div>
                    <h2 className="font-heading font-bold text-foreground text-base">Push Notifications</h2>
                    <p className="text-muted-foreground text-xs mt-0.5">Instant live system alerts & broadcast to campus fleet</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between text-xs">
                <div className="space-y-4">
                    <div>
                        <label className="block text-muted-foreground font-bold mb-1">Target Audience</label>
                        <select
                            value={formData.target_role}
                            onChange={e => setFormData({ ...formData, target_role: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors cursor-pointer text-xs"
                        >
                            <option value="all">All Users (Students & Drivers)</option>
                            <option value="student">Students Only</option>
                            <option value="driver">Drivers Only</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-muted-foreground font-bold mb-1">Alert Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Campus Ride Update or Weather Advisory"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors text-xs"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-muted-foreground font-bold mb-1">Message Body</label>
                        <textarea
                            placeholder="Type broadcast message for students and drivers..."
                            rows={3}
                            value={formData.message}
                            onChange={e => setFormData({ ...formData, message: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors resize-none text-xs"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-muted-foreground font-bold mb-1">Deep Link / URL (Optional)</label>
                        <input
                            type="text"
                            placeholder="e.g. /profile or https://..."
                            value={formData.url}
                            onChange={e => setFormData({ ...formData, url: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors text-xs font-mono"
                        />
                    </div>
                </div>

                <div className="pt-2">
                    <GoldButton
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold"
                    >
                        <PaperPlaneRight weight="duotone" className="w-4 h-4" />
                        <span>{loading ? 'Transmitting Broadcast...' : 'Send Broadcast Push'}</span>
                    </GoldButton>
                </div>
            </form>
        </GlassCard>
    );
};
