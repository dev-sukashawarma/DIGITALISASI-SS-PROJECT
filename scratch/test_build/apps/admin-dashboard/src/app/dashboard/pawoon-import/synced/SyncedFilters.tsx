'use client';

import { useRouter, usePathname } from 'next/navigation';

type Outlet = { id: string; name: string };

export default function SyncedFilters({
    outlets,
    selectedOutletId,
    fromDate,
    toDate,
}: {
    outlets: Outlet[];
    selectedOutletId: string;
    fromDate: string;
    toDate: string;
}) {
    const router = useRouter();
    const pathname = usePathname();

    const update = (key: string, value: string) => {
        const params = new URLSearchParams(window.location.search);
        if (value) params.set(key, value);
        else params.delete(key);
        router.push(`${pathname}?${params.toString()}`);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Outlet:</label>
                <select
                    defaultValue={selectedOutletId}
                    onChange={(e) => update('outlet', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                >
                    <option value="ALL">Semua Outlet</option>
                    {outlets.map((o) => (
                        <option key={o.id} value={o.id}>
                            {o.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Dari:</label>
                <input
                    type="date"
                    defaultValue={fromDate}
                    onChange={(e) => update('from', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                />
            </div>

            <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-600 whitespace-nowrap">Sampai:</label>
                <input
                    type="date"
                    defaultValue={toDate}
                    onChange={(e) => update('to', e.target.value)}
                    className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-400 outline-none"
                />
            </div>

            <button
                onClick={() => router.push(pathname)}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors ml-auto"
            >
                Reset Filter
            </button>
        </div>
    );
}
