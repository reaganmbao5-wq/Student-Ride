
import React, { useState } from 'react';
import Layout from '../components/layout/Layout';
import { GlassCard } from '../components/common/GlassComponents';
import PricingGlobalSettings from '../components/admin/PricingGlobalSettings';
import FixedRouteManager from '../components/admin/FixedRouteManager';
import { Calculator, Map } from 'lucide-react';

const AdminPricingPage = () => {
    const [activeTab, setActiveTab] = useState('global'); // 'global' or 'fixed'

    return (
        <Layout>
            <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-heading font-bold text-white">Pricing Control</h1>
                        <p className="text-white/60">Manage platform rates and fixed routes</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-white/10 pb-1">
                    <button
                        onClick={() => setActiveTab('global')}
                        className={`pb-3 px-4 flex items-center gap-2 transition-all relative
                            ${activeTab === 'global' ? 'text-gold' : 'text-white/60 hover:text-white'}`}
                    >
                        <Calculator className="w-4 h-4" />
                        Global Settings
                        {activeTab === 'global' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gold rounded-full" />
                        )}
                    </button>

                    <button
                        onClick={() => setActiveTab('fixed')}
                        className={`pb-3 px-4 flex items-center gap-2 transition-all relative
                            ${activeTab === 'fixed' ? 'text-gold' : 'text-white/60 hover:text-white'}`}
                    >
                        <Map className="w-4 h-4" />
                        Fixed Routes
                        {activeTab === 'fixed' && (
                            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gold rounded-full" />
                        )}
                    </button>
                </div>

                {/* Content */}
                <div className="min-h-[500px]">
                    {activeTab === 'global' ? (
                        <PricingGlobalSettings />
                    ) : (
                        <FixedRouteManager />
                    )}
                </div>
            </div>
        </Layout>
    );
};

export default AdminPricingPage;
