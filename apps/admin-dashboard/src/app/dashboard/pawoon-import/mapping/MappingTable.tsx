'use client';

import { useState } from 'react';

export default function MappingTable({ mappingList, outletMap }: { mappingList: any[], outletMap: any[] }) {
    const [searchName, setSearchName] = useState('');
    const [filterMatch, setFilterMatch] = useState('all'); // all, match, mismatch
    const [filterOutlet, setFilterOutlet] = useState('all');
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

    // Filter logic
    const filteredList = mappingList.filter(item => {
        // Name filter (search in Pawoon Name or System Name)
        if (searchName) {
            const searchLower = searchName.toLowerCase();
            const pawoonMatch = item.pawoonName.toLowerCase().includes(searchLower);
            const systemMatch = item.systemName.toLowerCase().includes(searchLower);
            if (!pawoonMatch && !systemMatch) return false;
        }

        // Match filter
        if (filterMatch === 'match' && !item.isMatch) return false;
        if (filterMatch === 'mismatch' && item.isMatch) return false;

        // Outlet filter
        if (filterOutlet !== 'all') {
            if (item.outlets === 'Semua Outlet') {
                // If it's available in all outlets, it passes any outlet filter (or maybe not? Usually yes, it's available everywhere)
                // But let's say they want to see specifically if an outlet has it.
                // It's available everywhere, so true.
            } else {
                // Check if the specific outlet name is in the string
                if (!item.outlets.includes(filterOutlet)) return false;
            }
        }

        return true;
    });

    // Sort logic
    const sortedList = [...filteredList].sort((a, b) => {
        if (!sortConfig) return 0;
        const { key, direction } = sortConfig;
        
        let aVal = a[key];
        let bVal = b[key];
        
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();

        if (aVal < bVal) return direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return direction === 'asc' ? 1 : -1;
        return 0;
    });

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const getSortIcon = (key: string) => {
        if (!sortConfig || sortConfig.key !== key) return <span className="text-gray-300 ml-1">⇅</span>;
        return sortConfig.direction === 'asc' ? <span className="text-blue-600 ml-1">↑</span> : <span className="text-blue-600 ml-1">↓</span>;
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                <span className="font-semibold text-gray-700">Total Mapping Aktif: {sortedList.length} Item</span>
                
                {/* Filters */}
                <div className="flex flex-wrap gap-3">
                    <input 
                        type="text" 
                        placeholder="Cari nama menu..." 
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm w-48"
                        value={searchName}
                        onChange={e => setSearchName(e.target.value)}
                    />
                    
                    <select 
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                        value={filterMatch}
                        onChange={e => setFilterMatch(e.target.value)}
                    >
                        <option value="all">Semua Status Harga</option>
                        <option value="match">✅ Harga Match</option>
                        <option value="mismatch">❌ Harga Beda</option>
                    </select>

                    <select 
                        className="border border-gray-300 rounded px-3 py-1.5 text-sm"
                        value={filterOutlet}
                        onChange={e => setFilterOutlet(e.target.value)}
                    >
                        <option value="all">Semua Outlet</option>
                        {outletMap.map(outlet => (
                            <option key={outlet.id} value={outlet.name}>
                                {outlet.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white text-gray-700 text-sm border-b">
                            <th className="p-4 font-semibold w-12 text-center">No</th>
                            <th className="p-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('pawoonName')}>
                                Nama Menu (Pawoon Excel) {getSortIcon('pawoonName')}
                            </th>
                            <th className="p-4 font-semibold text-blue-700 bg-blue-50 cursor-pointer hover:bg-blue-100" onClick={() => handleSort('pawoonPrice')}>
                                Harga (Pawoon) {getSortIcon('pawoonPrice')}
                            </th>
                            <th className="p-4 font-semibold cursor-pointer hover:bg-gray-50" onClick={() => handleSort('systemName')}>
                                Nama Menu (Sistem SS) {getSortIcon('systemName')}
                            </th>
                            <th className="p-4 font-semibold text-green-700 bg-green-50 cursor-pointer hover:bg-green-100" onClick={() => handleSort('priceOffline')}>
                                Harga (Sistem) {getSortIcon('priceOffline')}
                            </th>
                            <th className="p-4 font-semibold text-orange-700 bg-orange-50">Channel Penjualan</th>
                            <th className="p-4 font-semibold text-purple-700 bg-purple-50">Ketersediaan Outlet</th>
                            <th className="p-4 font-semibold text-center cursor-pointer hover:bg-gray-50" onClick={() => handleSort('isMatch')}>
                                Notes {getSortIcon('isMatch')}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedList.length > 0 ? (
                            sortedList.map((item, idx) => (
                                <tr key={idx} className="border-b hover:bg-gray-50 text-sm transition-colors">
                                    <td className="p-4 text-center text-gray-500">{idx + 1}</td>
                                    <td className="p-4 font-medium text-blue-700">{item.pawoonName}</td>
                                    <td className="p-4 font-bold text-blue-800 bg-blue-50/30">
                                        Rp {item.pawoonPrice ? item.pawoonPrice.toLocaleString('id-ID') : '-'}
                                    </td>
                                    <td className="p-4 font-bold text-green-700">{item.systemName}</td>
                                    <td className="p-4 text-green-800 bg-green-50/30">
                                        <div className="font-semibold">{item.targetLabel}: Rp {item.targetPrice ? item.targetPrice.toLocaleString('id-ID') : '0'}</div>
                                    </td>
                                    <td className="p-4 text-orange-800 bg-orange-50/30">
                                        {item.channels.split(', ').map((c: string) => (
                                            <span key={c} className="inline-block bg-white border border-orange-200 text-xs px-2 py-1 rounded mr-1 mb-1">
                                                {c}
                                            </span>
                                        ))}
                                    </td>
                                    <td className="p-4 text-purple-800 bg-purple-50/30 text-xs leading-relaxed max-w-[150px]">
                                        {item.outlets === 'Semua Outlet' ? (
                                            <span className="font-semibold text-purple-600">{item.outlets}</span>
                                        ) : (
                                            item.outlets
                                        )}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${item.isMatch ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                            {item.notes}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={8} className="p-6 text-center text-gray-500">Data mapping tidak ditemukan.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
