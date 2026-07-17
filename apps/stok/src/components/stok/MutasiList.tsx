'use client';
import { format } from 'date-fns';

import Link from 'next/link';
import type { MutasiAntarOutlet } from '@/lib/types/mutasi';

const statusColorMap = {
  menunggu_persetujuan: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  ditolak: 'bg-red-100 text-red-800 border-red-200',
  menunggu_pengiriman: 'bg-blue-100 text-blue-800 border-blue-200',
  dikirim: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  selesai: 'bg-green-100 text-green-800 border-green-200',
};

const statusLabelMap = {
  menunggu_persetujuan: '⏳ Menunggu Persetujuan',
  ditolak: '❌ Ditolak',
  menunggu_pengiriman: '📦 Menunggu Pengiriman',
  dikirim: '🚚 Dikirim',
  selesai: '✅ Selesai',
};

export function MutasiList({ items }: { items: MutasiAntarOutlet[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 bg-white border border-[#d9c2b2]/40 rounded-2xl shadow-sm">
        <p className="text-[#544437]/60 font-medium">Belum ada riwayat mutasi antar outlet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((mutasi) => (
        <Link href={`/stok/mutasi/${mutasi.id}`} key={mutasi.id} className="block group">
          <div className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-4 shadow-[0px_4px_12px_rgba(144,77,0,0.03)] hover:border-[#f29744]/50 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <span className={`inline-block px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md border ${statusColorMap[mutasi.status]}`}>
                  {statusLabelMap[mutasi.status]}
                </span>
                <p className="text-xs text-[#544437]/60 mt-2 font-medium">
                  {format(new Date(mutasi.created_at), 'dd MMM yyyy HH:mm')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg p-2 text-center">
                <span className="block text-[10px] text-orange-600 font-bold uppercase">Asal</span>
                <span className="block text-sm font-bold text-[#701604]">{mutasi.outlet_asal?.nama || '-'}</span>
              </div>
              <div className="text-xl text-[#d9c2b2]">{'➔'}</div>
              <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-2 text-center">
                <span className="block text-[10px] text-green-600 font-bold uppercase">Tujuan</span>
                <span className="block text-sm font-bold text-[#701604]">{mutasi.outlet_tujuan?.nama || '-'}</span>
              </div>
            </div>

            <div className="text-xs text-[#544437] font-medium border-t border-[#d9c2b2]/20 pt-3 flex justify-between">
              <span>{mutasi.items?.length || 0} Item</span>
              <span>Dibuat oleh: {mutasi.creator?.name}</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
