'use client';

import { useAuth } from '@/context/AuthContext';
import { redirect } from 'next/navigation';

export default function DashboardPage() {
  const { session, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-suka-orange"></div>
      </div>
    );
  }

  if (!session || !profile) {
    redirect('/login');
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-suka-brown mb-4">Distribusi Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-suka-orange/10 rounded-lg border border-suka-orange">
          <p className="text-sm text-gray-600">Outlet</p>
          <p className="text-2xl font-bold text-suka-brown">{profile.outlet_name}</p>
        </div>
        <div className="p-4 bg-suka-brown/10 rounded-lg border border-suka-brown">
          <p className="text-sm text-gray-600">Role</p>
          <p className="text-2xl font-bold text-suka-brown capitalize">{profile.role}</p>
        </div>
      </div>
      <p className="mt-8 text-gray-500">More features coming in M1...</p>
    </div>
  );
}
