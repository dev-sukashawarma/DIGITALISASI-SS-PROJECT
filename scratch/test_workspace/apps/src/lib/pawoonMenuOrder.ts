// Urutan tampil menu untuk tabel "Rekap Item Terjual Per Channel" (Migrasi Pawoon) dan
// "Rincian Penjualan per Menu" (Laba Kotor) — sesuai urutan yang diminta owner, bukan
// alphabetical/omset. Item yang namanya tidak ada di daftar ini ditaruh di akhir.
export const PAWOON_MENU_ORDER: string[] = [
    'Original Ayam Sedang',
    'Original Ayam Besar',
    'Original Ayam Jumbo',
    'Original Sapi Sedang',
    'Original Sapi Besar',
    'Original Sapi Jumbo',
    'Original Mix Besar',
    'Original Mix Jumbo',
    'Suka Chicken',
    'Suka Beef',
    'Suka Fried Chicken',
    'Suka Samyang',
    'Shawarmie Ayam',
    'Shawarmie Sapi',
    'Combo #1',
    'Combo #1 UP SIZE BESAR',
    'Combo #1 UP SIZE JUMBO',
    'Combo #2',
    'Combo #2 UP SIZE BESAR',
    'Combo #2 UP SIZE JUMBO',
    'Combo #3',
    'Combo #3 UP SIZE JUMBO',
    'Combo 4',
    'Combo 5',
    'Extra Keju',
    'Extra Kentang',
];

const ORDER_INDEX: Record<string, number> = {};
PAWOON_MENU_ORDER.forEach((name, idx) => { ORDER_INDEX[name] = idx; });

// Item di luar daftar ditaruh di akhir (index besar), urut sesuai kemunculan aslinya di antara sesama item di luar daftar.
export function pawoonMenuOrderIndex(name: string): number {
    return ORDER_INDEX[name] ?? PAWOON_MENU_ORDER.length;
}
