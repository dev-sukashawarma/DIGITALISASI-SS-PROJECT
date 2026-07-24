'use client';

import { useState } from 'react';
import { previewPawoonFile, syncPawoonData } from '@/app/actions/pawoon';

export default function PawoonImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [previewResult, setPreviewResult] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState('');
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [selectedDate, setSelectedDate] = useState<string>('ALL');

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
            const result = await syncPawoonData(previewResult.data.orders, previewResult.data.items);
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

            {previewResult && previewResult.unmappedItems && (
                <div className="bg-red-50 rounded-xl p-6 shadow-sm mb-6 border border-red-200">
                    <h2 className="text-xl font-bold text-red-700 mb-4">Peringatan Dini: Data Tidak Dikenali</h2>
                    <p className="text-red-600 mb-4">Sistem menemukan Item atau Outlet yang belum di-mapping. Data tidak bisa di-sync sebelum ini diperbaiki.</p>
                    
                    {previewResult.unmappedItems.length > 0 && (
                        <div className="mb-4">
                            <h3 className="font-semibold mb-2">Menu/Produk Tidak Dikenali:</h3>
                            <ul className="list-disc pl-5">
                                {previewResult.unmappedItems.map((item: string) => (
                                    <li key={item} className="text-red-600">{item}</li>
                                ))}
                            </ul>
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
                                    {previewResult.summary.byDate.map((d: any) => (
                                        <option key={d.date} value={d.date}>{d.date}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    
                    <div className="p-6 pt-0 border-b border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8 mt-4">
                            <div className="bg-green-50 p-4 rounded-xl">
                                <p className="text-green-600 text-sm font-medium mb-1 leading-tight">Total Omset (Kotor) {selectedDate !== 'ALL' && `(${selectedDate})`}</p>
                                <p className="text-2xl font-bold text-green-900 mt-1">
                                    Rp {(displayedSummary.totalOmsetGross || displayedSummary.totalOmset).toLocaleString('id-ID')}
                                </p>
                            </div>
                            
                            <div className="bg-orange-50 p-4 rounded-xl">
                                <p className="text-orange-600 text-sm font-medium mb-1">Total Void</p>
                                <p className="text-2xl font-bold text-orange-900">
                                    {displayedSummary.totalVoids || 0}
                                </p>
                                <p className="text-xs font-medium text-orange-600 mt-1">
                                    Rp {new Intl.NumberFormat('id-ID').format(displayedSummary.totalOmsetVoid || 0)}
                                </p>
                            </div>

                            <div className="bg-blue-50 p-4 rounded-xl">
                                <p className="text-blue-600 text-sm font-medium mb-1">Grand Total Excel</p>
                                <p className="text-2xl font-bold text-blue-900 mt-1">
                                    Rp {displayedSummary.totalOmset.toLocaleString('id-ID')}
                                </p>
                                {selectedDate === 'ALL' && displayedSummary.fileGrandTotal > 0 && (
                                    <p className="text-[10px] text-blue-700 mt-1 font-medium leading-tight">
                                        (Validasi: Rp {displayedSummary.fileGrandTotal.toLocaleString('id-ID')})
                                    </p>
                                )}
                            </div>

                            <div className="bg-purple-50 p-4 rounded-xl">
                                <p className="text-purple-600 text-sm font-medium mb-1">Total Struk</p>
                                <p className="text-2xl font-bold text-purple-900 mt-1">
                                    {selectedDate === 'ALL' ? displayedSummary.totalTransactionsParsed : displayedSummary.transactionsCount}
                                </p>
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl">
                                <p className="text-gray-600 text-sm font-medium mb-1">Duplikat (Skip)</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {displayedSummary.duplicatesSkipped}
                                </p>
                            </div>
                        </div>

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
                                    {displayedSummary.itemSalesTracker.map((item: any, idx: number) => (
                                        <tr key={idx} className="border-b hover:bg-gray-50 text-sm">
                                            <td className="p-3 font-medium">{item.systemName}</td>
                                            <td className="p-3 text-center">{item.offline > 0 ? item.offline : '-'}</td>
                                            <td className="p-3 text-center">{item.food_apps > 0 ? item.food_apps : '-'}</td>
                                            <td className="p-3 text-center">{item.tiktok > 0 ? item.tiktok : '-'}</td>
                                            <td className="p-3 text-center font-bold bg-gray-50">{item.offline + item.food_apps + item.tiktok}</td>
                                            <td className="p-3 text-right font-bold text-blue-700 bg-blue-50/50">
                                                Rp {item.totalRevenue?.toLocaleString('id-ID') || 0}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="p-6 bg-gray-50 flex justify-end">
                        <button 
                            onClick={handleSync}
                            disabled={isLoading || previewResult.summary.transactionsToInsert === 0}
                            className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm shadow-green-200 hover:bg-green-700 disabled:opacity-50 transition-all active:scale-95 flex flex-col items-center justify-center"
                        >
                            <span>{isLoading ? 'Menyinkronkan...' : 'Sync ke Database Real'}</span>
                            {!isLoading && <span className="text-xs font-normal opacity-90">({previewResult.summary.transactionsToInsert} pesanan baru, {previewResult.summary.duplicatesSkipped} di-skip)</span>}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
