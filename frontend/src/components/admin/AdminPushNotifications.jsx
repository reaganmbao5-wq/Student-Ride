import React, { useState } from 'react';
import { BellRing, Send } from 'lucide-react';
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
            toast.success(res.data.message || 'Broadcast sent successfully');
            setFormData({ title: '', message: '', url: '', target_role: 'all' });
        } catch (err) {
            console.error('Failed to broadcast:', err);
            toast.error(err.response?.data?.detail || 'Failed to send broadcast');
        } finally {
            setLoading(false);
        }
    };

    return (
        <GlassCard className="p-6" hover={false}>
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <BellRing className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                    <h2 className="font-heading font-semibold text-white">Push Notifications</h2>
                    <p className="text-white/50 text-xs mt-1">Broadcast messages to users</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-xs text-white/50 mb-1">Target Audience</label>
                    <select
                        value={formData.target_role}
                        onChange={e => setFormData({ ...formData, target_role: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-gold transition-colors appearance-none"
                    >
                        <option value="all">All Users (Students & Drivers)</option>
                        <option value="student">Students Only</option>
                        <option value="driver">Drivers Only</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs text-white/50 mb-1">Title</label>
                    <input
                        type="text"
                        placeholder="e.g. System Update"
                        value={formData.title}
                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-gold transition-colors"
                    />
                </div>

                <div>
                    <label className="block text-xs text-white/50 mb-1">Message Body</label>
                    <textarea
                        placeholder="Message content..."
                        rows={3}
                        value={formData.message}
                        onChange={e => setFormData({ ...formData, message: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-gold transition-colors resize-none"
                    />
                </div>

                <div>
                    <label className="block text-xs text-white/50 mb-1">Click URL (Options)</label>
                    <input
                        type="text"
                        placeholder="e.g. /profile or https://..."
                        value={formData.url}
                        onChange={e => setFormData({ ...formData, url: e.target.value })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-gold transition-colors"
                    />
                </div>

                <GoldButton
                    type="submit"
                    disabled={loading}
                    className="w-full flex justify-center py-3"
                >
                    {loading ? 'Sending...' : (
                        <>
                            <Send className="w-5 h-5 mr-2" />
                            Send Broadcast
                        </>
                    )}
                </GoldButton>
            </form>
        </GlassCard>
    );
};
