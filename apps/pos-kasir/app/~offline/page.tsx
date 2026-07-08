import { WifiOff } from 'lucide-react';
import Link from 'next/link';

export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4">
      <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-6">
        <WifiOff size={40} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Anda Sedang Offline</h1>
      <p className="text-gray-600 max-w-md mb-8">
        Halaman ini belum tersimpan di perangkat Anda. Silakan kembali ke halaman utama Kasir yang sudah didukung secara offline.
      </p>
      <Link 
        href="/"
        className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-8 rounded-lg shadow transition-colors"
      >
        Kembali ke Kasir (Offline Mode)
      </Link>
    </div>
  );
}
