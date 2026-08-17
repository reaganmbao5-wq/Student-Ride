import React, { useState, useEffect } from 'react';
import { Broadcast, BellSimpleRinging, PaperPlaneRight, UsersThree, CheckCircle, WarningCircle, User } from '@phosphor-icons/react';
import { GlassCard, GoldButton } from '../common/GlassComponents';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import { Search, Loader2, X, GraduationCap } from 'lucide-react';

export const AdminPushNotifications = () => {
    const { api } = useAuth();
    const [formData, setFormData] = useState({
        title: '',
        message: '',
        url: '',
        target_role: 'all',
        year_of_study: 1,
        target_user_id: ''
    });
    const [loading, setLoading] = useState(false);

    // Specific user search state
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState([]);
    const [searchingUsers, setSearchingUsers] = useState(false);
    const [selectedUserObj, setSelectedUserObj] = useState(null);

    // Debounced search for specific user
    useEffect(() => {
        if (formData.target_role !== 'specific_user' || !userSearchQuery.trim() || userSearchQuery.trim().length < 2) {
            setUserSearchResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setSearchingUsers(true);
            try {
                const res = await api.get(`/admin/users/search?q=${encodeURIComponent(userSearchQuery.trim())}`);
                setUserSearchResults(res.data || []);
            } catch (err) {
                console.error('Failed to search users:', err);
            } finally {
                setSearchingUsers(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [userSearchQuery, formData.target_role, api]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.title || !formData.message) {
            toast.error('Title and message are required');
            return;
        }

        if (formData.target_role === 'specific_user' && !formData.target_user_id) {
            toast.error('Please select a specific recipient user');
            return;
        }

        const payload = {
            title: formData.title,
            message: formData.message,
            url: formData.url || undefined,
            target_role: formData.target_role,
            year_of_study: formData.target_role === 'year_of_study' ? Number(formData.year_of_study) : undefined,
            target_user_id: formData.target_role === 'specific_user' ? formData.target_user_id : undefined
        };

        try {
            setLoading(true);
            const res = await api.post('/admin/notifications/broadcast', payload);
            if (res.data.status === 'success') {
                toast.success(res.data.message || `Broadcast delivered to ${res.data.sent || 0} active devices`);
                setFormData({ title: '', message: '', url: '', target_role: 'all', year_of_study: 1, target_user_id: '' });
                setSelectedUserObj(null);
                setUserSearchQuery('');
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
                    <p className="text-muted-foreground text-xs mt-0.5">Targeted campus alerts & segmented push broadcasts</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 flex-1 flex flex-col justify-between text-xs">
                <div className="space-y-4">
                    <div>
                        <label className="block text-muted-foreground font-bold mb-1">Target Audience</label>
                        <select
                            value={formData.target_role}
                            onChange={e => {
                                setFormData({ ...formData, target_role: e.target.value });
                                setSelectedUserObj(null);
                                setUserSearchQuery('');
                            }}
                            className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground focus:outline-none focus:border-gold transition-colors cursor-pointer text-xs"
                        >
                            <option value="all">All Active Users (Students, Lecturers, Drivers)</option>
                            <option value="students">Students Only</option>
                            <option value="lecturers">Lecturers Only</option>
                            <option value="drivers">Drivers Only</option>
                            <option value="year_of_study">By Year of Study (Students)</option>
                            <option value="specific_user">Specific Individual User</option>
                        </select>
                    </div>

                    {/* Conditional Year of Study Selector */}
                    {formData.target_role === 'year_of_study' && (
                        <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-2">
                            <label className="block text-muted-foreground font-bold text-xs">Target Year of Study</label>
                            <div className="grid grid-cols-5 gap-1.5">
                                {[1, 2, 3, 4, 5].map((yr) => (
                                    <button
                                        key={yr}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, year_of_study: yr })}
                                        className={`py-2 rounded-xl text-xs font-bold border transition-all flex flex-col items-center justify-center cursor-pointer ${
                                            formData.year_of_study === yr
                                                ? 'bg-gold border-gold text-white shadow-none'
                                                : 'bg-card border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                                        }`}
                                    >
                                        <span>{yr === 1 ? '1st' : yr === 2 ? '2nd' : yr === 3 ? '3rd' : `${yr}th`}</span>
                                        <span className="text-[9px] font-semibold opacity-75">Year</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Conditional Specific User Search */}
                    {formData.target_role === 'specific_user' && (
                        <div className="p-3 bg-muted/60 rounded-xl border border-border space-y-2 relative">
                            <label className="block text-muted-foreground font-bold">Search Recipient</label>
                            {selectedUserObj ? (
                                <div className="flex items-center justify-between p-2.5 bg-card border border-gold/40 rounded-xl">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-7 h-7 rounded-lg bg-gold/15 text-gold flex items-center justify-center font-bold text-xs">
                                            {selectedUserObj.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p className="font-bold text-foreground text-xs">{selectedUserObj.name}</p>
                                            <p className="text-[10px] text-muted-foreground">{selectedUserObj.email} • <span className="capitalize">{selectedUserObj.role}</span></p>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedUserObj(null);
                                            setFormData({ ...formData, target_user_id: '' });
                                        }}
                                        className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Type name, email, or phone..."
                                        value={userSearchQuery}
                                        onChange={e => setUserSearchQuery(e.target.value)}
                                        className="w-full bg-card border border-border rounded-xl pl-9 pr-8 py-2 text-foreground focus:outline-none focus:border-gold text-xs"
                                    />
                                    {searchingUsers && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-gold" />
                                    )}

                                    {/* Dropdown Results */}
                                    {userSearchResults.length > 0 && (
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-card border border-border rounded-xl shadow-xl max-h-48 overflow-y-auto z-20 divide-y divide-border">
                                            {userSearchResults.map(u => (
                                                <button
                                                    key={u.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedUserObj(u);
                                                        setFormData({ ...formData, target_user_id: u.id });
                                                        setUserSearchResults([]);
                                                    }}
                                                    className="w-full text-left p-2.5 hover:bg-muted/80 flex items-center justify-between text-xs transition-colors"
                                                >
                                                    <div>
                                                        <p className="font-bold text-foreground">{u.name}</p>
                                                        <p className="text-[10px] text-muted-foreground">{u.email} • {u.phone || 'No phone'}</p>
                                                    </div>
                                                    <span className="text-[10px] uppercase font-bold text-gold px-2 py-0.5 rounded bg-gold/10">
                                                        {u.role}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="block text-muted-foreground font-bold mb-1">Alert Title</label>
                        <input
                            type="text"
                            placeholder="e.g. Campus Advisory or System Update"
                            value={formData.title}
                            onChange={e => setFormData({ ...formData, title: e.target.value })}
                            className="w-full bg-muted border border-border rounded-xl px-3.5 py-2.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold transition-colors text-xs"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-muted-foreground font-bold mb-1">Message Body</label>
                        <textarea
                            placeholder="Type targeted push message content..."
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
                            placeholder="e.g. /profile or /history"
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

