'use client';

import { useState, useRef } from 'react';
import { previewAllSettlementFiles, syncAllSettlementData } from '@/app/actions/platformSettlement';
import type { MultiPlatformSummary } from '@/app/actions/platformSettlement';
import { useOutlets } from '@/hooks/useOutlets';

const PLATFORMS = [
  { id: 'shopeefood', label: 'ShopeeFood', accept: '.xlsx,.xls', color: 'orange', emoji: '🟠' },
  { id: 'grabfood',   label: 'GrabFood',   accept: '.csv',       color: 'green',  emoji: '🟢' },
  { id: 'gofood',     label: 'GoFood',     accept: '.xlsx,.xls', color: 'red',    emoji: '🔴' },
  { id: 'tiktokgo',   label: 'TikTok Go',  accept: '.xlsx,.xls', color: 'gray',   emoji: '⚫' },
];

const rp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const pct = (a: number, b: number) => b > 0 ? ((a / b) * 100).toFixed(1) + '%' : '-';

export default function PlatformSettlementPage() {
  const { data: outlets = [] } = useOutlets();
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [selectedOutlets, setSelectedOutlets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<MultiPlatformSummary | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncMsg, setSyncMsg] = useState('');
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const toggleOutlet = (id: string) => {
    setSelectedOutlets((prev) =>
      prev.includes(id) ? prev.filter((o) => o !== id) : [...prev, id]
    );
    setSummary(null); setErrorMsg(''); setSyncMsg('');
  };

  const selectAll = () => setSelectedOutlets(outlets.map((o) => o.id));
  const clearAll = () => setSelectedOutlets([]);

  const handleFile = (platformId: string, file: File | null) => {
    setFiles((prev) => ({ ...prev, [platformId]: file }));
    setSummary(null); setErrorMsg(''); setSyncMsg('');
  };

  const filesUploaded = Object.values(files).filter(Boolean).length;

  const handlePreview = async () => {
    if (!from || !to) { setErrorMsg('Pilih periode terlebih dahulu.'); return; }
    if (filesUploaded === 0) { setErrorMsg('Upload minimal 1 file settlement.'); return; }
    if (selectedOutlets.length === 0) { setErrorMsg('Pilih minimal 1 outlet.'); return; }
    setLoading(true); setErrorMsg(''); setSyncMsg('');
    try {
      const fd = new FormData();
      fd.append('from', from); fd.append('to', to);
      fd.append('outletIds', JSON.stringify(selectedOutlets));
      for (const p of PLATFORMS) {
        if (files[p.id]) fd.append(`file_${p.id}`, files[p.id]!);
      }
      const res = await previewAllSettlementFiles(fd);
      if (res.success) setSummary(res.summary);
      else setErrorMsg(res.error || 'Gagal memproses file.');
    } catch (e: any) { setErrorMsg(e.message); }
    finally { setLoading(false); }
  };

  const handleSync = async () => {
    if (!summary) return;
    setLoading(true); setErrorMsg('');
    try {
      const res = await syncAllSettlementData(summary.allDaily);
      if (res.success) {
        setSyncMsg(`✅ Berhasil menyimpan ${res.savedRows} baris rekap harian ke database.`);
        setSummary(null);
        setFiles({});
        PLATFORMS.forEach((p) => { if (fileRefs.current[p.id]) fileRefs.current[p.id]!.value = ''; });
      } else setErrorMsg(res.error || 'Gagal menyimpan.');
    } catch (e: any) { setErrorMsg(e.message); }
    finally { setLoading(false); }
  };

  const s = summary;
  const selisihTotal = s ? s.totalOmzetKotor - s.pawoonOmzetKotor : 0;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Import Settlement Food Apps</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Upload laporan settlement dari semua platform dalam satu langkah, bandingkan dengan data Pawoon, lalu sync.
        </p>
      </div>

      {/* ── STEP 1: Periode ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-4 text-gray-800">1. Pilih Periode & Outlet</h2>
        <div className="flex flex-wrap gap-4 items-center mb-5">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Dari Tanggal</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 font-medium">Sampai Tanggal</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {from && to && (
            <div className="mt-4 text-sm text-blue-700 bg-blue-50 px-3 py-2 rounded-lg font-medium">
              Periode: {from} s/d {to}
            </div>
          )}
        </div>

        {/* Outlet selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500 font-medium">Pilih Outlet yang akan direkonsiliasi</label>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-blue-600 hover:underline">Pilih Semua</button>
              <span className="text-gray-300">|</span>
              <button onClick={clearAll} className="text-xs text-red-500 hover:underline">Hapus Semua</button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {outlets.map((o) => (
              <button
                key={o.id}
                onClick={() => toggleOutlet(o.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  selectedOutlets.includes(o.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'
                }`}
              >
                {o.name}
              </button>
            ))}
          </div>
          {selectedOutlets.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">{selectedOutlets.length} outlet dipilih</p>
          )}
        </div>
      </div>

      {/* ── STEP 2: Upload semua platform ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-bold text-lg mb-1 text-gray-800">2. Upload File Settlement</h2>
        <p className="text-sm text-gray-400 mb-5">Tidak wajib semua — upload platform yang datanya ada.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PLATFORMS.map((p) => {
            const uploaded = files[p.id];
            return (
              <div key={p.id}
                className={`rounded-xl border-2 p-4 transition-all ${
                  uploaded ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-800">{p.emoji} {p.label}</span>
                  {uploaded && (
                    <button onClick={() => handleFile(p.id, null)}
                      className="text-xs text-red-500 hover:text-red-700">✕ Hapus</button>
                  )}
                </div>
                {uploaded ? (
                  <div className="text-xs text-green-700 truncate">✅ {uploaded.name}</div>
                ) : (
                  <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 font-medium">
                    + Pilih file {p.accept}
                    <input type="file" accept={p.accept} className="hidden"
                      ref={(el) => { fileRefs.current[p.id] = el; }}
                      onChange={(e) => handleFile(p.id, e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={handlePreview}
            disabled={loading || filesUploaded === 0 || !from || !to}
            className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-95"
          >
            {loading ? 'Memproses...' : `Preview & Rekonsiliasi (${filesUploaded} file)`}
          </button>
          {filesUploaded > 0 && <span className="text-sm text-gray-500">{filesUploaded} platform siap diproses</span>}
        </div>

        {errorMsg && <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-xl text-sm">⚠️ {errorMsg}</div>}
        {syncMsg && <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-xl font-medium">{syncMsg}</div>}
      </div>

      {/* ── STEP 3: Hasil Rekonsiliasi ── */}
      {s && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="font-bold text-lg text-gray-800">3. Rekonsiliasi Settlement vs Pawoon</h2>
            <p className="text-sm text-gray-400 mt-1">Periode: {s.periodeFrom} s/d {s.periodeTo}</p>
          </div>

          {/* KPI Summary */}
          <div className="p-6 border-b border-gray-100">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 rounded-xl p-4">
                <p className="text-blue-600 text-xs font-semibold uppercase tracking-wide">Omzet Kotor Settlement</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">{rp(s.totalOmzetKotor)}</p>
                <p className="text-xs text-blue-500 mt-1">{s.totalTrx.toLocaleString('id-ID')} transaksi</p>
              </div>
              <div className="bg-red-50 rounded-xl p-4">
                <p className="text-red-600 text-xs font-semibold uppercase tracking-wide">Admin Platform (Komisi)</p>
                <p className="text-2xl font-bold text-red-900 mt-1">-{rp(s.totalAdminFee)}</p>
                <p className="text-xs text-red-500 mt-1">{pct(s.totalAdminFee, s.totalOmzetKotor)} dari omzet</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-4">
                <p className="text-amber-600 text-xs font-semibold uppercase tracking-wide">Promo Merchant</p>
                <p className="text-2xl font-bold text-amber-900 mt-1">-{rp(s.totalPromo)}</p>
                <p className="text-xs text-amber-500 mt-1">{pct(s.totalPromo, s.totalOmzetKotor)} dari omzet</p>
              </div>
              <div className={`rounded-xl p-4 ${Math.abs(selisihTotal) < s.totalOmzetKotor * 0.01 ? 'bg-green-50' : 'bg-orange-50'}`}>
                <p className={`text-xs font-semibold uppercase tracking-wide ${Math.abs(selisihTotal) < s.totalOmzetKotor * 0.01 ? 'text-green-600' : 'text-orange-600'}`}>
                  Omzet Pawoon (POS)
                </p>
                <p className={`text-2xl font-bold mt-1 ${Math.abs(selisihTotal) < s.totalOmzetKotor * 0.01 ? 'text-green-900' : 'text-orange-900'}`}>
                  {rp(s.pawoonOmzetKotor)}
                </p>
                <p className={`text-xs mt-1 font-semibold ${selisihTotal >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                  Selisih: {selisihTotal >= 0 ? '+' : ''}{rp(selisihTotal)}
                  {Math.abs(selisihTotal) < s.totalOmzetKotor * 0.01 ? ' ✅' : ' ⚠️'}
                </p>
              </div>
            </div>

            {/* Per platform breakdown */}
            <div>
              <h3 className="font-semibold text-sm text-gray-600 mb-3 uppercase tracking-wide">Rincian per Platform</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {(() => {
                  const foodAppsKeys = ['shopeefood', 'grabfood', 'gofood'];
                  const foodApps = s.perPlatform.filter(p => foodAppsKeys.includes(p.platform));
                  const others = s.perPlatform.filter(p => !foodAppsKeys.includes(p.platform));
                  
                  const combined = [...others];
                  if (foodApps.length > 0) {
                    combined.unshift({
                      platform: 'foodapps',
                      label: 'Food Apps (Shopee, Grab, Gojek)',
                      fileName: foodApps.map(f => f.fileName).join(', '),
                      omzetKotor: foodApps.reduce((sum, f) => sum + f.omzetKotor, 0),
                      adminFee: foodApps.reduce((sum, f) => sum + f.adminFee, 0),
                      promo: foodApps.reduce((sum, f) => sum + f.promo, 0),
                      trx: foodApps.reduce((sum, f) => sum + f.trx, 0),
                      rowsToWrite: 0
                    });
                  }
                  
                  return combined.map((p) => (
                    <div key={p.platform} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-bold text-sm text-gray-800">{p.label}</p>
                        <p className="text-xs bg-white border px-2 py-0.5 rounded-md font-medium text-gray-600">
                          {p.trx.toLocaleString('id-ID')} {p.platform === 'tiktokgo' ? 'voucher' : 'trx'}
                        </p>
                      </div>
                      <p className="text-xs text-gray-500">Omzet Kotor</p>
                      <p className="font-semibold text-gray-900 text-sm">{rp(p.omzetKotor)}</p>
                      <p className="text-xs text-gray-500 mt-1">Admin Fee</p>
                      <p className="font-semibold text-red-700 text-sm">-{rp(p.adminFee)} ({pct(p.adminFee, p.omzetKotor)})</p>
                      <p className="text-xs text-gray-400 mt-1 truncate max-w-[150px]" title={p.fileName}>{p.fileName}</p>
                    </div>
                  ));
                })()}
              </div>
            </div>
          </div>

          {/* Per outlet table */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800 mb-4">Rincian per Outlet</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <th className="p-3 border-b">Outlet</th>
                    <th className="p-3 border-b text-right">Omzet Kotor (Settlement)</th>
                    <th className="p-3 border-b text-right bg-amber-50">Diskon Merchant</th>
                    <th className="p-3 border-b text-right bg-red-50">Admin Fee</th>
                    <th className="p-3 border-b text-right bg-green-50 text-green-800">Netto Cair</th>
                    <th className="p-3 border-b text-right bg-gray-100 border-l-2 border-gray-200">Ref: Pawoon (POS)</th>
                  </tr>
                </thead>
                <tbody>
                  {s.perOutlet.map((o) => (
                    <tr key={o.outletId} className="border-b hover:bg-gray-50 transition-colors">
                      <td className="p-3 font-semibold text-gray-800">{o.outletName}</td>
                      <td className="p-3 text-right font-semibold">{rp(o.omzetKotor)}</td>
                      <td className="p-3 text-right text-amber-700 bg-amber-50/30">-{rp(o.promo)}</td>
                      <td className="p-3 text-right text-red-700 bg-red-50/30 font-semibold">-{rp(o.adminFee)}</td>
                      <td className="p-3 text-right text-green-700 bg-green-50/50 font-bold">{rp(o.nettoCair)}</td>
                      <td className="p-3 text-right text-gray-500 bg-gray-50 border-l-2 border-gray-200">{rp(o.pawoonOmzet)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unmapped */}
          {s.unmappedStores.length > 0 && (
            <div className="p-6 border-b border-amber-100 bg-amber-50">
              <h3 className="font-bold text-amber-800 mb-2">⚠️ Toko Belum Dipetakan ({s.unmappedStores.length})</h3>
              <p className="text-xs text-amber-700 mb-2">Toko berikut tidak akan diimport. Tambahkan di <code className="bg-amber-100 px-1 rounded">platform_store_map.json</code>.</p>
              <ul className="text-xs text-amber-800 space-y-1">
                {s.unmappedStores.map((u, i) => (
                  <li key={i}>[{u.platform}] <b>{u.storeName}</b> (ID: {u.storeId || '—'}) — {rp(u.omzetKotor)}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Sync button */}
          <div className="p-6 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Total: {s.allDaily.reduce((sum, d) => sum + d.daily.length, 0)} baris rekap harian dari {s.perPlatform.length} platform
            </div>
            <button
              onClick={handleSync}
              disabled={loading}
              className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-green-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Menyimpan...' : `Sync ${s.allDaily.reduce((sum, d) => sum + d.daily.length, 0)} Baris ke Database`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
