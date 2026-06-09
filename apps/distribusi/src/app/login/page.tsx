'use client';

export default function LoginPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-suka-brown mb-2">Distribusi</h1>
        <p className="text-gray-600 mb-6">Sistem Distribusi Sukashawarma</p>

        <div className="p-4 bg-suka-orange/10 border border-suka-orange rounded-lg">
          <p className="text-sm text-gray-600">Authentication coming in M1</p>
          <p className="text-xs text-gray-500 mt-2">
            For now, dashboard pages are accessible for testing.
          </p>
        </div>

        <a
          href="/dashboard"
          className="mt-6 block w-full py-2 px-4 bg-suka-orange text-white rounded-lg font-semibold text-center hover:bg-suka-orange/90 transition"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}
