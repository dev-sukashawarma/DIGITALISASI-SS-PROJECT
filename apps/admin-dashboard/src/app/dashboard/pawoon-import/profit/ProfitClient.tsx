'use client';

import { useRouter } from 'next/navigation';
import { useState, useMemo } from 'react';
import { Store, Calendar, TrendingUp, AlertCircle, DollarSign, PieChart, Info, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';

export default function ProfitClient({
    outlets,
    selectedOutletId,
    fromDate,
    toDate,
    totalOmset,
    totalHpp,
    grossProfit,
    marginPct,
    itemSummary,
    totalOrders
}: {
    outlets: any[];
    selectedOutletId: string;
    fromDate: string;
    toDate: string;
    totalOmset: number;
    totalHpp: number;
    grossProfit: number;
    marginPct: number;
    itemSummary: any[];
    totalOrders: number;
}) {
    const router = useRouter();
    const [filterOutlet, setFilterOutlet] = useState(selectedOutletId);
    const [filterFrom, setFilterFrom] = useState(fromDate);
    const [filterTo, setFilterTo] = useState(toDate);

    // Table states
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'profit', direction: 'desc' });

    const applyFilters = () => {
        const params = new URLSearchParams();
        if (filterOutlet !== 'ALL') params.set('outlet', filterOutlet);
        if (filterFrom) params.set('from', filterFrom);
        if (filterTo) params.set('to', filterTo);
        router.push(`/dashboard/pawoon-import/profit?${params.toString()}`);
    };

    const resetFilters = () => {
        setFilterOutlet('ALL');
        setFilterFrom('');
        setFilterTo('');
        router.push('/dashboard/pawoon-import/profit');
    };

    const formatRp = (num: number) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(num);
    };

    const hasMissingHpp = itemSummary.some(item => item.missingHpp);
    const isDataLoaded = selectedOutletId !== '';

    // Handle Sorting
    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'desc';
        if (sortConfig.key === key && sortConfig.direction === 'desc') {
            direction = 'asc';
        }
        setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 inline-block opacity-40 group-hover:opacity-100" />;
        return sortConfig.direction === 'asc' ? 
            <ArrowUp className="w-3.5 h-3.5 ml-1 inline-block text-suka-primary" /> : 
            <ArrowDown className="w-3.5 h-3.5 ml-1 inline-block text-suka-primary" />;
    };

    // Filter and Sort Data
    const processedSummary = useMemo(() => {
        let data = [...itemSummary];

        // 1. Search
        if (searchQuery.trim() !== '') {
            const lowerQuery = searchQuery.toLowerCase();
            data = data.filter(item => item.name.toLowerCase().includes(lowerQuery));
        }

        // 2. Sort
        data.sort((a, b) => {
            const profitA = a.omset - a.hppTotal;
            const profitB = b.omset - b.hppTotal;

            let valA, valB;
            switch (sortConfig.key) {
                case 'name':
                    valA = a.name; valB = b.name; break;
                case 'qty':
                    valA = a.qty; valB = b.qty; break;
                case 'omset':
                    valA = a.omset; valB = b.omset; break;
                case 'hppUnit':
                    valA = a.hppUnit; valB = b.hppUnit; break;
                case 'hppTotal':
                    valA = a.hppTotal; valB = b.hppTotal; break;
                case 'profit':
                    valA = profitA; valB = profitB; break;
                default:
                    valA = profitA; valB = profitB;
            }

            if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
            if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

        return data;
    }, [itemSummary, searchQuery, sortConfig]);


    return (
        <div className="space-y-6">
            {/* Filter Section */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-end">
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Store className="w-3.5 h-3.5" /> Outlet
                    </label>
                    <select
                        value={filterOutlet}
                        onChange={(e) => setFilterOutlet(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium text-sm"
                    >
                        <option value="" disabled>-- Pilih Outlet Dulu --</option>
                        <option value="ALL">Semua Outlet (Cabang & Mitra)</option>
                        <optgroup label="Cabang Internal">
                            {outlets.filter(o => o.type === 'outlet').map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Mitra">
                            {outlets.filter(o => o.type === 'mitra').map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                            ))}
                        </optgroup>
                    </select>
                </div>
                
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Dari Tanggal
                    </label>
                    <input
                        type="date"
                        value={filterFrom}
                        onChange={(e) => setFilterFrom(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-medium text-sm text-gray-700"
                    />
                </div>
                
                <div className="space-y-1.5 flex-1 min-w-[150px]">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Sampai Tanggal
                    </label>
                    <input
                        type="date"
                        value={filterTo}
                        onChange={(e) => setFilterTo(e.target.value)}
                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all font-medium text-sm text-gray-700"
                    />
                </div>
                
                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        onClick={applyFilters}
                        disabled={!filterOutlet}
                        className="flex-1 md:flex-none px-6 py-2.5 bg-suka-primary text-white rounded-xl font-bold shadow-lg shadow-suka-primary/30 hover:-translate-y-0.5 hover:shadow-suka-primary/50 transition-all text-sm disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none"
                    >
                        Terapkan
                    </button>
                    <button
                        onClick={resetFilters}
                        className="flex-1 md:flex-none px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all text-sm"
                    >
                        Reset
                    </button>
                </div>
            </div>

            {!isDataLoaded ? (
                <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="bg-amber-50 text-amber-500 p-4 rounded-full mb-4">
                        <PieChart className="w-8 h-8" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800 mb-2">Pilih Outlet Terlebih Dahulu</h3>
                    <p className="text-gray-500 max-w-sm text-sm">
                        Untuk mencegah sistem *lag* akibat menarik puluhan ribu data secara bersamaan, silakan pilih spesifik outlet (atau klik Semua Outlet) lalu tekan Terapkan.
                    </p>
                </div>
            ) : (
                <>
                    {hasMissingHpp && (
                        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl flex gap-3 items-start">
                            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600" />
                            <p className="text-sm">
                                <strong>Perhatian:</strong> Ada item terjual yang belum disetel modalnya (HPP = Rp 0). 
                                Silakan set HPP di menu Master Menu agar profit terhitung 100% akurat.
                            </p>
                        </div>
                    )}

                    {/* Scorecards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                                <PieChart className="w-24 h-24" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium mb-1 relative">Total Transaksi</p>
                            <h3 className="text-3xl font-black text-gray-900 relative">{totalOrders.toLocaleString('id-ID')} <span className="text-lg text-gray-400 font-medium">struk</span></h3>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                                <DollarSign className="w-24 h-24" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium mb-1 relative">Total Pendapatan (Omset)</p>
                            <h3 className="text-3xl font-black text-blue-600 relative">{formatRp(totalOmset)}</h3>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
                                <Store className="w-24 h-24" />
                            </div>
                            <p className="text-gray-500 text-sm font-medium mb-1 relative flex items-center gap-2">
                                Total HPP (Modal)
                            </p>
                            <h3 className="text-3xl font-black text-red-500 relative">{formatRp(totalHpp)}</h3>
                        </div>
                        <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-6 rounded-2xl shadow-lg shadow-green-500/30 text-white relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
                                <TrendingUp className="w-24 h-24" />
                            </div>
                            <p className="text-green-50 text-sm font-medium mb-1 relative">Laba Kotor (Gross Profit)</p>
                            <h3 className="text-3xl font-black relative">{formatRp(grossProfit)}</h3>
                            <div className="mt-2 inline-flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-full text-xs font-bold backdrop-blur-sm">
                                Margin: {marginPct.toFixed(1)}%
                            </div>
                        </div>
                    </div>

                    {/* Table Detail */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                        <div className="p-5 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center bg-gray-50/50 gap-4">
                            <div>
                                <h3 className="font-bold text-lg text-gray-800">Rincian Penjualan per Menu</h3>
                                {selectedOutletId === 'ALL' && (
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                        <Info className="w-3.5 h-3.5" /> 
                                        Catatan: Anda sedang melihat semua outlet. HPP/pcs yang tampil mungkin bervariasi antara Cabang & Mitra.
                                    </p>
                                )}
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Cari menu..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-full md:w-64"
                                />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-white border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider font-extrabold">
                                    <tr>
                                        <th className="px-6 py-4 cursor-pointer hover:bg-gray-50 group" onClick={() => handleSort('name')}>
                                            Menu Item <SortIcon columnKey="name" />
                                        </th>
                                        <th className="px-6 py-4 text-center cursor-pointer hover:bg-gray-50 group" onClick={() => handleSort('qty')}>
                                            Qty <SortIcon columnKey="qty" />
                                        </th>
                                        <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-50 group" onClick={() => handleSort('omset')}>
                                            Omset <SortIcon columnKey="omset" />
                                        </th>
                                        <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-50 group" onClick={() => handleSort('hppUnit')}>
                                            HPP / pcs <SortIcon columnKey="hppUnit" />
                                        </th>
                                        <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-50 group" onClick={() => handleSort('hppTotal')}>
                                            Total Modal (HPP) <SortIcon columnKey="hppTotal" />
                                        </th>
                                        <th className="px-6 py-4 text-right cursor-pointer hover:bg-gray-50 group" onClick={() => handleSort('profit')}>
                                            Laba Kotor <SortIcon columnKey="profit" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {processedSummary.map((item, idx) => {
                                        const profit = item.omset - item.hppTotal;
                                        return (
                                            <tr key={idx} className="hover:bg-gray-50/80 transition-colors">
                                                <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-2">
                                                    {item.name}
                                                    {item.missingHpp && (
                                                        <span className="bg-red-100 text-red-600 text-[10px] px-2 py-0.5 rounded-full font-bold whitespace-nowrap">Set HPP!</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center font-bold text-gray-700">{item.qty.toLocaleString('id-ID')}</td>
                                                <td className="px-6 py-4 text-right font-medium text-gray-900">{formatRp(item.omset)}</td>
                                                <td className="px-6 py-4 text-right text-gray-500">
                                                    {formatRp(item.hppUnit)}
                                                    {item.outletType === 'mitra' && !item.missingHpp && (
                                                        <div className="text-[9px] text-amber-600 font-bold mt-0.5">(+10% Mitra)</div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right text-red-500 font-medium">{formatRp(item.hppTotal)}</td>
                                                <td className="px-6 py-4 text-right font-bold text-green-600">{formatRp(profit)}</td>
                                            </tr>
                                        );
                                    })}
                                    {processedSummary.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                                                {searchQuery ? (
                                                    <>Tidak ada menu yang sesuai dengan pencarian "<strong>{searchQuery}</strong>".</>
                                                ) : (
                                                    <>Tidak ada data penjualan untuk filter ini.</>
                                                )}
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
