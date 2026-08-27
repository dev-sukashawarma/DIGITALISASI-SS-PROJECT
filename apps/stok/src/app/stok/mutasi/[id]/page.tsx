'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useMutasiDetail, useMutasiActions } from '@/hooks/useMutasi';
import { BottomNav } from '@/components/common/BottomNav';

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

export default function MutasiDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: mutasiId } = use(params);
  
  const { outletStaff } = useAuth();
  const { selectedOutletId } = useOutletScope();
  
  const { data, loading, refresh } = useMutasiDetail(mutasiId);
  const { approve, kirim, terima } = useMutasiActions();
  
  // Action states
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Courier form
  const [kurirProvider, setKurirProvider] = useState('');
  const [kurirResi, setKurirResi] = useState('');
  const [kurirOngkos, setKurirOngkos] = useState('');
  
  // Terima form
  const [kondisi, setKondisi] = useState<Record<string, string>>({});

  if (loading || !outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#701604] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-[#701604] font-bold uppercase tracking-wider text-sm">Memuat Data...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] p-4">
        <p className="text-[#544437]/60 font-bold mb-4">Mutasi tidak ditemukan</p>
        <Link href="/stok/mutasi">
          <button className="bg-[#f29744] text-white px-6 py-2 rounded-xl font-bold">Kembali</button>
        </Link>
      </div>
    );
  }

  const isGudangRole = ['admin', 'spv', 'regional_manager', 'owner', 'kitchen', 'admin_finance', 'finance'].includes(outletStaff.role || '');
  const isAsal = data.outlet_asal_id === selectedOutletId || data.outlet_asal_id === outletStaff.outlet_id || isGudangRole;
  const isTujuan = data.outlet_tujuan_id === selectedOutletId || data.outlet_tujuan_id === outletStaff.outlet_id || isGudangRole;

  const handleApprove = async (isApproved: boolean) => {
    setBusy(true); setErrorMsg(null);
    try {
      const catatanPenolakan = isApproved ? undefined : window.prompt('Alasan penolakan?');
      if (!isApproved && catatanPenolakan === null) {
        setBusy(false);
        return;
      }
      
      await approve(data.id, isApproved, catatanPenolakan || undefined);
      setSuccessMsg(`Mutasi berhasil ${isApproved ? 'disetujui' : 'ditolak'}`);
      refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengubah status');
    } finally {
      setBusy(false);
    }
  };

  const handleKirim = async () => {
    if (!kurirProvider) {
      setErrorMsg('Provider kurir harus diisi');
      return;
    }
    setBusy(true); setErrorMsg(null);
    try {
      // For simplicity, we just send all diajukan qty as dikirim qty. 
      // If we wanted partial, we'd need inputs for qty_dikirim.
      const itemsDikirim = data.items?.map((it: any) => ({
        item_id: it.id,
        qty_dikirim: it.qty_diajukan
      })) || [];
      
      await kirim(data.id, { 
        provider: kurirProvider, 
        resi: kurirResi,
        ongkos: kurirOngkos ? parseInt(kurirOngkos) : undefined
      }, itemsDikirim);
      setSuccessMsg('Mutasi berhasil dikirim');
      refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim mutasi');
    } finally {
      setBusy(false);
    }
  };

  const handleTerima = async () => {
    setBusy(true); setErrorMsg(null);
    try {
      // For simplicity, we receive all dikirim qty.
      const itemsDiterima = data.items?.map((it: any) => ({
        item_id: it.id,
        qty_diterima: it.qty_dikirim || it.qty_diajukan,
        kondisi_diterima: kondisi[it.id] || 'baik'
      })) || [];
      
      await terima(data.id, itemsDiterima);
      setSuccessMsg('Mutasi berhasil diterima');
      refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menerima mutasi');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fff8f1] text-[#1e1b15] pb-32">
      <header className="bg-[#fff8f1] border-b border-[#d9c2b2]/30 px-4 py-4 flex items-center justify-between shadow-[0_2px_8px_rgba(144,77,0,0.03)] sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/stok/mutasi" className="shrink-0 w-9 h-9 flex items-center justify-center rounded-full bg-white border border-[#d9c2b2]/30 text-[#f29744] hover:bg-orange-50 active:scale-95 transition-all shadow-sm">
            <span className="text-base">←</span>
          </Link>
          <h1 className="text-xl font-extrabold text-[#701604] tracking-tight truncate">
            Detail Mutasi
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6 space-y-6">
        {errorMsg && (
          <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-sm font-bold flex justify-between">
            <span>{errorMsg}</span>
            <button onClick={() => setErrorMsg(null)}>✕</button>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 text-green-700 border border-green-200 p-4 rounded-xl text-sm font-bold flex justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg(null)}>✕</button>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/40 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <span className={`inline-block px-3 py-1 text-xs font-extrabold uppercase tracking-wider rounded-md border ${statusColorMap[data.status]}`}>
              {statusLabelMap[data.status]}
            </span>
            <p className="text-xs text-[#544437]/60 font-medium text-right">
              {format(new Date(data.created_at), 'dd MMM yyyy HH:mm')}<br/>
              Oleh: {data.creator?.name}
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-orange-50 border border-orange-100 rounded-lg p-3 text-center">
              <span className="block text-xs text-orange-600 font-bold uppercase mb-1">Dari</span>
              <span className="block text-base font-bold text-[#701604]">{data.outlet_asal?.nama}</span>
            </div>
            <div className="text-2xl text-[#d9c2b2]">{'➔'}</div>
            <div className="flex-1 bg-green-50 border border-green-100 rounded-lg p-3 text-center">
              <span className="block text-xs text-green-600 font-bold uppercase mb-1">Ke</span>
              <span className="block text-base font-bold text-[#701604]">{data.outlet_tujuan?.nama}</span>
            </div>
          </div>
          
          {data.catatan_pengajuan && (
            <div className="mt-4 p-3 bg-[#f9f5f1] rounded-xl text-sm text-[#544437]">
              <strong>Catatan:</strong> {data.catatan_pengajuan}
            </div>
          )}
          {data.catatan_penolakan && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
              <strong>Alasan Penolakan:</strong> {data.catatan_penolakan}
            </div>
          )}
          {data.status !== 'menunggu_persetujuan' && data.status !== 'ditolak' && (
            <div className="mt-4 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-800">
              <strong>✅ Telah disetujui oleh:</strong> {data.approver?.name || 'Pusat / Gudang'} 
              <span className="block text-xs mt-0.5 opacity-80 font-medium">
                Pada: {data.approved_at ? format(new Date(data.approved_at), 'dd MMM yyyy HH:mm') : format(new Date(data.updated_at), 'dd MMM yyyy HH:mm')}
              </span>
            </div>
          )}
          {data.status === 'selesai' && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-800">
              <strong>📦 Telah diterima oleh:</strong> {data.receiver?.name || 'Kru Outlet'} 
              <span className="block text-xs mt-0.5 opacity-80 font-medium">
                Pada: {data.received_at ? format(new Date(data.received_at), 'dd MMM yyyy HH:mm') : format(new Date(data.updated_at), 'dd MMM yyyy HH:mm')}
              </span>
            </div>
          )}
        </div>

        {/* Courier Info if exists */}
        {data.kurir_info && (
          <div className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/40 shadow-sm">
            <h2 className="font-bold text-[#701604] mb-3 border-b border-[#d9c2b2]/30 pb-2">Informasi Kurir</h2>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-[#544437]/60 font-bold uppercase text-[10px]">Kurir</p>
                <p className="font-medium text-[#1e1b15]">{data.kurir_info.provider}</p>
              </div>
              <div>
                <p className="text-[#544437]/60 font-bold uppercase text-[10px]">Resi / Tracking</p>
                <p className="font-medium text-[#1e1b15]">{data.kurir_info.resi || '-'}</p>
              </div>
              <div>
                <p className="text-[#544437]/60 font-bold uppercase text-[10px]">Ongkos</p>
                <p className="font-medium text-[#1e1b15]">
                  {data.kurir_info.ongkos ? `Rp ${data.kurir_info.ongkos.toLocaleString('id-ID')}` : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="bg-white rounded-2xl p-5 border border-[#d9c2b2]/40 shadow-sm">
          <h2 className="font-bold text-[#701604] mb-3 border-b border-[#d9c2b2]/30 pb-2">Item Mutasi</h2>
          <div className="space-y-3">
            {data.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center py-2 border-b border-[#d9c2b2]/20 last:border-0 last:pb-0">
                <div>
                  <h3 className="font-bold text-sm text-[#1e1b15]">{item.bahan_baku?.nama || '-'}</h3>
                  {data.status === 'selesai' && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mt-1 inline-block ${
                      item.kondisi_diterima === 'baik' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.kondisi_diterima}
                    </span>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-[#701604]">{item.qty_diajukan} {item.bahan_baku?.satuan}</div>
                  {(item.qty_dikirim !== undefined && item.qty_dikirim !== null) && (
                    <div className="text-[10px] text-blue-600 font-bold uppercase">Dikirim: {item.qty_dikirim}</div>
                  )}
                  {(item.qty_diterima !== undefined && item.qty_diterima !== null) && (
                    <div className="text-[10px] text-green-600 font-bold uppercase">Diterima: {item.qty_diterima}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions based on role and status */}
        <div className="space-y-4 pt-2 pb-8">
          
          {/* Action: Approve (Gudang/SPV) */}
          {data.status === 'menunggu_persetujuan' && isGudangRole && (
            <div className="flex gap-3">
              <button 
                onClick={() => handleApprove(false)}
                disabled={busy}
                className="flex-1 py-4 bg-white border border-red-200 text-red-600 font-bold rounded-2xl hover:bg-red-50 transition-colors shadow-sm disabled:opacity-50"
              >
                Tolak Mutasi
              </button>
              <button 
                onClick={() => handleApprove(true)}
                disabled={busy}
                className="flex-[2] py-4 bg-[#0a7d2c] hover:bg-green-700 text-white font-bold rounded-2xl transition-colors shadow-sm disabled:opacity-50"
              >
                Setujui Mutasi
              </button>
            </div>
          )}

          {/* Action: Kirim & Courier (Outlet Asal) */}
          {data.status === 'menunggu_pengiriman' && isAsal && (
            <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm space-y-4">
              <h2 className="font-bold text-blue-800 border-b border-blue-100 pb-2">Pengiriman Kurir</h2>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-[#544437]/70 uppercase mb-1">Nama Kurir (Misal: Lalamove)</label>
                  <input 
                    type="text" 
                    value={kurirProvider}
                    onChange={(e) => setKurirProvider(e.target.value)}
                    className="w-full bg-[#f9f5f1] border border-[#d9c2b2]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#f29744] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#544437]/70 uppercase mb-1">Tracking / Resi (Opsional)</label>
                  <input 
                    type="text" 
                    value={kurirResi}
                    onChange={(e) => setKurirResi(e.target.value)}
                    className="w-full bg-[#f9f5f1] border border-[#d9c2b2]/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-[#f29744] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#544437]/70 uppercase mb-1">Ongkos Kirim (Opsional)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-[#544437]/60 font-medium text-sm">Rp</span>
                    <input 
                      type="number" 
                      value={kurirOngkos}
                      onChange={(e) => setKurirOngkos(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#f9f5f1] border border-[#d9c2b2]/50 rounded-xl pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-[#f29744] outline-none"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleKirim}
                disabled={busy || !kurirProvider}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 mt-2"
              >
                Konfirmasi Pengiriman
              </button>
            </div>
          )}

          {/* Action: Terima (Outlet Tujuan) */}
          {data.status === 'dikirim' && isTujuan && (
            <div className="bg-white rounded-2xl p-5 border border-green-200 shadow-sm space-y-4">
              <h2 className="font-bold text-green-800 border-b border-green-100 pb-2">Penerimaan Barang</h2>
              
              <div className="space-y-3 mb-4">
                {data.items?.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{item.bahan_baku?.nama} (Kirim: {item.qty_dikirim})</span>
                    <select 
                      value={kondisi[item.id] || 'baik'}
                      onChange={(e) => setKondisi(prev => ({...prev, [item.id]: e.target.value}))}
                      className="bg-[#f9f5f1] border border-[#d9c2b2]/50 rounded-lg px-2 py-1 text-xs outline-none"
                    >
                      <option value="baik">Baik</option>
                      <option value="rusak">Rusak</option>
                      <option value="hilang_qty">Hilang/Kurang</option>
                    </select>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleTerima}
                disabled={busy}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50"
              >
                Terima Barang
              </button>
            </div>
          )}

        </div>
      </main>
      
      <BottomNav />
    </div>
  );
}
