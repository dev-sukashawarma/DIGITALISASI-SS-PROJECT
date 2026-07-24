import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Setup Supabase (Server side)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const revalidate = 0; // Disable cache to always show latest synced data

export default async function SyncedPawoonDataPage() {
    // Fetch total count
    const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'PAWOON');

    // Fetch latest 100 orders
    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id, 
            external_order_id, 
            total_amount, 
            created_at, 
            status, 
            channel,
            outlets(name)
        `)
        .eq('source', 'PAWOON')
        .order('created_at', { ascending: false })
        .limit(100);

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Data Pawoon Tersinkron</h1>
                    <p className="text-gray-600 mt-2">Menampilkan 100 riwayat transaksi terakhir yang berhasil masuk ke sistem dari Excel Pawoon.</p>
                </div>
                <Link 
                    href="/dashboard/pawoon-import"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    Kembali ke Migrasi
                </Link>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                    <span className="font-semibold text-gray-700">Total Transaksi Tersinkron: {count || 0} Data</span>
                </div>
                
                {error ? (
                    <div className="p-6 text-red-600">Gagal memuat data: {error.message}</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-white text-gray-700 text-sm border-b">
                                    <th className="p-4 font-semibold">Tanggal / Waktu</th>
                                    <th className="p-4 font-semibold">ID Struk</th>
                                    <th className="p-4 font-semibold">Outlet</th>
                                    <th className="p-4 font-semibold">Channel</th>
                                    <th className="p-4 font-semibold">Status</th>
                                    <th className="p-4 font-semibold text-right">Total (Net)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders && orders.length > 0 ? (
                                    orders.map((order: any) => (
                                        <tr key={order.id} className="border-b hover:bg-gray-50 text-sm transition-colors">
                                            <td className="p-4 text-gray-600 whitespace-nowrap">
                                                {new Date(order.created_at).toLocaleString('id-ID', {
                                                    year: 'numeric', month: '2-digit', day: '2-digit', 
                                                    hour: '2-digit', minute:'2-digit'
                                                })}
                                            </td>
                                            <td className="p-4 font-medium text-blue-700">{order.external_order_id}</td>
                                            <td className="p-4 text-gray-700">{order.outlets?.name || '-'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    order.channel === 'pos' ? 'bg-blue-100 text-blue-700' :
                                                    order.channel === 'food_apps' ? 'bg-green-100 text-green-700' :
                                                    'bg-purple-100 text-purple-700'
                                                }`}>
                                                    {order.channel}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                                                    'bg-red-100 text-red-700'
                                                }`}>
                                                    {order.status}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-bold text-gray-900">
                                                Rp {order.total_amount?.toLocaleString('id-ID')}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={6} className="p-6 text-center text-gray-500">Belum ada data Pawoon yang disinkronisasi.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
