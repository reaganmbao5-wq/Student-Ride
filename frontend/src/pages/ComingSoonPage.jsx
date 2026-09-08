import React from 'react';
import { Layout } from '../components/layout/Layout';
import ComingSoonBlock from '../components/ui/coming-soon-3';

const ComingSoonPage = () => {
  return (
    <Layout>
      <ComingSoonBlock showBackToDashboard={true} />
    </Layout>
  );
};

export default ComingSoonPage;
