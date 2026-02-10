import React from 'react';
import { Layout } from '../components/layout/Layout';
import { AdminDestinations } from '../components/admin/AdminDestinations';

const AdminDestinationsPage = () => {
    return (
        <Layout>
            <div className="p-4 md:p-8 space-y-6">
                <div className="mb-8">
                    <h1 className="text-3xl font-heading font-bold text-white mb-2">Popular Destinations</h1>
                    <p className="text-white/60">Manage quick-select locations for students.</p>
                </div>

                <AdminDestinations />
            </div>
        </Layout>
    );
};

export default AdminDestinationsPage;
