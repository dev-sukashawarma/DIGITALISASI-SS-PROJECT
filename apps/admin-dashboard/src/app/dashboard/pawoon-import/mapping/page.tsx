import fs from 'fs';
import path from 'path';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import MappingTable from './MappingTable';

// Setup Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export const revalidate = 0;

export default async function PawoonMappingPage() {
    const mapPath = path.join(process.cwd(), 'src', 'data', 'pawoon_item_map.json');
    let mappingData: Record<string, any> = {};
    
    if (fs.existsSync(mapPath)) {
        const fileData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        mappingData = fileData.mapping || {};
    }

    // Ambil System IDs
    const systemIds = Object.values(mappingData).map((m: any) => m.system_id).filter(Boolean);
    const uniqueSystemIds = Array.from(new Set(systemIds));

    // Fetch Data dari Database
    const { data: outlets } = await supabase.from('outlets').select('id, name');
    const outletMap = new Map((outlets || []).map(o => [o.id, o.name]));

    const { data: menuItems } = await supabase
        .from('menu_items')
        .select('id, price, channel_prices, available_outlets, available_online_channels')
        .in('id', uniqueSystemIds);
        
    const menuItemsMap = new Map((menuItems || []).map(m => [m.id, m]));

    const mappingList = Object.keys(mappingData).map(pawoonName => {
        const sysData = mappingData[pawoonName];
        const dbItem = menuItemsMap.get(sysData.system_id);
        
        let outletNames = 'Semua Outlet';
        if (dbItem?.available_outlets && dbItem.available_outlets.length > 0) {
            outletNames = dbItem.available_outlets.map((id: string) => {
                const name = outletMap.get(id);
                return name ? name.replace('Suka Shawarma ', '') : id;
            }).join(', ');
        }

        let channels = 'Offline (POS)';
        const chSet = new Set(['Offline (POS)']);
        
        if (dbItem?.available_online_channels && dbItem.available_online_channels.length > 0) {
            dbItem.available_online_channels.forEach((c: string) => {
                if (c === 'tiktokgo') chSet.add('TikTok Go');
                else if (c === 'gofood' || c === 'grabfood' || c === 'shopeefood' || c === 'food_apps') chSet.add('Food Apps');
                else chSet.add(c);
            });
        }
        
        // Also infer from channel_prices if set
        if (dbItem?.channel_prices) {
            const cp = dbItem.channel_prices;
            if (cp.gofood || cp.grabfood || cp.shopeefood) chSet.add('Food Apps');
            if (cp.tiktokgo) chSet.add('TikTok Go');
        }
        
        channels = Array.from(chSet).join(', ');

        const onlinePrices = [];
        if (dbItem?.channel_prices) {
            const cp = dbItem.channel_prices;
            if (cp.gofood || cp.grabfood || cp.shopeefood) {
                onlinePrices.push({ label: 'Food Apps', price: cp.gofood || cp.grabfood || cp.shopeefood });
            }
            if (cp.tiktokgo) {
                onlinePrices.push({ label: 'TikTok Go', price: cp.tiktokgo });
            }
        }

        const pawoonPrice = sysData.pawoon_price || 0;
        let isMatch = false;
        let notes = '';
        let targetPrice = dbItem?.price || 0;
        let targetLabel = 'Offline';

        if (!pawoonPrice) {
            isMatch = false;
            notes = '❌ Harga Pawoon Rp 0';
        } else if (pawoonName.includes('FOOD APPS')) {
            const cp = dbItem?.channel_prices || {};
            targetPrice = cp.gofood || cp.grabfood || cp.shopeefood || dbItem?.price || 0;
            targetLabel = 'Food Apps';
            isMatch = (pawoonPrice === targetPrice);
            notes = isMatch ? '✅ Sesuai (Food Apps)' : '❌ Beda Harga';
        } else if (pawoonName.includes('BEST SELLER')) {
            const cp = dbItem?.channel_prices || {};
            targetPrice = cp.tiktokgo || dbItem?.price || 0;
            targetLabel = 'TikTok Go';
            isMatch = (pawoonPrice === targetPrice);
            notes = isMatch ? '✅ Sesuai (TikTok Go)' : '❌ Beda Harga';
        } else {
            isMatch = (pawoonPrice === targetPrice);
            notes = isMatch ? '✅ Sesuai (Offline)' : '❌ Beda Harga';
        }

        // If targetLabel is online but not in the onlinePrices array, inject it with targetPrice
        if (targetLabel !== 'Offline' && !onlinePrices.find(p => p.label === targetLabel)) {
            onlinePrices.push({ label: targetLabel, price: targetPrice });
        }

        return {
            pawoonName,
            systemName: sysData.system_name || sysData.name || '-',
            systemId: sysData.system_id,
            outlets: outletNames,
            channels: channels,
            priceOffline: dbItem?.price || 0,
            priceOnline: onlinePrices,
            pawoonPrice: pawoonPrice,
            targetPrice,
            targetLabel,
            isMatch,
            notes
        };
    });

    const outletList = Array.from(outletMap.values()).map(name => ({ id: name, name }));

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold">Mapping Menu Pawoon</h1>
                    <p className="text-gray-600 mt-2">Daftar komparasi antara nama menu di Excel Pawoon dengan nama menu di Sistem.</p>
                </div>
                <Link 
                    href="/dashboard/pawoon-import"
                    className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                    Kembali ke Migrasi
                </Link>
            </div>
            
            <MappingTable mappingList={mappingList} outletMap={outletList} />
        </div>
    );
}
