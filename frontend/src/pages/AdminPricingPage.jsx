import React from 'react';
import Layout from '../components/layout/Layout';
import FixedRouteManager from '../components/admin/FixedRouteManager';
import { MapPin } from 'lucide-react';

const AdminPricingPage = () => {
    return (
        <Layout>
            <div className="space-y-6 max-w-7xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <MapPin className="w-6 h-6 text-gold" />
                            <h1 className="text-2xl font-heading font-bold text-foreground">Fixed Route & Landmark Pricing</h1>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Search, filter, and adjust pairwise fares, promotional platform fees, and tolerance radius across Mulungushi University and Town routes.
                        </p>
                    </div>
                </div>

                {/* Main Route Manager */}
                <div className="min-h-[500px]">
                    <FixedRouteManager />
                </div>
            </div>
        </Layout>
    );
};

export default AdminPricingPage;
