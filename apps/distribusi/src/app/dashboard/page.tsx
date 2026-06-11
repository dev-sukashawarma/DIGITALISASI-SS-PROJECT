'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function DashboardPage() {
  const router = useRouter();
  const { outletStaff, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-suka-brown mb-2">Distribusi Dashboard</h1>
          <p className="text-gray-600">Sistem Distribusi & Logistik</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600">{outletStaff?.name || 'Staff'}</p>
          <p className="text-xs text-gray-500 mb-3">{outletStaff?.role || 'crew'}</p>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg transition"
          >
            Logout
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 bg-suka-orange/10 rounded-lg border border-suka-orange">
          <p className="text-sm text-gray-600">Status</p>
          <p className="text-2xl font-bold text-suka-brown">Ready</p>
        </div>
        <div className="p-4 bg-suka-brown/10 rounded-lg border border-suka-brown">
          <p className="text-sm text-gray-600">Mode</p>
          <p className="text-2xl font-bold text-suka-brown">Testing</p>
        </div>
        <div className="p-4 bg-blue-100 rounded-lg border border-blue-500">
          <p className="text-sm text-gray-600">Version</p>
          <p className="text-2xl font-bold text-blue-900">M0</p>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h2 className="font-semibold text-suka-brown mb-2">M0 Foundation Checklist</h2>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>✅ Monorepo setup (Yarn workspaces)</li>
          <li>✅ Design System package (@suka/design-system)</li>
          <li>✅ Offline Queue package (@suka/offline-queue)</li>
          <li>✅ Supabase schema (outlets, outlet_staff)</li>
          <li>✅ Next.js app shells (4 apps)</li>
          <li>⏳ Auth & RLS (coming in M1)</li>
          <li>⏳ Features (coming in M1-M4)</li>
        </ul>
      </div>

      <p className="mt-8 text-gray-500 text-sm">Ready for M1 development...</p>
    </div>
  );
}
