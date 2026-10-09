'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { useAuth } from '@suka/auth';
import { useOutletScope } from '@/hooks/useOutletScope';
import { useMutasiDetail, useMutasiActions } from '@/hooks/useMutasi';
import { canApproveMutasi } from '@/lib/stok/approver';
import { BottomNav } from '@/components/common/BottomNav';
import type { MutasiStatus } from '@/lib/types/mutasi';
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Package, 
  Truck, 
  PackageCheck,
  AlertCircle,
  X
} from 'lucide-react';

const statusColorMap: Record<MutasiStatus, string> = {
  menunggu_persetujuan: 'bg-amber-50 text-amber-800 border-amber-200',
  ditolak: 'bg-red-50 text-red-800 border-red-200',
  menunggu_pengiriman: 'bg-blue-50 text-blue-800 border-blue-200',
  dikirim: 'bg-indigo-50 text-indigo-800 border-indigo-200',
  selesai: 'bg-green-50 text-green-800 border-green-200',
};

function StatusBadge({ status }: { status: MutasiStatus }) {
  const getIcon = () => {
    switch (status) {
      case 'menunggu_persetujuan': return <Clock className="w-3.5 h-3.5 text-amber-600" />;
      case 'ditolak': return <XCircle className="w-3.5 h-3.5 text-red-600" />;
      case 'menunggu_pengiriman': return <Package className="w-3.5 h-3.5 text-blue-600" />;
      case 'dikirim': return <Truck className="w-3.5 h-3.5 text-indigo-600" />;
      case 'selesai': return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
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
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-extrabold uppercase tracking-wider rounded-lg border ${statusColorMap[status]}`}>
      {getIcon()}
      <span>{getLabel()}</span>
    </span>
  );
}

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

  // Rejection modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [catatanPenolakanInput, setCatatanPenolakanInput] = useState('');
  
  // Courier form (diisi oleh Kru / Leader di Outlet Asal)
  const [pengirimNama, setPengirimNama] = useState('');
  const [kurirProvider, setKurirProvider] = useState('');
  const [kurirResi, setKurirResi] = useState('');
  const [kurirOngkos, setKurirOngkos] = useState('');
  
  // Terima form (diisi oleh Kru / Leader di Outlet Tujuan)
  const [kondisi, setKondisi] = useState<Record<string, 'baik' | 'rusak' | 'hilang_qty'>>({});

  if (loading || !outletStaff) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fff8f1]">
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-4 border-suka-brown border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-suka-brown font-bold uppercase tracking-wider text-xs">Memuat Data Mutasi...</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fff8f1] p-4">
        <p className="text-[#544437]/70 font-bold mb-4 text-sm">Mutasi tidak ditemukan</p>
        <Link href="/stok/mutasi">
          <button className="bg-suka-orange hover:bg-orange-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer">Kembali ke Daftar</button>
        </Link>
      </div>
    );
  }

  // Otorisasi:
  // 1. Approval & Penolakan: Hanya Admin Kitchen (role 'kitchen') dan Admin / Owner / Developer
  const isPenyetuju = canApproveMutasi(outletStaff.role);

  // 2. Pengiriman: Diisi oleh Kru & Leader di Outlet Asal
  const isOutletAsal = data.outlet_asal_id === selectedOutletId || data.outlet_asal_id === outletStaff.outlet_id || ['admin', 'developer'].includes(outletStaff.role || '');
  const isPengirim = isOutletAsal && outletStaff.role !== 'kitchen';

  // 3. Penerimaan: Diterima oleh Kru & Leader di Outlet Tujuan
  const isOutletTujuan = data.outlet_tujuan_id === selectedOutletId || data.outlet_tujuan_id === outletStaff.outlet_id || ['admin', 'developer'].includes(outletStaff.role || '');
  const isPenerima = isOutletTujuan && outletStaff.role !== 'kitchen';

  const handleApprove = async () => {
    setBusy(true); 
    setErrorMsg(null);
    try {
      await approve(data.id, true);
      setSuccessMsg('Mutasi berhasil disetujui');
      refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menyetujui mutasi');
    } finally {
      setBusy(false);
    }
  };

  const handleRejectConfirm = async () => {
    if (!catatanPenolakanInput.trim()) {
      setErrorMsg('Alasan penolakan mutasi wajib diisi');
      return;
    }
    setBusy(true); 
    setErrorMsg(null);
    try {
      await approve(data.id, false, catatanPenolakanInput.trim());
      setSuccessMsg('Mutasi berhasil ditolak');
      setShowRejectModal(false);
      setCatatanPenolakanInput('');
      refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menolak mutasi');
    } finally {
      setBusy(false);
    }
  };

  const handleKirim = async () => {
    if (!kurirProvider.trim()) {
      setErrorMsg('Nama kurir atau pengantar harus diisi');
      return;
    }
    setBusy(true); 
    setErrorMsg(null);
    try {
      const itemsDikirim = data.items?.map((it: any) => ({
        item_id: it.id,
        qty_dikirim: it.qty_diajukan
      })) || [];
      
      await kirim(data.id, { 
        provider: kurirProvider.trim(), 
        resi: kurirResi.trim() || undefined,
        ongkos: kurirOngkos ? parseInt(kurirOngkos, 10) : undefined,
        pengirim_nama: (pengirimNama.trim() || outletStaff.name || '').trim()
      }, itemsDikirim);

      setSuccessMsg('Mutasi berhasil dikonfirmasi pengirimannya');
      refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirim mutasi');
    } finally {
      setBusy(false);
    }
  };

  const handleTerima = async () => {
    setBusy(true); 
    setErrorMsg(null);
    try {
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
      <header className="bg-white/95 backdrop-blur-md border-b border-suka-brown/10 px-4 sm:px-6 py-4 flex items-center justify-between shadow-2xs sticky top-0 z-40">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/stok/mutasi" className="shrink-0 w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-suka-brown/15 text-suka-brown hover:bg-suka-cream/50 active:scale-95 transition-all shadow-2xs">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-suka-brown tracking-tight truncate">
              Detail Mutasi Antar Outlet
            </h1>
            <p className="text-[10px] text-suka-brown/60 font-bold uppercase tracking-wider">
              ID: {data.id.slice(0, 8)}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 mt-6 space-y-6">
        {errorMsg && (
          <div className="bg-red-50 text-red-800 border border-red-200 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-500 hover:text-red-700 p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {successMsg && (
          <div className="bg-green-50 text-green-800 border border-green-200 p-4 rounded-2xl text-xs font-bold flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-green-500 hover:text-green-700 p-1 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Status Card */}
        <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <StatusBadge status={data.status} />
            <p className="text-[11px] text-suka-brown/60 font-medium sm:text-right">
              {format(new Date(data.created_at), 'dd MMM yyyy HH:mm')}<br/>
              Diajukan oleh: <span className="font-bold text-suka-brown">{data.creator?.name}</span>
            </p>
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <div className="flex-1 bg-orange-50 border border-orange-200/60 rounded-xl p-3 text-center">
              <span className="block text-[10px] text-suka-orange font-extrabold uppercase tracking-wider mb-0.5">Outlet Asal</span>
              <span className="block text-sm font-bold text-suka-brown">{data.outlet_asal?.nama}</span>
            </div>
            <div className="text-suka-brown/40 shrink-0">
              <ArrowRight className="w-5 h-5" />
            </div>
            <div className="flex-1 bg-green-50 border border-green-200/60 rounded-xl p-3 text-center">
              <span className="block text-[10px] text-green-700 font-extrabold uppercase tracking-wider mb-0.5">Outlet Tujuan</span>
              <span className="block text-sm font-bold text-suka-brown">{data.outlet_tujuan?.nama}</span>
            </div>
          </div>
          
          {data.catatan_pengajuan && (
            <div className="p-3 bg-suka-cream/30 rounded-xl text-xs text-[#544437]">
              <span className="font-bold">Catatan Pengajuan:</span> {data.catatan_pengajuan}
            </div>
          )}
          {data.catatan_penolakan && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800">
              <span className="font-bold">Alasan Penolakan:</span> {data.catatan_penolakan}
            </div>
          )}
          {data.status !== 'menunggu_persetujuan' && data.status !== 'ditolak' && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Telah disetujui oleh:</span> {data.approver?.name || 'Admin Kitchen'}
                <span className="block text-[10px] text-green-700/80 mt-0.5 font-medium">
                  Pada: {data.approved_at ? format(new Date(data.approved_at), 'dd MMM yyyy HH:mm') : format(new Date(data.updated_at), 'dd MMM yyyy HH:mm')}
                </span>
              </div>
            </div>
          )}
          {data.status === 'selesai' && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 flex items-start gap-2">
              <PackageCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Telah diterima oleh:</span> {data.receiver?.name || 'Kru Outlet Tujuan'}
                <span className="block text-[10px] text-blue-700/80 mt-0.5 font-medium">
                  Pada: {data.received_at ? format(new Date(data.received_at), 'dd MMM yyyy HH:mm') : format(new Date(data.updated_at), 'dd MMM yyyy HH:mm')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Courier Info if exists */}
        {data.kurir_info && (
          <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-xs">
            <h2 className="font-bold text-suka-brown mb-3 border-b border-suka-brown/10 pb-2 text-xs uppercase tracking-wider">
              Informasi Pengiriman & Kurir
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <p className="text-suka-brown/60 font-bold uppercase text-[10px]">Kru Pengirim</p>
                <p className="font-semibold text-[#1e1b15] mt-0.5">{(data.kurir_info as any).pengirim_nama || '-'}</p>
              </div>
              <div>
                <p className="text-suka-brown/60 font-bold uppercase text-[10px]">Kurir / Ekspedisi</p>
                <p className="font-semibold text-[#1e1b15] mt-0.5">{data.kurir_info.provider || (data.kurir_info as any).nama || '-'}</p>
              </div>
              <div>
                <p className="text-suka-brown/60 font-bold uppercase text-[10px]">Resi / Tracking</p>
                <p className="font-semibold text-[#1e1b15] mt-0.5">{data.kurir_info.resi || '-'}</p>
              </div>
              <div>
                <p className="text-suka-brown/60 font-bold uppercase text-[10px]">Ongkos Kirim</p>
                <p className="font-semibold text-suka-orange mt-0.5">
                  {data.kurir_info.ongkos ? `Rp ${data.kurir_info.ongkos.toLocaleString('id-ID')}` : '-'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="bg-white rounded-2xl p-5 border border-suka-brown/10 shadow-xs">
          <h2 className="font-bold text-suka-brown mb-3 border-b border-suka-brown/10 pb-2 text-xs uppercase tracking-wider">
            Rincian Item Bahan Baku ({data.items?.length || 0})
          </h2>
          <div className="space-y-3">
            {data.items?.map((item: any) => (
              <div key={item.id} className="flex justify-between items-center py-2.5 border-b border-suka-brown/10 last:border-0 last:pb-0">
                <div>
                  <h3 className="font-bold text-sm text-[#1e1b15]">{item.bahan_baku?.nama || '-'}</h3>
                  {data.status === 'selesai' && (
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md mt-1 inline-block ${
                      item.kondisi_diterima === 'baik' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-red-100 text-red-700'
                    }`}>
                      Kondisi: {item.kondisi_diterima === 'baik' ? 'Baik' : item.kondisi_diterima === 'rusak' ? 'Rusak' : 'Hilang / Kurang'}
                    </span>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="font-bold text-suka-brown text-sm">{item.qty_diajukan} {item.bahan_baku?.satuan}</div>
                  {(item.qty_dikirim !== undefined && item.qty_dikirim !== null) && (
                    <div className="text-[10px] text-blue-600 font-bold uppercase mt-0.5">Dikirim: {item.qty_dikirim}</div>
                  )}
                  {(item.qty_diterima !== undefined && item.qty_diterima !== null) && (
                    <div className="text-[10px] text-green-600 font-bold uppercase mt-0.5">Diterima: {item.qty_diterima}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions based on role and status */}
        <div className="space-y-4 pt-2 pb-8">
          
          {/* Action 1: Approval & Tolak (HANYA Admin Kitchen / Admin / Owner) */}
          {data.status === 'menunggu_persetujuan' && isPenyetuju && (
            <div className="bg-white rounded-2xl p-5 border border-amber-200 shadow-xs space-y-3">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-amber-900">
                Otorisasi Admin Kitchen
              </h3>
              <p className="text-xs text-suka-brown/70">
                Pastikan ketersediaan stok fisik di outlet asal sebelum menyetujui mutasi ini.
              </p>
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowRejectModal(true)}
                  disabled={busy}
                  className="flex-1 py-3.5 bg-white border border-red-300 text-red-700 font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-red-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  Tolak Mutasi
                </button>
                <button 
                  onClick={handleApprove}
                  disabled={busy}
                  className="flex-[2] py-3.5 bg-[#0a7d2c] hover:bg-green-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer"
                >
                  {busy ? 'Memproses...' : 'Setujui Mutasi'}
                </button>
              </div>
            </div>
          )}

          {data.status === 'menunggu_persetujuan' && !isPenyetuju && (
            <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-amber-900">
                Menunggu persetujuan dari Admin Kitchen (Pusat).
              </p>
            </div>
          )}

          {/* Action 2: Kirim & Courier (Diisi oleh Kru & Leader di Outlet Asal) */}
          {data.status === 'menunggu_pengiriman' && isPengirim && (
            <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-xs space-y-4">
              <div className="border-b border-blue-100 pb-2">
                <h2 className="font-extrabold text-blue-900 text-xs uppercase tracking-wider">Form Pengiriman (Outlet Asal)</h2>
                <p className="text-[11px] text-blue-700/80 mt-0.5">Kru / Leader outlet asal wajib mengisi data pengiriman fisik barang.</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-extrabold text-suka-brown/70 uppercase tracking-wider mb-1">
                    Nama Kru Pengirim
                  </label>
                  <input 
                    type="text" 
                    value={pengirimNama || outletStaff.name || ''}
                    onChange={(e) => setPengirimNama(e.target.value)}
                    placeholder="Nama kru yang menyiapkan kiriman"
                    className="w-full bg-[#f9f5f1] border border-suka-brown/20 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-suka-orange outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-suka-brown/70 uppercase tracking-wider mb-1">
                    Nama Kurir / Pengantar (Contoh: Lalamove, Gosend, Kru Sendiri) *
                  </label>
                  <input 
                    type="text" 
                    value={kurirProvider}
                    onChange={(e) => setKurirProvider(e.target.value)}
                    placeholder="Masukkan nama kurir atau ekspedisi"
                    className="w-full bg-[#f9f5f1] border border-suka-brown/20 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-suka-orange outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-suka-brown/70 uppercase tracking-wider mb-1">
                    Nomor Resi / Link Tracking (Opsional)
                  </label>
                  <input 
                    type="text" 
                    value={kurirResi}
                    onChange={(e) => setKurirResi(e.target.value)}
                    placeholder="Resi atau kode pengiriman"
                    className="w-full bg-[#f9f5f1] border border-suka-brown/20 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-suka-orange outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-suka-brown/70 uppercase tracking-wider mb-1">
                    Ongkos Kirim (Opsional)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-suka-brown/50 font-bold text-xs">Rp</span>
                    <input 
                      type="number" 
                      value={kurirOngkos}
                      onChange={(e) => setKurirOngkos(e.target.value)}
                      placeholder="0"
                      className="w-full bg-[#f9f5f1] border border-suka-brown/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-suka-orange outline-none"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleKirim}
                disabled={busy || !kurirProvider.trim()}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xs disabled:opacity-50 mt-2 cursor-pointer active:scale-95"
              >
                {busy ? 'Mengirim Data...' : 'Konfirmasi Pengiriman & Potong Stok Asal'}
              </button>
            </div>
          )}

          {data.status === 'menunggu_pengiriman' && !isPengirim && (
            <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-blue-900">
                Menunggu pengiriman fisik dan input kurir dari Kru Outlet Asal ({data.outlet_asal?.nama}).
              </p>
            </div>
          )}

          {/* Action 3: Terima (Diisi oleh Kru & Leader di Outlet Tujuan) */}
          {data.status === 'dikirim' && isPenerima && (
            <div className="bg-white rounded-2xl p-5 border border-green-200 shadow-xs space-y-4">
              <div className="border-b border-green-100 pb-2">
                <h2 className="font-extrabold text-green-900 text-xs uppercase tracking-wider">Penerimaan Barang (Outlet Tujuan)</h2>
                <p className="text-[11px] text-green-700/80 mt-0.5">Periksa kondisi fisik setiap bahan baku yang tiba sebelum konfirmasi.</p>
              </div>
              
              <div className="space-y-3 mb-4">
                {data.items?.map((item: any) => (
                  <div key={item.id} className="p-3 bg-suka-cream/30 border border-suka-brown/10 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-suka-brown">{item.bahan_baku?.nama}</span>
                      <span className="text-[11px] font-semibold text-blue-700">Dikirim: {item.qty_dikirim || item.qty_diajukan} {item.bahan_baku?.satuan}</span>
                    </div>

                    {/* Custom Segmented Control untuk kondisi fisik (Bukan native select) */}
                    <div className="flex bg-white p-1 rounded-xl border border-suka-brown/15 gap-1">
                      {(['baik', 'rusak', 'hilang_qty'] as const).map((k) => {
                        const isSelected = (kondisi[item.id] || 'baik') === k;
                        return (
                          <button
                            key={k}
                            type="button"
                            onClick={() => setKondisi(prev => ({ ...prev, [item.id]: k }))}
                            className={`flex-1 py-1.5 px-2 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-suka-orange text-white shadow-2xs'
                                : 'text-suka-brown/70 hover:bg-suka-cream/40'
                            }`}
                          >
                            {k === 'baik' ? 'Baik' : k === 'rusak' ? 'Rusak' : 'Hilang / Kurang'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button 
                onClick={handleTerima}
                disabled={busy}
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-xs disabled:opacity-50 cursor-pointer active:scale-95"
              >
                {busy ? 'Menyimpan...' : 'Terima Barang & Tambah Stok Tujuan'}
              </button>
            </div>
          )}

          {data.status === 'dikirim' && !isPenerima && (
            <div className="bg-indigo-50/60 border border-indigo-200/80 rounded-2xl p-4 text-center">
              <p className="text-xs font-bold text-indigo-900">
                Barang sedang dalam perjalanan menuju Kru Outlet Tujuan ({data.outlet_tujuan?.nama}).
              </p>
            </div>
          )}

        </div>
      </main>

      {/* Modal Custom Penolakan Mutasi (Bukan native window.prompt) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-2xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl border border-suka-brown/15 shadow-xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-suka-brown/10 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wider text-red-900 flex items-center gap-2">
                <XCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>Tolak Pengajuan Mutasi</span>
              </h3>
              <button 
                onClick={() => { setShowRejectModal(false); setCatatanPenolakanInput(''); }} 
                className="text-suka-brown/60 hover:text-suka-brown p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-suka-brown/80">
                Alasan Penolakan (Wajib Diisi):
              </label>
              <textarea 
                value={catatanPenolakanInput}
                onChange={(e) => setCatatanPenolakanInput(e.target.value)}
                placeholder="Contoh: Stok di outlet asal juga menipis / Pengajuan ditolak oleh kitchen pusat"
                rows={3}
                className="w-full bg-[#f9f5f1] border border-suka-brown/20 rounded-xl p-3 text-xs font-medium text-[#1e1b15] focus:ring-2 focus:ring-red-500 outline-none resize-none"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button 
                type="button"
                onClick={() => { setShowRejectModal(false); setCatatanPenolakanInput(''); }}
                className="flex-1 py-2.5 bg-suka-cream/40 hover:bg-suka-cream/70 text-suka-brown text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button 
                type="button"
                onClick={handleRejectConfirm}
                disabled={busy || !catatanPenolakanInput.trim()}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                {busy ? 'Menolak...' : 'Konfirmasi Tolak'}
              </button>
            </div>
          </div>
        </div>
      )}
      
      <BottomNav />
    </div>
  );
}
