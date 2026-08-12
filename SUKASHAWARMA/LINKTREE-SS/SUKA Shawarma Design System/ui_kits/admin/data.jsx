// Mock data + helpers for admin UI kit

function formatRupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID').replace(/,/g, '.');
}
function shortRp(n) {
  if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1).replace('.', ',') + 'jt';
  if (n >= 1_000) return 'Rp ' + Math.round(n / 1_000) + 'rb';
  return formatRupiah(n);
}
function fmtTimeAgo(d) {
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return 'baru saja';
  if (diff < 3600) return Math.floor(diff / 60) + ' menit lalu';
  if (diff < 86400) return Math.floor(diff / 3600) + ' jam lalu';
  return Math.floor(diff / 86400) + ' hari lalu';
}

const OUTLETS_ADM = [
  { id: 'o-kitchen', slug: 'kitchen', name: 'Kitchen Pusat', type: 'owned',  active: true, address: 'Jl. Industri Raya No. 4' },
  { id: 'o-tebet',   slug: 'tebet',   name: 'Mitra Tebet Raya', type: 'partner', active: true, address: 'Jl. Tebet Raya No. 14' },
  { id: 'o-kemang',  slug: 'kemang',  name: 'Mitra Kemang', type: 'partner', active: true, address: 'Jl. Kemang Selatan No. 22' },
  { id: 'o-kelapa',  slug: 'kelapa',  name: 'Mitra Kelapa Gading', type: 'partner', active: true, address: 'Jl. Boulevard Raya' },
  { id: 'o-bsd',     slug: 'bsd',     name: 'Mitra BSD', type: 'partner', active: true, address: 'BSD City, sektor VII' },
  { id: 'o-depok',   slug: 'depok',   name: 'Mitra Depok Margonda', type: 'partner', active: false, address: 'Jl. Margonda Raya No. 88' },
];

let _seq = 100;
function makeOrder(o) {
  _seq++;
  return {
    id: 'ord-' + _seq,
    number: 'SS' + (200000 + _seq),
    createdAt: Date.now() - (o.minsAgo || 5) * 60000,
    customer: o.customer,
    wa: o.wa || '0812' + String(Math.floor(10000000 + Math.random()*89999999)),
    outletId: o.outletId,
    outletName: OUTLETS_ADM.find(x => x.id === o.outletId)?.name || '—',
    items: o.items,
    pickupTime: o.pickupTime,
    notes: o.notes,
    status: o.status,
    total: o.items.reduce((s, i) => s + i.qty * i.unitPrice, 0) + (o.fee || 0),
  };
}

const ORDERS_SEED = [
  makeOrder({ minsAgo: 2, customer: 'Budi Santoso', outletId: 'o-tebet',
    items: [{ name: 'Shawarma Klasik', qty: 2, unitPrice: 25000, opts: 'Sapi · Pedas · Reguler' },
            { name: 'Es Teh Manis', qty: 2, unitPrice: 6000 }],
    pickupTime: '30 menit lagi', notes: 'tanpa bawang', status: 'paid', fee: 434 }),
  makeOrder({ minsAgo: 8, customer: 'Siti Aminah', outletId: 'o-tebet',
    items: [{ name: 'Paket Duo', qty: 1, unitPrice: 70000, opts: 'Pedas Sedang' }],
    pickupTime: 'jam 14:00', notes: '', status: 'preparing', fee: 490 }),
  makeOrder({ minsAgo: 15, customer: 'Rahmat Hidayat', outletId: 'o-tebet',
    items: [{ name: 'Shawarma Spesial Keju', qty: 1, unitPrice: 32000, opts: 'Sapi · Sedang' },
            { name: 'Kebab Sapi Original', qty: 1, unitPrice: 22000 }],
    pickupTime: '15 menit lagi', notes: '', status: 'ready', fee: 378 }),
  makeOrder({ minsAgo: 32, customer: 'Dewi Lestari', outletId: 'o-tebet',
    items: [{ name: 'Shawarma Jumbo', qty: 1, unitPrice: 42000, opts: 'Domba · Extra Pedas' }],
    pickupTime: 'jam 13:30', notes: 'extra saus', status: 'done', fee: 294 }),
  makeOrder({ minsAgo: 65, customer: 'Anto Wijaya', outletId: 'o-tebet',
    items: [{ name: 'Paket Keluarga', qty: 1, unitPrice: 130000, opts: 'Pedas Sedang' }],
    pickupTime: 'jam 12:00', notes: '', status: 'done', fee: 910 }),
  makeOrder({ minsAgo: 90, customer: 'Maya Putri', outletId: 'o-tebet',
    items: [{ name: 'Shawarma Klasik', qty: 1, unitPrice: 25000 }],
    pickupTime: '20 menit lagi', notes: '', status: 'cancelled', fee: 175 }),
];

const MENU_ADM = [
  { id: 'm-klasik',    name: 'Shawarma Klasik',       emoji: '🌯', price: 25000, category: 'Shawarma', available: true,  best: true },
  { id: 'm-spesial',   name: 'Shawarma Spesial Keju', emoji: '🧀', price: 32000, category: 'Shawarma', available: true,  best: true },
  { id: 'm-jumbo',     name: 'Shawarma Jumbo',        emoji: '🌯', price: 42000, category: 'Shawarma', available: true,  best: false },
  { id: 'm-kebab',     name: 'Kebab Sapi Original',   emoji: '🥙', price: 22000, category: 'Kebab',    available: true,  best: false },
  { id: 'm-kebab-mix', name: 'Kebab Mix Daging',      emoji: '🥙', price: 38000, category: 'Kebab',    available: false, best: true },
  { id: 'm-paket-duo', name: 'Paket Duo',             emoji: '🍱', price: 70000, category: 'Paket',    available: true,  best: true },
  { id: 'm-jeruk',     name: 'Jeruk Peras Dingin',    emoji: '🍊', price: 12000, category: 'Minuman',  available: true,  best: false },
];

const STATUS_LABEL = {
  paid: 'Dibayar', preparing: 'Disiapkan', ready: 'Siap Ambil',
  done: 'Selesai', cancelled: 'Dibatalkan',
};
const STATUS_NEXT = {
  paid:      { next: 'preparing', label: 'Mulai Siapkan' },
  preparing: { next: 'ready',     label: 'Tandai Siap' },
  ready:     { next: 'done',      label: 'Selesai' },
};

Object.assign(window, {
  formatRupiah, shortRp, fmtTimeAgo,
  OUTLETS_ADM, ORDERS_SEED, MENU_ADM,
  STATUS_LABEL, STATUS_NEXT,
});
