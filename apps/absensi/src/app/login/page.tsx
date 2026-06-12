'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    let inputUsername = email.trim().toLowerCase();
    let loginEmail = inputUsername;

    // Coba resolve username ke email asli
    const { data: resolvedEmail, error: rpcError } = await supabase.rpc('resolve_username', { p_username: inputUsername });
    
    if (!rpcError && resolvedEmail) {
      loginEmail = resolvedEmail;
    } else if (!inputUsername.includes('@')) {
      loginEmail = `${inputUsername}@ss.com`;
    }

    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password });

    if (error) {
      setError("Username atau Password salah.");
      setLoading(false);
      return;
    }

    router.push('/dashboard');
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-suka-brown mb-1">Absensi</h1>
        <p className="text-gray-500 mb-8">Sistem Absensi Sukashawarma</p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-suka-ink mb-1">
              Email atau Username
            </label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="budi.jkt01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-suka-orange"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-suka-orange"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 bg-suka-orange text-white rounded-lg font-semibold hover:bg-orange-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Masuk...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  );
}
