import { WifiOff, Bell, PlusCircle, ClipboardList, BarChart3, Wallet, Sandwich } from 'lucide-react';
import Link from 'next/link';

const OFFLINE_ROUTES = [
  { href: '/kasir', label: 'Papan Order', icon: Bell },
  { href: '/kasir/order-manual', label: 'Pesanan Baru', icon: PlusCircle },
  { href: '/kasir/histori', label: 'Histori', icon: ClipboardList },
  { href: '/kasir/reports', label: 'Laporan', icon: BarChart3 },
  { href: '/kasir/shift', label: 'Petty Cash', icon: Wallet },
  { href: '/kasir/menu', label: 'Manajemen Menu', icon: Sandwich },
];

export default function OfflineFallbackPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] text-center p-6">
      <div className="w-20 h-20 bg-orange-100 text-orange-500 rounded-full flex items-center justify-center mb-6">
        <WifiOff size={40} />
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Anda Sedang Offline</h1>
      <p className="text-gray-600 max-w-md mb-8">
        Halaman ini belum tersimpan di perangkat. Buka salah satu halaman kasir di bawah — semuanya
        tetap bisa dipakai tanpa internet. Transaksi akan otomatis tersinkron saat online kembali.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full max-w-lg">
        {OFFLINE_ROUTES.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center gap-2 bg-white border border-[#d9c2b2] hover:border-[#f29744] rounded-2xl p-4 shadow-sm transition-colors"
          >
            <div className="w-11 h-11 rounded-xl bg-[#f5ede3] text-[#f29744] flex items-center justify-center">
              <Icon size={22} />
            </div>
            <span className="text-sm font-bold text-[#1e1b15]">{label}</span>
          </Link>
        ))}
      </div>

      <p className="text-xs text-gray-400 mt-8">
        Tip: buka aplikasi sekali saat ada internet supaya semua halaman tersimpan untuk mode offline.
      </p>
    </div>
  );
}
