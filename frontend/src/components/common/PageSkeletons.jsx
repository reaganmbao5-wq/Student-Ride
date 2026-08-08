import React from 'react';
import { Layout } from '../layout/Layout';

/**
 * Shimmer primitive block with animated pulse and gradient sheen.
 */
export const ShimmerBlock = ({ className = '', style = {} }) => (
  <div
    className={`relative overflow-hidden bg-zinc-800/50 dark:bg-zinc-800/40 rounded-xl animate-pulse ${className}`}
    style={style}
  >
    <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
  </div>
);

/**
 * 1. STUDENT DASHBOARD SKELETON (Home Screen Loading State)
 * Matches top greeting, hero car circle, request ride button, stats grid & recent rides list.
 */
export const StudentDashboardSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-8 max-w-4xl mx-auto" data-testid="student-dashboard-skeleton">
      {/* Header Greeting Skeleton */}
      <div className="w-full text-left space-y-2 border-b border-border/50 pb-4">
        <ShimmerBlock className="h-9 w-48 rounded-xl" />
        <ShimmerBlock className="h-4 w-60 rounded-lg opacity-70" />
      </div>

      {/* Hero Car Section Skeleton */}
      <div className="flex flex-col items-center justify-center space-y-6 pt-2 pb-4">
        {/* Yellow Circle Placeholder */}
        <div className="relative w-56 h-56 md:w-64 md:h-64 rounded-full bg-zinc-800/60 dark:bg-zinc-800/50 flex items-center justify-center overflow-hidden">
          <ShimmerBlock className="w-48 h-48 rounded-full opacity-60" />
        </div>

        {/* Subtext Guidance Skeleton */}
        <ShimmerBlock className="h-4 w-52 rounded-md" />

        {/* Request a Ride Button Skeleton */}
        <ShimmerBlock className="h-14 w-full max-w-xs rounded-2xl" />
      </div>

      {/* Quick Stats Grid Skeleton */}
      <div className="grid grid-cols-2 gap-4">
        <ShimmerBlock className="h-20 w-full rounded-2xl" />
        <ShimmerBlock className="h-20 w-full rounded-2xl" />
      </div>

      {/* Recent Rides Section Skeleton */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <ShimmerBlock className="h-6 w-32 rounded-lg" />
          <ShimmerBlock className="h-4 w-16 rounded-md" />
        </div>
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
      </div>
    </div>
  </Layout>
);

/**
 * 2. RIDE HISTORY SKELETON (History Screen Loading State)
 * Matches search bar, filter tabs, stats summary card & ride list cards.
 */
export const RideHistorySkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-4xl mx-auto" data-testid="ride-history-skeleton">
      {/* Top Header & Stats Summary Skeleton */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
        <div className="space-y-2">
          <ShimmerBlock className="h-8 w-44 rounded-xl" />
          <ShimmerBlock className="h-4 w-56 rounded-md opacity-70" />
        </div>
        <ShimmerBlock className="h-10 w-32 rounded-xl" />
      </div>

      {/* Search Bar Skeleton */}
      <ShimmerBlock className="h-12 w-full rounded-2xl" />

      {/* Filter Tabs Skeleton */}
      <div className="flex gap-2">
        <ShimmerBlock className="h-10 w-24 rounded-xl" />
        <ShimmerBlock className="h-10 w-28 rounded-xl" />
        <ShimmerBlock className="h-10 w-28 rounded-xl" />
      </div>

      {/* History Items Skeleton */}
      <div className="space-y-4 pt-2">
        <ShimmerBlock className="h-32 w-full rounded-2xl" />
        <ShimmerBlock className="h-32 w-full rounded-2xl" />
        <ShimmerBlock className="h-32 w-full rounded-2xl" />
        <ShimmerBlock className="h-32 w-full rounded-2xl" />
      </div>
    </div>
  </Layout>
);

/**
 * 3. PROFILE PAGE SKELETON (Profile Screen Loading State)
 * Matches user avatar, info badge, profile fields & settings cards.
 */
export const ProfilePageSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-2xl mx-auto" data-testid="profile-skeleton">
      {/* Avatar Header Skeleton */}
      <div className="flex flex-col items-center justify-center space-y-3 pt-4 pb-2">
        <ShimmerBlock className="w-24 h-24 rounded-full" />
        <ShimmerBlock className="h-7 w-40 rounded-xl" />
        <ShimmerBlock className="h-4 w-28 rounded-md opacity-70" />
      </div>

      {/* Profile Details Card Skeleton */}
      <div className="space-y-3">
        <ShimmerBlock className="h-5 w-32 rounded-lg" />
        <ShimmerBlock className="h-48 w-full rounded-2xl" />
      </div>

      {/* App Settings Card Skeleton */}
      <div className="space-y-3">
        <ShimmerBlock className="h-5 w-28 rounded-lg" />
        <ShimmerBlock className="h-36 w-full rounded-2xl" />
      </div>
    </div>
  </Layout>
);

/**
 * 4. DRIVER DASHBOARD SKELETON (Driver Home Screen Loading State)
 * Matches status toggle bar, live map frame & trip stats.
 */
export const DriverDashboardSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-5xl mx-auto" data-testid="driver-dashboard-skeleton">
      {/* Top Status & Controls Skeleton */}
      <div className="flex items-center justify-between pb-2">
        <div className="space-y-2">
          <ShimmerBlock className="h-8 w-44 rounded-xl" />
          <ShimmerBlock className="h-4 w-32 rounded-md opacity-70" />
        </div>
        <ShimmerBlock className="h-12 w-40 rounded-full" />
      </div>

      {/* Map Container Skeleton */}
      <ShimmerBlock className="h-[360px] w-full rounded-3xl" />

      {/* Stats Summary Grid Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
        <ShimmerBlock className="h-24 w-full rounded-2xl" />
      </div>
    </div>
  </Layout>
);

/**
 * 5. DRIVER EARNINGS SKELETON
 * Matches header, 3 stat cards, earnings breakdown list.
 */
export const DriverEarningsSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto" data-testid="driver-earnings-skeleton">
      <ShimmerBlock className="h-9 w-44 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
      </div>
      <div className="space-y-4">
        <ShimmerBlock className="h-5 w-36 rounded-lg" />
        <ShimmerBlock className="h-20 w-full rounded-2xl" />
        <ShimmerBlock className="h-20 w-full rounded-2xl" />
        <ShimmerBlock className="h-20 w-full rounded-2xl" />
      </div>
    </div>
  </Layout>
);

/**
 * 6. ADMIN OVERVIEW DASHBOARD SKELETON (Main Admin Home Page)
 */
export const AdminDashboardSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-skeleton">
      <ShimmerBlock className="h-9 w-52 rounded-xl" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
        <ShimmerBlock className="h-28 w-full rounded-2xl" />
      </div>
      <ShimmerBlock className="h-80 w-full rounded-2xl" />
    </div>
  </Layout>
);

/**
 * 7. ADMIN DRIVERS PAGE SKELETON
 */
export const AdminDriversSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-drivers-skeleton">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <ShimmerBlock className="h-9 w-44 rounded-xl" />
        <ShimmerBlock className="h-10 w-36 rounded-xl" />
      </div>
      <div className="flex gap-3">
        <ShimmerBlock className="h-12 flex-1 rounded-2xl" />
        <ShimmerBlock className="h-12 w-28 rounded-2xl" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <ShimmerBlock key={i} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  </Layout>
);

/**
 * 8. ADMIN RIDES PAGE SKELETON
 */
export const AdminRidesSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-rides-skeleton">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <ShimmerBlock className="h-9 w-40 rounded-xl" />
      </div>
      <div className="flex gap-3">
        <ShimmerBlock className="h-12 flex-1 rounded-2xl" />
        <ShimmerBlock className="h-12 w-36 rounded-2xl" />
      </div>
      <div className="space-y-3">
        {[...Array(5)].map((_, i) => (
          <ShimmerBlock key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  </Layout>
);

/**
 * 9. ADMIN USERS PAGE SKELETON
 */
export const AdminUsersSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" data-testid="admin-users-skeleton">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <ShimmerBlock className="h-9 w-36 rounded-xl" />
        <ShimmerBlock className="h-10 w-32 rounded-xl" />
      </div>
      <ShimmerBlock className="h-12 w-full rounded-2xl" />
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <ShimmerBlock key={i} className="h-20 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  </Layout>
);

/**
 * 10. ADMIN SETTINGS PAGE SKELETON
 */
export const AdminSettingsSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 space-y-6 max-w-3xl mx-auto" data-testid="admin-settings-skeleton">
      <ShimmerBlock className="h-9 w-44 rounded-xl" />
      <ShimmerBlock className="h-64 w-full rounded-2xl" />
      <ShimmerBlock className="h-48 w-full rounded-2xl" />
      <ShimmerBlock className="h-12 w-36 rounded-2xl" />
    </div>
  </Layout>
);

/**
 * 11. CHAT PAGE SKELETON
 */
export const ChatPageSkeleton = () => (
  <Layout>
    <div className="p-4 md:p-8 flex flex-col space-y-4 max-w-2xl mx-auto h-[80vh]" data-testid="chat-skeleton">
      <ShimmerBlock className="h-16 w-full rounded-2xl" />
      <div className="flex-1 space-y-3">
        <div className="flex justify-end"><ShimmerBlock className="h-12 w-3/4 rounded-2xl" /></div>
        <div className="flex justify-start"><ShimmerBlock className="h-12 w-2/3 rounded-2xl" /></div>
        <div className="flex justify-end"><ShimmerBlock className="h-10 w-1/2 rounded-2xl" /></div>
        <div className="flex justify-start"><ShimmerBlock className="h-14 w-3/4 rounded-2xl" /></div>
        <div className="flex justify-end"><ShimmerBlock className="h-12 w-2/3 rounded-2xl" /></div>
      </div>
      <ShimmerBlock className="h-14 w-full rounded-2xl" />
    </div>
  </Layout>
);
