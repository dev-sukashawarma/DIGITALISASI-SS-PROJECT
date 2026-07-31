'use client';

import { useState, useEffect } from 'react';
import { previewPawoonFile, syncPawoonData, getMenuItemsForMapping, updatePawoonMapping, getOutletsForClear, clearPawoonDataForOutlet, countPawoonDataForOutlet } from '@/app/actions/pawoon';

export default function PawoonImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [previewResult, setPreviewResult] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('ALL');
    const [menuItems, setMenuItems] = useState<any[]>([]);
    const [newMappings, setNewMappings] = useState<Record<string, string>>({});
    const [isSavingMapping, setIsSavingMapping] = useState(false);
    
    const [outlets, setOutlets] = useState<any[]>([]);
    const [selectedOutletToClear, setSelectedOutletToClear] = useState<string>('');
    const [clearDateFrom, setClearDateFrom] = useState<string>('');
    const [clearDateTo, setClearDateTo] = useState<string>('');
    const [clearConfirmText, setClearConfirmText] = useState<string>('');
    const [isClearing, setIsClearing] = useState(false);
    const [clearSuccess, setClearSuccess] = useState('');
    const [clearCount, setClearCount] = useState<number | null>(null);
    const [isCounting, setIsCounting] = useState(false);

    const outletToClearName = outlets.find(o => o.id === selectedOutletToClear)?.name || '';
    // Hapus seluruh riwayat import outlet = aksi paling destruktif di halaman ini,
    // jadi wajib ketik ulang nama outlet. Kalau dibatasi rentang tanggal, cukup confirm().
    const isFullWipe = !clearDateFrom && !clearDateTo;
    const canClear =
        !!selectedOutletToClear &&
        !isClearing &&
        !isCounting &&
        // Wajib tahu dulu berapa yang akan terhapus sebelum boleh menghapus.
        clearCount !== null && clearCount > 0 &&
        (!isFullWipe || clearConfirmText.trim().toLowerCase() === outletToClearName.trim().toLowerCase());

    // Hitung ulang tiap kali outlet/rentang berubah, supaya angka yang dilihat user
    // selalu angka untuk filter yang sedang aktif — bukan sisa hitungan sebelumnya.
    useEffect(() => {
        if (!selectedOutletToClear) { setClearCount(null); return; }
        if (clearDateFrom && clearDateTo && clearDateFrom > clearDateTo) { setClearCount(null); return; }

        let cancelled = false;
        setIsCounting(true);
        setClearCount(null);
        countPawoonDataForOutlet(
            selectedOutletToClear,
            clearDateFrom || undefined,
            clearDateTo || undefined
        ).then(res => {
            if (cancelled) return;
            if (res.success) setClearCount(res.count ?? 0);
            else setErrorMsg(res.error || 'Gagal menghitung data.');
        }).finally(() => { if (!cancelled) setIsCounting(false); });

        return () => { cancelled = true; };
    }, [selectedOutletToClear, clearDateFrom, clearDateTo]);

    useEffect(() => {
        if (previewResult?.unmappedItems?.length > 0) {
            getMenuItemsForMapping().then(res => {
                if (res.success) setMenuItems(res.items ?? []);
            });
        }
    }, [previewResult]);
    
    useEffect(() => {
        getOutletsForClear().then(res => {
            if (res.success) setOutlets(res.outlets ?? []);
        });
    }, []);

    const handleClearData = async () => {
        if (!canClear) return;
        if (clearDateFrom && clearDateTo && clearDateFrom > clearDateTo) {
            setErrorMsg('Tanggal "Dari" tidak boleh setelah tanggal "Sampai".');
            return;
        }

        const rangeLabel = isFullWipe
            ? 'SEMUA TANGGAL'
            : `${clearDateFrom || 'awal'} s/d ${clearDateTo || 'akhir'}`;
        if (!confirm(`PERHATIAN: Hapus ${clearCount} transaksi hasil import Pawoon untuk outlet "${outletToClearName}" pada rentang ${rangeLabel}?\n\nHanya order import Pawoon (punya ID struk Pawoon) yang dihapus — order manual kasir, online, dan kiosk tidak tersentuh. Aksi ini tidak dapat dibatalkan.`)) return;

        setIsClearing(true);
        setClearSuccess('');
        setErrorMsg('');

        try {
            const res = await clearPawoonDataForOutlet(
                selectedOutletToClear,
                clearDateFrom || undefined,
                clearDateTo || undefined
            );
            if (res.success) {
                // Verifikasi setelah hapus: hitung ulang dengan filter yang sama.
                // Ini yang akan menangkap penghapusan yang berhenti separuh jalan
                // (mis. kena batas max-rows) alih-alih melaporkannya sebagai sukses.
                const after = await countPawoonDataForOutlet(
                    selectedOutletToClear,
                    clearDateFrom || undefined,
                    clearDateTo || undefined
                );
                const sisa = after.success ? (after.count ?? 0) : null;

                let msg = `Berhasil menghapus ${res.count?.toLocaleString('id-ID')} transaksi Pawoon (${rangeLabel}) untuk outlet ${outletToClearName}.`;
                if (sisa === 0) {
                    msg += ' Terverifikasi: tidak ada sisa data Pawoon pada filter ini.';
                    setClearSuccess(msg);
                } else if (sisa === null) {
                    setClearSuccess(msg + ' (verifikasi sisa gagal dijalankan)');
                } else {
                    // Jangan tampilkan sebagai sukses penuh kalau masih bersisa.
                    setClearSuccess('');
                    setErrorMsg(
                        `${msg} TAPI masih tersisa ${sisa.toLocaleString('id-ID')} transaksi yang belum terhapus` +
                        `${res.message ? ` — ${res.message}` : ''}. Klik hapus sekali lagi untuk melanjutkan.`
                    );
                    return;
                }

                setSelectedOutletToClear('');
                setClearDateFrom('');
                setClearDateTo('');
                setClearConfirmText('');
                setClearCount(null);
            } else {
                setErrorMsg(res.error || 'Gagal menghapus data.');
            }
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsClearing(false);
        }
    };

    const handleMappingChange = (pawoonName: string, systemId: string) => {
        setNewMappings(prev => ({ ...prev, [pawoonName]: systemId }));
    };

    const handleSaveMapping = async () => {
        setIsSavingMapping(true);
        const res = await updatePawoonMapping(newMappings);
        setIsSavingMapping(false);
        if (res.success) {
            setNewMappings({});
            handlePreview();
        } else {
            setErrorMsg(res.error || 'Gagal menyimpan mapping');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
            setPreviewResult(null);
            setErrorMsg('');
            setSyncSuccess(false);
            setSelectedDate('ALL');
        }
    };

    const handlePreview = async () => {
        if (!file) return;
        setIsLoading(true);
        setErrorMsg('');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const result = await previewPawoonFile(formData);
            if (result.success) {
                setPreviewResult(result);
                setSelectedDate('ALL');
            } else {
                setErrorMsg(result.error || 'Unknown error occurred');
                if (result.unmappedItems || result.unmappedOutlets) {
                    setPreviewResult(result); // Show the unmapped data
                }
            }
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSync = async () => {
        if (!previewResult || !previewResult.data) return;
        setIsLoading(true);
        setErrorMsg('');
        
        try {
            const result = await syncPawoonData(previewResult.data.orders, previewResult.data.items, previewResult.data.ordersToVoid || []);
            if (result.success) {
                setSyncSuccess(true);
                setPreviewResult(null);
                setFile(null);
            } else {
                setErrorMsg(result.error || 'Sync failed');
            }
        } catch (err: any) {
            setErrorMsg(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    const displayedSummary = previewResult?.summary 
        ? (selectedDate === 'ALL' 
            ? previewResult.summary 
            : previewResult.summary.byDate.find((d: any) => d.date === selectedDate) || previewResult.summary)
        : null;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Migrasi Pawoon (Staging Area)</h1>
            
            <div className="bg-white rounded-xl p-6 shadow-sm mb-6 border border-gray-100">
                <h2 className="text-xl font-semibold mb-4">1. Upload File Excel Pawoon</h2>
                <div className="flex gap-4 items-center">
                    <input 
                        type="file" 
                        accept=".xls,.xlsx" 
                        onChange={handleFileChange}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <button 
                        onClick={handlePreview} 
                        disabled={!file || isLoading}
                        className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                        {isLoading ? 'Memproses...' : 'Preview Data'}
                    </button>
                </div>
                {errorMsg && !previewResult?.unmappedItems && (
                    <div className="mt-4 p-4 bg-red-50 text-red-700 rounded-lg">
                        ⚠️ {errorMsg}
                    </div>
                )}
                {syncSuccess && (
                    <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg font-medium">
                        ✅ Data berhasil disinkronkan ke Database Real!
                    </div>
                )}
            </div>

            <div className="bg-red-50 rounded-xl p-6 shadow-sm mb-6 border border-red-200">
                <h2 className="text-xl font-semibold mb-4 text-red-700">Hapus Riwayat Data Pawoon (Reset per Outlet)</h2>
                <p className="text-sm text-red-600 mb-4">
                    Gunakan fitur ini jika Bapak ingin menghapus data Pawoon yang sudah terlanjur di-import sebelumnya, lalu ingin memulai ulang proses import dengan perlindungan Cutoff Date yang baru. Data manual kasir <b>TIDAK AKAN</b> terhapus.
                </p>
                <div className="flex gap-4 items-end flex-wrap">
                    <div>
                        <label className="block text-xs font-medium text-red-700 mb-1">Outlet</label>
                        <select
                            value={selectedOutletToClear}
                            onChange={(e) => { setSelectedOutletToClear(e.target.value); setClearConfirmText(''); }}
                            className="border border-gray-300 rounded-lg px-4 py-2 w-64 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        >
                            <option value="">-- Pilih Outlet --</option>
                            {outlets.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-red-700 mb-1">Dari tanggal (opsional)</label>
                        <input
                            type="date"
                            value={clearDateFrom}
                            onChange={(e) => setClearDateFrom(e.target.value)}
                            className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-red-700 mb-1">Sampai tanggal (opsional)</label>
                        <input
                            type="date"
                            value={clearDateTo}
                            onChange={(e) => setClearDateTo(e.target.value)}
                            className="border border-gray-300 rounded-lg px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                    <button
                        onClick={handleClearData}
                        disabled={!canClear}
                        className="bg-red-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors"
                    >
                        {isClearing ? 'Menghapus...' : (isFullWipe ? 'Hapus Semua Data Pawoon' : 'Hapus Rentang Ini')}
                    </button>
                </div>

                {selectedOutletToClear && (
                    <div className="mt-3 text-sm">
                        {isCounting && <span className="text-gray-600">Menghitung data yang akan dihapus...</span>}
                        {!isCounting && clearCount !== null && clearCount > 0 && (
                            <span className="text-red-700">
                                <b>{clearCount.toLocaleString('id-ID')} transaksi import Pawoon</b> akan dihapus beserta item-nya.
                                Order manual kasir, online, dan kiosk tidak ikut terhapus.
                            </span>
                        )}
                        {!isCounting && clearCount === 0 && (
                            <span className="text-gray-600">Tidak ada data import Pawoon pada outlet/rentang ini.</span>
                        )}
                    </div>
                )}

                {selectedOutletToClear && isFullWipe && (
                    <div className="mt-4 p-4 bg-white rounded-lg border border-red-300">
                        <p className="text-sm text-red-700 mb-2">
                            Rentang tanggal kosong = <b>menghapus SELURUH riwayat import Pawoon</b> outlet ini.
                            Untuk membuang hari yang tumpang tindih saja, isi rentang tanggalnya di atas.
                        </p>
                        <label className="block text-xs font-medium text-red-700 mb-1">
                            Ketik nama outlet <b>{outletToClearName}</b> untuk mengonfirmasi:
                        </label>
                        <input
                            type="text"
                            value={clearConfirmText}
                            onChange={(e) => setClearConfirmText(e.target.value)}
                            placeholder={outletToClearName}
                            className="border border-gray-300 rounded-lg px-4 py-2 w-64 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        />
                    </div>
                )}
                {clearSuccess && (
                    <div className="mt-4 p-4 bg-green-50 text-green-700 rounded-lg font-medium border border-green-200">
                        ✅ {clearSuccess}
                    </div>
                )}
            </div>

            {previewResult && previewResult.unmappedItems && (
                <div className="bg-red-50 rounded-xl p-6 shadow-sm mb-6 border border-red-200">
                    <h2 className="text-xl font-bold text-red-700 mb-4">Peringatan Dini: Data Tidak Dikenali</h2>
                    <p className="text-red-600 mb-4">Sistem menemukan Item atau Outlet yang belum di-mapping. Data tidak bisa di-sync sebelum ini diperbaiki.</p>
                    
                    {previewResult.unmappedItems.length > 0 && (
                        <div className="mb-4">
                            <h3 className="font-semibold mb-2">Menu/Produk Tidak Dikenali:</h3>
                            <div className="space-y-3">
                                {previewResult.unmappedItems.map((item: string) => (
                                    <div key={item} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3 rounded border border-red-100">
                                        <span className="text-red-700 font-medium mb-2 md:mb-0">{item}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">Pilih menu sistem:</span>
                                            <select 
                                                className="border border-gray-300 rounded px-2 py-1 text-sm w-48 md:w-64"
                                                value={newMappings[item] || ''}
                                                onChange={(e) => handleMappingChange(item, e.target.value)}
                                            >
                                                <option value="">-- Pilih Menu --</option>
                                                {menuItems.map(mi => (
                                                    <option key={mi.id} value={mi.id}>{mi.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {Object.keys(newMappings).length > 0 && (
                                <div className="mt-4 flex justify-end">
                                    <button 
                                        onClick={handleSaveMapping}
                                        disabled={isSavingMapping}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium shadow-sm flex items-center transition-colors disabled:bg-blue-400"
                                    >
                                        {isSavingMapping ? 'Menyimpan...' : 'Simpan Mapping & Ulangi Preview'}
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {previewResult.unmappedOutlets && previewResult.unmappedOutlets.length > 0 && (
                        <div>
                            <h3 className="font-semibold mb-2">Outlet Tidak Dikenali:</h3>
                            <ul className="list-disc pl-5">
                                {previewResult.unmappedOutlets.map((outlet: string) => (
                                    <li key={outlet} className="text-red-600">{outlet}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {previewResult && previewResult.summary && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between mb-2">
                        <h2 className="text-xl font-semibold mb-4 md:mb-0">2. Preview & Validasi Data</h2>
                        
                        {previewResult.summary.byDate && previewResult.summary.byDate.length > 0 && (
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-gray-700">Filter Tanggal:</label>
                                <select 
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                >
                                    <option value="ALL">Semua Tanggal (Total)</option>
                                    {previewResult.summary.byDate.map((d: any) => {
                                        const isSynced = d.transactionsCount > 0 && d.duplicatesSkipped >= d.transactionsCount * 0.9;
                                        // Tanggal yang sepenuhnya lewat cutoff ditandai terpisah — kalau
                                        // tidak, tanggal itu tampil "🔴 N struk baru" padahal tidak
                                        // satu pun akan disimpan.
                                        const allPostCutoff = d.postSystemCount > 0 && d.postSystemCount >= d.transactionsCount;
                                        // Tanggal tanpa baris Pawoon sama sekali (diisi otomatis di server
                                        // supaya tetap bisa dipilih untuk validasi terhadap data sistem) —
                                        // beda dari "🔴 struk baru", jangan sampai kelihatan seperti ada
                                        // yang perlu disimpan.
                                        const noPawoonData = d.transactionsCount === 0;
                                        return (
                                            <option key={d.date} value={d.date}>
                                                {noPawoonData ? '📋 ' : (allPostCutoff ? '⏭️ ' : (isSynced ? '✅ ' : '🔴 '))}{d.date}
                                                {noPawoonData
                                                    ? ' (0 struk Pawoon — cek data sistem)'
                                                    : (allPostCutoff
                                                        ? ' (Setelah cutoff — tidak disimpan)'
                                                        : (isSynced ? ' (Sudah tersinkron)' : ` (${d.transactionsCount - d.duplicatesSkipped} struk baru)`))}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6 pt-0 border-b border-gray-100">
                        {previewResult.summary.cutoffs && previewResult.summary.cutoffs.length > 0 && (
                            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <p className="text-xs font-semibold text-gray-700 mb-2">
                                    Tanggal Cutoff Sistem (batas outlet mulai pakai sistem baru)
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {previewResult.summary.cutoffs.map((c: any) => (
                                        <span
                                            key={c.outletId}
                                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                                                c.cutoffDate
                                                    ? 'border-gray-300 bg-white text-gray-800'
                                                    : 'border-amber-300 bg-amber-50 text-amber-800'
                                            }`}
                                        >
                                            <b>{c.outletName}</b>
                                            {c.cutoffDate
                                                ? <>cutoff: <b>{c.cutoffDate}</b> — transaksi pada/setelah tanggal ini tidak disimpan</>
                                                : <>⚠️ belum ada cutoff — SEMUA transaksi akan disimpan, termasuk yang mungkin sudah diinput manual kasir</>}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 mt-4">
                            <div className="bg-blue-50 p-4 rounded-xl flex flex-col justify-center">
                                <p className="text-blue-600 text-sm font-medium mb-1">Grand Total</p>
                                <p className="text-3xl font-bold text-blue-900 mt-1">
                                    Rp {((displayedSummary.totalOmsetGross || displayedSummary.totalOmset) - (displayedSummary.totalOmsetVoid || 0)).toLocaleString('id-ID')}
                                </p>
                                <p className="text-xs font-medium text-blue-700 mt-2">
                                    Total Omset (Rp {(displayedSummary.totalOmsetGross || displayedSummary.totalOmset).toLocaleString('id-ID')}) - Void (Rp {(displayedSummary.totalOmsetVoid || 0).toLocaleString('id-ID')})
                                </p>
                                <p className={`text-xs font-bold mt-1 ${((displayedSummary.totalOmsetGross || displayedSummary.totalOmset) - (displayedSummary.totalOmsetVoid || 0)) === displayedSummary.totalOmset ? 'text-green-600' : 'text-red-600'}`}>
                                    Validasi Excel: Rp {displayedSummary.totalOmset.toLocaleString('id-ID')}
                                    {((displayedSummary.totalOmsetGross || displayedSummary.totalOmset) - (displayedSummary.totalOmsetVoid || 0)) === displayedSummary.totalOmset ? ' (Match ✅)' : ' (Beda ❌)'}
                                </p>
                            </div>

                            <div className="bg-purple-50 p-4 rounded-xl flex flex-col justify-center">
                                <p className="text-purple-600 text-sm font-medium mb-1">Total Struk</p>
                                <p className="text-3xl font-bold text-purple-900 mt-1">
                                    {selectedDate === 'ALL' ? displayedSummary.totalTransactionsParsed : displayedSummary.transactionsCount}
                                </p>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl flex flex-col justify-center">
                                <p className="text-gray-600 text-sm font-medium mb-1">Duplikat (Skip)</p>
                                <p className="text-3xl font-bold text-gray-900 mt-1">
                                    {selectedDate === 'ALL' ? displayedSummary.duplicatesSkipped : displayedSummary.duplicatesSkipped}
                                </p>
                                {selectedDate !== 'ALL' && displayedSummary.duplicatesSkipped > 0 && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        dari {displayedSummary.transactionsCount} total struk
                                    </p>
                                )}
                            </div>

                            <div className={`p-4 rounded-xl flex flex-col justify-center ${(selectedDate === 'ALL' ? displayedSummary.totalOverlapCount : displayedSummary.systemOverlap?.count) > 0 ? 'bg-orange-50 border border-orange-200' : 'bg-green-50 border border-green-100'}`}>
                                <p className={`text-sm font-medium mb-1 ${(selectedDate === 'ALL' ? displayedSummary.totalOverlapCount : displayedSummary.systemOverlap?.count) > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                    Overlap Sistem
                                </p>
                                <p className={`text-2xl font-bold mt-1 ${(selectedDate === 'ALL' ? displayedSummary.totalOverlapCount : displayedSummary.systemOverlap?.count) > 0 ? 'text-orange-900' : 'text-green-900'}`}>
                                    {selectedDate === 'ALL' ? (displayedSummary.totalOverlapCount || 0) : (displayedSummary.systemOverlap?.count || 0)} <span className="text-sm font-normal">transaksi</span>
                                </p>
                                <p className={`text-xs font-bold mt-2 ${(selectedDate === 'ALL' ? displayedSummary.totalOverlapCount : displayedSummary.systemOverlap?.count) > 0 ? 'text-orange-700' : 'text-green-700'}`}>
                                    Rp {(selectedDate === 'ALL' ? (displayedSummary.totalOverlapOmset || 0) : (displayedSummary.systemOverlap?.total || 0)).toLocaleString('id-ID')}
                                </p>
                            </div>
                        </div>

                        {/* Sync Status Banner */}
                        {selectedDate !== 'ALL' && (() => {
                            const synced = displayedSummary.duplicatesSkipped >= displayedSummary.transactionsCount * 0.9 && displayedSummary.transactionsCount > 0;
                            const partial = displayedSummary.duplicatesSkipped > 0 && !synced;
                            if (!synced && !partial) return null;
                            return (
                                <div className={`mb-4 p-3 rounded-lg flex items-center gap-3 text-sm font-medium ${
                                    synced
                                        ? 'bg-green-50 text-green-800 border border-green-200'
                                        : 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                                }`}>
                                    <span className="text-xl">{synced ? '✅' : '⚠️'}</span>
                                    <div>
                                        {synced
                                            ? `Data tanggal ${selectedDate} sudah tersinkron ke sistem (${displayedSummary.duplicatesSkipped}/${displayedSummary.transactionsCount} struk terdeteksi di database).`
                                            : `Import sebagian: ${displayedSummary.duplicatesSkipped} dari ${displayedSummary.transactionsCount} struk sudah ada di sistem, ${displayedSummary.transactionsCount - displayedSummary.duplicatesSkipped} struk baru akan diimport.`
                                        }
                                    </div>
                                </div>
                            );
                        })()}

                        <h3 className="text-lg font-semibold mb-4">Rekap Item Terjual Per Channel {selectedDate !== 'ALL' && `(${selectedDate})`}</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-600 text-sm">
                                        <th className="p-3 border-b font-medium">Nama Menu (Sistem)</th>
                                        <th className="p-3 border-b font-medium text-center">Offline (POS)</th>
                                        <th className="p-3 border-b font-medium text-center">Food Apps</th>
                                        <th className="p-3 border-b font-medium text-center">TikTok Go</th>
                                        <th className="p-3 border-b font-medium text-center bg-gray-100">Total Kuantitas</th>
                                        <th className="p-3 border-b font-medium text-right bg-blue-50">Total Penjualan (Kotor)</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {displayedSummary.itemSalesTracker.map((item: any, idx: number) => {
                                        const sysOverlapItems = displayedSummary.systemOverlap?.itemSalesTracker || [];
                                        const matchedSysItem = sysOverlapItems.find((s: any) => s.systemName.toLowerCase() === item.systemName.toLowerCase());
                                        const pawoonCompletedQty = (item.offlineCompleted || 0) + (item.food_appsCompleted || 0) + (item.tiktokCompleted || 0);
                                        const sysQty = matchedSysItem ? (matchedSysItem.offline + matchedSysItem.food_apps + matchedSysItem.tiktok) : 0;
                                        // Badge hanya muncul kalau data sistem sudah PENUH (full overlap):
                                        // Overlap count >= 80% dari jumlah Pawoon → data sudah pernah di-sync sebelumnya.
                                        // Kalau partial (misal 1 online order vs 61 Pawoon), badge misleading → disembunyikan.
                                        const pawoonCount = displayedSummary.transactionsCount || 0;
                                        const sysOverlapCount = displayedSummary.systemOverlap?.count || 0;
                                        const isFullOverlap = pawoonCount > 0 && sysOverlapCount >= pawoonCount * 0.8;
                                        
                                        return (
                                            <tr key={idx} className="border-b hover:bg-gray-50 text-sm">
                                                <td className="p-3 font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <span>{item.systemName}</span>
                                                        {isFullOverlap && matchedSysItem && (
                                                            <>
                                                                {sysQty === pawoonCompletedQty ? (
                                                                    <span 
                                                                        className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                                                                        title={`Kuantitas pas: Pawoon (Selesai) ${pawoonCompletedQty}, Sistem ${sysQty}`}
                                                                    >
                                                                        ✅ Match Sempurna
                                                                    </span>
                                                                ) : sysQty > pawoonCompletedQty ? (
                                                                    <span 
                                                                        className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                                                                        title={`Sistem memiliki lebih banyak: Pawoon (Selesai) ${pawoonCompletedQty}, Sistem ${sysQty}`}
                                                                    >
                                                                        ✅ Match (+{sysQty - pawoonCompletedQty})
                                                                    </span>
                                                                ) : (
                                                                    <span 
                                                                        className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full flex items-center gap-1"
                                                                        title={`Sistem kekurangan data: Pawoon (Selesai) ${pawoonCompletedQty}, Sistem ${sysQty}`}
                                                                    >
                                                                        ⚠️ Kurang ({sysQty - pawoonCompletedQty})
                                                                    </span>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">{item.offline > 0 ? item.offline : '-'}</td>
                                                <td className="p-3 text-center">{item.food_apps > 0 ? item.food_apps : '-'}</td>
                                                <td className="p-3 text-center">{item.tiktok > 0 ? item.tiktok : '-'}</td>
                                                <td className="p-3 text-center font-bold bg-gray-50">{item.offline + item.food_apps + item.tiktok}</td>
                                                <td className="p-3 text-right font-bold text-blue-700 bg-blue-50/50">
                                                    Rp {item.totalRevenue?.toLocaleString('id-ID') || 0}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    {/* Subtotal per channel */}
                                    <tr className="bg-slate-50 text-xs text-slate-500 border-t border-gray-200">
                                        <td className="px-3 py-2 italic">↳ Subtotal Offline POS</td>
                                        <td className="px-3 py-2 text-center font-semibold text-slate-700">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offlineCompleted || 0), 0)}
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-300">—</td>
                                        <td className="px-3 py-2 text-center text-slate-300">—</td>
                                        <td className="px-3 py-2 text-center bg-slate-100 font-semibold text-slate-700">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offlineCompleted || 0), 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-400">—</td>
                                    </tr>
                                    <tr className="bg-slate-50 text-xs text-slate-500">
                                        <td className="px-3 py-2 italic">↳ Subtotal Food Apps</td>
                                        <td className="px-3 py-2 text-center text-slate-300">—</td>
                                        <td className="px-3 py-2 text-center font-semibold text-slate-700">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.food_appsCompleted || 0), 0)}
                                        </td>
                                        <td className="px-3 py-2 text-center text-slate-300">—</td>
                                        <td className="px-3 py-2 text-center bg-slate-100 font-semibold text-slate-700">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.food_appsCompleted || 0), 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-400">—</td>
                                    </tr>
                                    <tr className="bg-slate-50 text-xs text-slate-500 border-b border-gray-200">
                                        <td className="px-3 py-2 italic">↳ Subtotal TikTok Go</td>
                                        <td className="px-3 py-2 text-center text-slate-300">—</td>
                                        <td className="px-3 py-2 text-center text-slate-300">—</td>
                                        <td className="px-3 py-2 text-center font-semibold text-slate-700">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.tiktokCompleted || 0), 0)}
                                        </td>
                                        <td className="px-3 py-2 text-center bg-slate-100 font-semibold text-slate-700">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.tiktokCompleted || 0), 0)}
                                        </td>
                                        <td className="px-3 py-2 text-right text-slate-400">—</td>
                                    </tr>
                                    {/* Grand Total */}
                                    <tr className="bg-gray-100 text-sm font-bold border-t-2 border-gray-300">
                                        <td className="p-3">GRAND TOTAL</td>
                                        <td className="p-3 text-center">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offline || 0), 0)}
                                        </td>
                                        <td className="p-3 text-center">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.food_apps || 0), 0)}
                                        </td>
                                        <td className="p-3 text-center">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.tiktok || 0), 0)}
                                        </td>
                                        <td className="p-3 text-center bg-gray-200">
                                            {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offline || 0) + (item.food_apps || 0) + (item.tiktok || 0), 0)}
                                        </td>
                                        <td className="p-3 text-right text-blue-800 bg-blue-100">
                                            Rp {displayedSummary.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.totalRevenue || 0), 0).toLocaleString('id-ID')}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* System Overlap Details Table */}
                        {selectedDate !== 'ALL' && displayedSummary.systemOverlap?.itemSalesTracker && displayedSummary.systemOverlap.itemSalesTracker.length > 0 && (
                            <div className="mt-8 border-t border-gray-200 pt-6">
                                <h3 className="text-lg font-semibold mb-2 text-orange-800 flex items-center gap-2">
                                    <span className="text-xl">⚠️</span> Rekap Item Terjual (Data Sistem Saat Ini)
                                </h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Ini adalah rincian porsi menu yang <strong>sudah tersimpan di sistem</strong> pada tanggal {selectedDate}. Anda bisa membandingkannya dengan tabel Pawoon di atas.
                                </p>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse border border-orange-100">
                                        <thead>
                                            <tr className="bg-orange-50 text-orange-800 text-sm">
                                                <th className="p-3 border-b border-orange-100 font-medium">Nama Menu (Sistem)</th>
                                                <th className="p-3 border-b border-orange-100 font-medium text-center">Offline (POS)</th>
                                                <th className="p-3 border-b border-orange-100 font-medium text-center">Food Apps</th>
                                                <th className="p-3 border-b border-orange-100 font-medium text-center">TikTok Go</th>
                                                <th className="p-3 border-b border-orange-100 font-medium text-center bg-orange-100/50">Total Kuantitas</th>
                                                <th className="p-3 border-b border-orange-100 font-medium text-right bg-orange-100">Total Penjualan (Kotor)</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {displayedSummary.systemOverlap.itemSalesTracker.map((item: any, idx: number) => (
                                                <tr key={idx} className="border-b border-orange-50 hover:bg-orange-50/30 text-sm">
                                                    <td className="p-3 font-medium text-gray-800">{item.systemName}</td>
                                                    <td className="p-3 text-center">{item.offline > 0 ? item.offline : '-'}</td>
                                                    <td className="p-3 text-center">{item.food_apps > 0 ? item.food_apps : '-'}</td>
                                                    <td className="p-3 text-center">{item.tiktok > 0 ? item.tiktok : '-'}</td>
                                                    <td className="p-3 text-center font-bold bg-orange-50/30">{item.offline + item.food_apps + item.tiktok}</td>
                                                    <td className="p-3 text-right font-bold text-orange-700 bg-orange-50/50">
                                                        Rp {item.totalRevenue?.toLocaleString('id-ID') || 0}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            {/* Subtotal per channel */}
                                            <tr className="bg-orange-50/80 text-xs text-orange-600 border-t border-orange-200">
                                                <td className="px-3 py-2 italic">↳ Subtotal Offline POS</td>
                                                <td className="px-3 py-2 text-center font-semibold text-orange-800">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offline || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2 text-center text-orange-300">—</td>
                                                <td className="px-3 py-2 text-center text-orange-300">—</td>
                                                <td className="px-3 py-2 text-center bg-orange-100/60 font-semibold text-orange-800">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offline || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-orange-300">—</td>
                                            </tr>
                                            <tr className="bg-orange-50/80 text-xs text-orange-600">
                                                <td className="px-3 py-2 italic">↳ Subtotal Food Apps</td>
                                                <td className="px-3 py-2 text-center text-orange-300">—</td>
                                                <td className="px-3 py-2 text-center font-semibold text-orange-800">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.food_apps || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2 text-center text-orange-300">—</td>
                                                <td className="px-3 py-2 text-center bg-orange-100/60 font-semibold text-orange-800">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.food_apps || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-orange-300">—</td>
                                            </tr>
                                            <tr className="bg-orange-50/80 text-xs text-orange-600 border-b border-orange-200">
                                                <td className="px-3 py-2 italic">↳ Subtotal TikTok Go</td>
                                                <td className="px-3 py-2 text-center text-orange-300">—</td>
                                                <td className="px-3 py-2 text-center text-orange-300">—</td>
                                                <td className="px-3 py-2 text-center font-semibold text-orange-800">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.tiktok || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2 text-center bg-orange-100/60 font-semibold text-orange-800">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.tiktok || 0), 0)}
                                                </td>
                                                <td className="px-3 py-2 text-right text-orange-300">—</td>
                                            </tr>
                                            {/* Grand Total */}
                                            <tr className="bg-orange-100 text-sm font-bold border-t-2 border-orange-200">
                                                <td className="p-3 text-orange-900">GRAND TOTAL</td>
                                                <td className="p-3 text-center text-orange-900">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offline || 0), 0)}
                                                </td>
                                                <td className="p-3 text-center text-orange-900">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.food_apps || 0), 0)}
                                                </td>
                                                <td className="p-3 text-center text-orange-900">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.tiktok || 0), 0)}
                                                </td>
                                                <td className="p-3 text-center bg-orange-200 text-orange-900">
                                                    {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.offline || 0) + (item.food_apps || 0) + (item.tiktok || 0), 0)}
                                                </td>
                                                <td className="p-3 text-right text-orange-900 bg-orange-200">
                                                    Rp {displayedSummary.systemOverlap.itemSalesTracker.reduce((acc: number, item: any) => acc + (item.totalRevenue || 0), 0).toLocaleString('id-ID')}
                                                </td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        )}
                        
                        {selectedDate === 'ALL' && displayedSummary.totalOverlapCount > 0 && (
                            <div className="mt-8 border-t border-gray-200 pt-6">
                                <div className="bg-orange-50 rounded-lg p-4 text-orange-800 border border-orange-100 flex items-center">
                                    <span className="text-xl mr-3">⚠️</span>
                                    <p className="text-sm">
                                        Terdapat <strong>{displayedSummary.totalOverlapCount} transaksi</strong> yang sudah ada di sistem. 
                                        Pilih tanggal spesifik di filter atas untuk melihat rincian item (porsi) yang overlap.
                                    </p>
                                </div>
                            </div>
                        )}
                        
                        {previewResult.summary.postSystemSkippedCount > 0 && (
                            <div className="mt-4 border-t border-gray-200 pt-6">
                                <div className="bg-blue-50 rounded-lg p-4 text-blue-800 border border-blue-200 flex items-start">
                                    <span className="text-xl mr-3 mt-0.5">ℹ️</span>
                                    <div>
                                        <p className="font-semibold mb-1">
                                            {previewResult.summary.transactionsToInsert === 0 
                                                ? "Semua Data Melewati Tanggal Cutoff Sistem" 
                                                : "Sebagian Data Melewati Tanggal Cutoff Sistem"}
                                        </p>
                                        <p className="text-sm">
                                            Terdapat <strong>{previewResult.summary.postSystemSkippedCount} transaksi</strong> (senilai Rp {previewResult.summary.postSystemSkippedOmset?.toLocaleString('id-ID')}) yang terjadi pada atau setelah outlet ini resmi menggunakan sistem. Data ini <strong>tidak akan disimpan</strong> ke database untuk menghindari duplikasi dengan input kasir manual, dan hanya ditampilkan di layar ini untuk keperluan recheck/komparasi.
                                        </p>
                                        {previewResult.summary.cutoffs?.filter((c: any) => c.cutoffDate).length > 0 && (
                                            <p className="text-sm mt-2">
                                                Batas yang dipakai:{' '}
                                                {previewResult.summary.cutoffs
                                                    .filter((c: any) => c.cutoffDate)
                                                    .map((c: any) => `${c.outletName} → ${c.cutoffDate}`)
                                                    .join(' · ')}
                                                . Transaksi <strong>pada tanggal cutoff itu sendiri juga ikut di-skip</strong> (perbandingannya per hari, belum per jam).
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-end">
                        <button 
                            onClick={handleSync}
                            disabled={isLoading || (previewResult.summary.transactionsToInsert === 0 && (previewResult.summary.voidStatusUpdates || 0) === 0)}
                            className={`${previewResult.summary.transactionsToInsert === 0 && (previewResult.summary.voidStatusUpdates || 0) === 0 ? 'bg-gray-400 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700 shadow-sm shadow-green-200 active:scale-95'} text-white px-8 py-3 rounded-xl font-bold transition-all flex flex-col items-center justify-center`}
                        >
                            <span>
                                {isLoading 
                                    ? 'Menyinkronkan...' 
                                    : (previewResult.summary.transactionsToInsert === 0 && (previewResult.summary.voidStatusUpdates || 0) === 0 
                                        ? 'Tidak Ada Data Untuk Disimpan' 
                                        : 'Simpan ke Database Real')}
                            </span>
                            {!isLoading && (previewResult.summary.transactionsToInsert > 0 || (previewResult.summary.voidStatusUpdates || 0) > 0) && (
                                <span className="text-xs font-normal opacity-90">
                                    ({previewResult.summary.transactionsToInsert} pesanan baru, {previewResult.summary.duplicatesSkipped} duplikat, {previewResult.summary.postSystemSkippedCount || 0} cutoff-skipped
                                    {(previewResult.summary.voidStatusUpdates || 0) > 0 && `, ${previewResult.summary.voidStatusUpdates} void diupdate`})
                                </span>
                            )}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
