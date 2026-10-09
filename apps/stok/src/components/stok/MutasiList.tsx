'use client';
import { format } from 'date-fns';
import Link from 'next/link';
import type { MutasiAntarOutlet, MutasiStatus } from '@/lib/types/mutasi';
import { Clock, XCircle, Package, Truck, CheckCircle2, ArrowRight } from 'lucide-react';

const statusColorMap: Record<MutasiStatus, string> = {
  menunggu_persetujuan: 'bg-amber-50 text-amber-800 border-amber-200',
  ditolak: 'bg-red-50 text-red-800 border-red-200',
  menunggu_pengiriman: 'bg-blue-50 text-blue-800 border-blue-200',
  dikirim: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  selesai: 'bg-green-50 text-green-800 border-green-200',
};

function StatusBadgeList({ status }: { status: MutasiStatus }) {
  const getIcon = () => {
    switch (status) {
      case 'menunggu_persetujuan': return <Clock className="w-3 h-3 text-amber-600" />;
      case 'ditolak': return <XCircle className="w-3 h-3 text-red-600" />;
      case 'menunggu_pengiriman': return <Package className="w-3 h-3 text-blue-600" />;
      case 'dikirim': return <Truck className="w-3 h-3 text-indigo-600" />;
      case 'selesai': return <CheckCircle2 className="w-3 h-3 text-green-600" />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'menunggu_persetujuan': return 'Menunggu Persetujuan';
      case 'ditolak': return 'Ditolak';
      case 'menunggu_pengiriman': return 'Menunggu Pengiriman';
      case 'dikirim': return 'Dikirim';
      case 'selesai': return 'Selesai';
    }
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider rounded-md border ${statusColorMap[status]}`}>
      {getIcon()}
      <span>{getLabel()}</span>
    </span>
  );
}

export function MutasiList({ items, emptyMessage }: { items: MutasiAntarOutlet[]; emptyMessage?: string }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 bg-white border border-[#d9c2b2]/40 rounded-2xl shadow-xs">
        <p className="text-[#544437]/60 font-medium text-xs">
          {emptyMessage || 'Belum ada riwayat mutasi antar outlet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((mutasi) => (
        <Link href={`/stok/mutasi/${mutasi.id}`} key={mutasi.id} className="block group">
          <div className="bg-white border border-[#d9c2b2]/40 rounded-2xl p-4 shadow-xs hover:border-suka-orange/50 transition-colors">
            <div className="flex justify-between items-start mb-3">
              <div>
                <StatusBadgeList status={mutasi.status} />
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
              <div className="text-suka-brown/30 shrink-0">
                <ArrowRight className="w-4 h-4" />
              </div>
              <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-2 text-center">
                <span className="block text-[10px] text-green-600 font-bold uppercase">Tujuan</span>
                <span className="block text-sm font-bold text-[#701604]">{mutasi.outlet_tujuan?.nama || '-'}</span>
              </div>
            </div>

            <div className="text-xs text-[#544437] font-medium border-t border-[#d9c2b2]/20 pt-3 flex justify-between">
              <span>{mutasi.items?.length || 0} Item Bahan</span>
              <span>Dibuat oleh: <span className="font-bold">{mutasi.creator?.name}</span></span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
