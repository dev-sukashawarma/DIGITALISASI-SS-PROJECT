'use client';

import { useState } from 'react';
import { previewSettlementFile, syncSettlementData } from '@/app/actions/platformSettlement';

// Daftar platform sengaja ditulis ulang di sini (bukan di-import dari
// @/lib/platformSettlement) supaya parser + library xlsx tidak ikut terbundel ke
// browser — parser hanya perlu hidup di server.
const PLATFORMS = [
  { id: 'shopeefood', label: 'ShopeeFood', accept: '.xlsx,.xls', ready: true, hint: 'File .xlsx laporan settlement (sheet Order_Payment_Details)' },
  { id: 'grabfood', label: 'GrabFood', accept: '.csv', ready: true, hint: 'File .csv laporan transaksi merchant' },
  { id: 'gofood', label: 'GoFood', accept: '.xlsx,.xls', ready: true, hint: 'File .xlsx laporan Midtrans Payments' },
  { id: 'tiktokgo', label: 'TikTok Go', accept: '.xlsx,.xls', ready: true, hint: 'File .xlsx laporan order detail (voucher redemption)' },
];

const rp = (n: number) => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');

export default function PlatformSettlementPage() {
  const [platform, setPlatform] = useState('shopeefood');
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [syncMsg, setSyncMsg] = useState('');

  const active = PLATFORMS.find((p) => p.id === platform)!;

  const reset = () => {
    setResult(null);
    setErrorMsg('');
    setSyncMsg('');
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoading(true);
    reset();
    try {
      const fd = new FormData();
      fd.append('platform', platform);
      fd.append('file', file);
      const res = await previewSettlementFile(fd);
      if (res.success) setResult(res);
      else {
        setErrorMsg(res.error || 'Gagal membaca file.');
        if ((res as any).unmappedStores) setResult(res);
      }
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    if (!result?.data) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await syncSettlementData(result.data);
      if (res.success) {
        setSyncMsg(`Tersimpan ${res.savedRows} baris rekap harian.`);
        setResult(null);
        setFile(null);
      } else setErrorMsg(res.error || 'Gagal menyimpan.');
    } catch (e: any) {
      setErrorMsg(e.message);
    } finally {
      setLoading(false);
    }
  };

  const s = result?.summary;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold mb-1">Import Settlement Food Apps</h1>
      <p className="text-gray-500 mb-6 text-sm">
        Menarik <b>omzet kotor</b>, <b>promo</b>, dan <b>komisi platform</b> dari laporan settlement,
        direkap per outlet per hari.
      </p>

      {/* 1. Platform */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">1. Pilih Platform</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PLATFORMS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPlatform(p.id); setFile(null); reset(); }}
              disabled={!p.ready}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                platform === p.id
                  ? 'border-blue-600 bg-blue-50'
                  : p.ready
                  ? 'border-gray-200 hover:border-gray-300 bg-white'
                  : 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="font-bold text-gray-900">{p.label}</div>
              <div className="text-xs text-gray-500 mt-1">{p.hint}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Upload */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
        <h2 className="text-xl font-semibold mb-4">2. Upload File {active.label}</h2>
        <div className="flex flex-wrap gap-4 items-center">
          <input
            type="file"
            accept={active.accept}
            onChange={(e) => { setFile(e.target.files?.[0] ?? null); reset(); }}
            className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            onClick={handlePreview}
            disabled={!file || loading || !active.ready}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Memproses...' : 'Preview Data'}
          </button>
        </div>
        {errorMsg && (
          <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg text-sm">⚠️ {errorMsg}</div>
        )}
        {syncMsg && (
          <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg font-medium">✅ {syncMsg}</div>
        )}
      </div>

      {/* Peringatan toko tak dikenal / dilewati */}
      {result && (result.summary?.unmappedStores?.length > 0 || result.unmappedStores?.length > 0) && (
        <div className="bg-amber-50 rounded-xl p-6 shadow-sm mb-6 border border-amber-200">
          <h3 className="font-bold text-amber-800 mb-2">Toko Belum Dipetakan</h3>
          <p className="text-amber-700 text-sm mb-3">
            Toko berikut ada di laporan tapi belum punya padanan outlet. Datanya <b>tidak akan diimport</b>.
            Tambahkan pemetaannya di <code className="bg-amber-100 px-1 rounded">src/data/platform_store_map.json</code>.
          </p>
          <ul className="list-disc pl-5 text-sm text-amber-800">
            {(result.summary?.unmappedStores ?? result.unmappedStores ?? []).map((u: any) => (
              <li key={u.storeId || u.storeName}>
                <b>{u.storeName}</b> (Store ID: {u.storeId || '—'}) — {rp(u.omzetKotor)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result && (result.summary?.skippedClosed?.length > 0 || result.skippedClosed?.length > 0) && (
        <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200 text-sm text-gray-600">
          <b>Dilewati (outlet sudah tutup):</b>{' '}
          {(result.summary?.skippedClosed ?? result.skippedClosed ?? [])
            .map((c: any) => `${c.storeName} (${rp(c.omzetKotor)})`)
            .join(', ')}
        </div>
      )}

      {/* 3. Preview */}
      {s && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-semibold">3. Preview &amp; Validasi</h2>
            <p className="text-sm text-gray-500 mt-1">
              {s.platformLabel} · {s.fileName} · periode <b>{s.periodeFrom}</b> s/d <b>{s.periodeTo}</b> ·{' '}
              {s.totalTrx.toLocaleString('id-ID')} transaksi
            </p>
          </div>

          <div className="p-6 border-b border-gray-100 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-xl">
              <p className="text-blue-600 text-sm font-medium">Omzet Kotor</p>
              <p className="text-2xl font-bold text-blue-900 mt-1">{rp(s.totalOmzetKotor)}</p>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl">
              <p className="text-amber-600 text-sm font-medium">Promo (Merchant)</p>
              <p className="text-2xl font-bold text-amber-900 mt-1">-{rp(s.totalPromo)}</p>
            </div>
            <div className="bg-red-50 p-4 rounded-xl">
              <p className="text-red-600 text-sm font-medium">Admin Platform (Komisi)</p>
              <p className="text-2xl font-bold text-red-900 mt-1">-{rp(s.totalCommission)}</p>
              <p className="text-xs text-red-700 mt-1">{s.commissionPct.toFixed(2)}% dari omzet kotor</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-xl">
              <p className="text-gray-600 text-sm font-medium">Baris Rekap Harian</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{s.rowsToWrite}</p>
              {s.existingRows > 0 && (
                <p className="text-xs text-gray-500 mt-1">{s.existingRows} baris lama akan ditimpa</p>
              )}
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold mb-1">Pembanding per Outlet</h3>
            <p className="text-xs text-gray-500 mb-4">
              {s.compareChannel === 'tiktok_go' ? (
                <>
                  Kolom <b>Sistem Kita</b> berisi omzet channel TikTok Go dari catatan kita sendiri untuk
                  periode yang sama.
                </>
              ) : (
                <>
                  Kolom <b>Sistem Kita</b> berisi omzet food apps dari <b>semua platform</b> digabung (data
                  periode Pawoon tidak membedakan Shopee/Grab/Go). Jadi omzet satu platform semestinya{' '}
                  <b>lebih kecil</b> dari angka itu — kalau justru lebih besar, berarti ada transaksi yang
                  belum tercatat di sistem kita.
                </>
              )}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-600">
                    <th className="p-3 border-b font-medium">Outlet</th>
                    <th className="p-3 border-b font-medium text-center">Trx</th>
                    <th className="p-3 border-b font-medium text-right">Omzet Kotor</th>
                    <th className="p-3 border-b font-medium text-right">Promo</th>
                    <th className="p-3 border-b font-medium text-right bg-red-50">Komisi</th>
                    <th className="p-3 border-b font-medium text-right bg-blue-50">
                      Sistem Kita ({s.compareChannel === 'tiktok_go' ? 'TikTok Go' : 'semua food apps'})
                    </th>
                    <th className="p-3 border-b font-medium text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {s.perOutlet.map((o: any) => {
                    const lebih = o.omzetKotor > o.sistemOmzetKotor;
                    return (
                      <tr key={o.outletId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">
                          {o.outletName}
                          <div className="text-xs text-gray-400">{o.storeNames.join(', ')}</div>
                        </td>
                        <td className="p-3 text-center">{o.trxCount}</td>
                        <td className="p-3 text-right font-semibold">{rp(o.omzetKotor)}</td>
                        <td className="p-3 text-right text-amber-700">-{rp(o.promoMerchant)}</td>
                        <td className="p-3 text-right font-bold text-red-700 bg-red-50/40">-{rp(o.commission)}</td>
                        <td className="p-3 text-right text-blue-700 bg-blue-50/40">
                          {rp(o.sistemOmzetKotor)}
                          <div className="text-xs text-gray-400">{o.sistemTrxCount} trx</div>
                        </td>
                        <td className="p-3 text-center">
                          {o.sistemOmzetKotor === 0 ? (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">tak ada data</span>
                          ) : lebih ? (
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-semibold">
                              perlu dicek
                            </span>
                          ) : (
                            <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">wajar</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="p-6 bg-gray-50 flex justify-end">
            <button
              onClick={handleSync}
              disabled={loading || s.rowsToWrite === 0}
              className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm hover:bg-green-700 disabled:opacity-50 transition-all active:scale-95"
            >
              {loading ? 'Menyimpan...' : `Simpan ${s.rowsToWrite} Baris ke Database`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
