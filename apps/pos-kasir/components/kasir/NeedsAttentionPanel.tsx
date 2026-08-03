'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, RotateCw, Trash2 } from 'lucide-react';
import { db } from '@/lib/db';
import { deleteLocalOrder, retryLocalOrderSync } from '@/lib/offline';

/**
 * Pesanan offline yang ditolak server secara permanen.
 *
 * Sengaja TIDAK dihapus otomatis: uangnya sudah diterima kasir, jadi
 * menghilangkannya diam-diam sama dengan kehilangan penjualan. Kasir yang
 * memutuskan mengirim ulang atau membatalkan.
 */
export default function NeedsAttentionPanel({ outletId }: { outletId: string }) {
  const stuck = useLiveQuery(
    () =>
      db.local_orders
        .where('outlet_id')
        .equals(outletId)
        .filter((r) => r.needs_attention === 1)
        .toArray(),
    [outletId]
  );

  if (!stuck || stuck.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-red-600" />
        <h3 className="font-semibold text-red-800">
          Perlu Perhatian: {stuck.length} Pesanan Gagal Sinkron
        </h3>
      </div>
      <p className="text-sm text-red-700 mb-4 leading-relaxed">
        Pesanan di bawah ini ditolak oleh server dan tidak akan dikirim ulang secara otomatis.
        Uang sudah Anda terima, harap periksa pesannya. Anda bisa mencoba mengirim ulang atau menghapusnya jika memang salah.
      </p>

      <div className="flex flex-col gap-3">
        {stuck.map((order) => (
          <div key={order.id} className="bg-white rounded border border-red-100 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="font-medium text-gray-900 mb-1">
                {order.data?.customer_name || 'Pelanggan'} • {String(order.data?.payment_method || 'CASH').toUpperCase()}
              </div>
              <div className="text-xs text-red-600 bg-red-50 inline-block px-2 py-1 rounded font-mono">
                {order.sync_error || 'Ditolak server'}
              </div>
            </div>
            
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => retryLocalOrderSync(order.id)}
                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium rounded transition-colors"
              >
                <RotateCw className="w-4 h-4" />
                Coba Lagi
              </button>
              <button
                onClick={() => {
                  if (confirm('Hapus pesanan ini dari perangkat? Awas: riwayat transaksi ini akan hilang.')) {
                    deleteLocalOrder(order.id);
                  }
                }}
                className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm font-medium rounded transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Hapus
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
