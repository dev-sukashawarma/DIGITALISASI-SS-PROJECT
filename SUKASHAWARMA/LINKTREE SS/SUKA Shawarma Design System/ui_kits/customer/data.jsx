// Mock data + helpers for the customer UI kit.
// Mirrors the shape of the real Supabase tables (outlets / categories /
// menu_items / menu_variants / menu_variant_options).

const OUTLETS = [
  { slug: 'kitchen',     name: 'Kitchen Pusat',      open: '09:00', close: '21:00', isOpen: true,  type: 'owned' },
  { slug: 'tebet',       name: 'Mitra Tebet Raya',   open: '06:00', close: '22:00', isOpen: true,  type: 'partner' },
  { slug: 'kemang',      name: 'Mitra Kemang',       open: '11:00', close: '22:00', isOpen: false, type: 'partner' },
  { slug: 'kelapa',      name: 'Mitra Kelapa Gading',open: '10:00', close: '22:00', isOpen: true,  type: 'partner' },
  { slug: 'sudirman',    name: 'Mitra Sudirman',     open: '07:00', close: '21:00', isOpen: true,  type: 'partner' },
  { slug: 'depok',       name: 'Mitra Depok Margonda', open: '09:00', close: '22:00', isOpen: true, type: 'partner' },
  { slug: 'bekasi',      name: 'Mitra Bekasi Galaxy', open: '09:00', close: '22:00', isOpen: true, type: 'partner' },
  { slug: 'bsd',         name: 'Mitra BSD',          open: '09:00', close: '22:00', isOpen: true,  type: 'partner' },
];

const CATEGORIES = [
  { id: 1, name: 'Shawarma' },
  { id: 2, name: 'Kebab' },
  { id: 3, name: 'Paket' },
  { id: 4, name: 'Minuman' },
];

// Variants
const V_DAGING = {
  id: 'v-daging', label: 'Pilih Daging', isRequired: true, isMulti: false,
  options: [
    { id: 'o-sapi',   name: 'Sapi',   mod: 0,    isDefault: true },
    { id: 'o-ayam',   name: 'Ayam',   mod: -2000 },
    { id: 'o-domba',  name: 'Domba',  mod: 5000 },
  ],
};
const V_PEDAS = {
  id: 'v-pedas', label: 'Level Pedas', isRequired: true, isMulti: false,
  options: [
    { id: 'p-tidak', name: 'Tidak Pedas', mod: 0, isDefault: true },
    { id: 'p-sedang', name: 'Sedang', mod: 0 },
    { id: 'p-pedas',  name: 'Pedas',  mod: 0 },
    { id: 'p-extra',  name: 'Extra Pedas 🌶️', mod: 0 },
  ],
};
const V_TOPPING = {
  id: 'v-topping', label: 'Tambah Topping', isRequired: false, isMulti: true,
  options: [
    { id: 't-keju',    name: 'Keju Mozzarella', mod: 5000 },
    { id: 't-telur',   name: 'Telur',           mod: 3000 },
    { id: 't-extra',   name: 'Extra Daging',    mod: 8000 },
  ],
};
const V_UKURAN = {
  id: 'v-ukuran', label: 'Ukuran', isRequired: true, isMulti: false,
  options: [
    { id: 'u-reg',  name: 'Regular', mod: 0,    isDefault: true },
    { id: 'u-jumbo', name: 'Jumbo',  mod: 8000 },
  ],
};

const MENU = [
  {
    id: 'm-klasik',  categoryId: 1, name: 'Shawarma Klasik',
    desc: 'Daging panggang, sayur segar, saus tahini di tortilla hangat.',
    basePrice: 25000, comparePrice: 35000, isBestSeller: true, available: true,
    emoji: '🌯', variants: [V_DAGING, V_PEDAS, V_UKURAN, V_TOPPING],
  },
  {
    id: 'm-spesial', categoryId: 1, name: 'Shawarma Spesial Keju',
    desc: 'Mozzarella meleleh, saus garlic, daging sapi pilihan.',
    basePrice: 32000, comparePrice: null, isBestSeller: true, available: true,
    emoji: '🧀', variants: [V_DAGING, V_PEDAS, V_TOPPING],
  },
  {
    id: 'm-jumbo',   categoryId: 1, name: 'Shawarma Jumbo',
    desc: 'Porsi besar — cukup untuk berdua. Sayur double.',
    basePrice: 42000, comparePrice: 50000, isBestSeller: false, available: true,
    emoji: '🌯', variants: [V_DAGING, V_PEDAS, V_TOPPING],
  },
  {
    id: 'm-kebab-sapi', categoryId: 2, name: 'Kebab Sapi Original',
    desc: 'Roti pita, daging sapi panggang, salad, saus pedas.',
    basePrice: 22000, comparePrice: null, isBestSeller: false, available: true,
    emoji: '🥙', variants: [V_PEDAS, V_TOPPING],
  },
  {
    id: 'm-kebab-mix', categoryId: 2, name: 'Kebab Mix Daging',
    desc: 'Sapi + ayam + domba dalam satu pita. Hanya untuk yang serius lapar.',
    basePrice: 38000, comparePrice: null, isBestSeller: true, available: false,
    emoji: '🥙', variants: [V_PEDAS, V_TOPPING],
  },
  {
    id: 'm-paket-duo', categoryId: 3, name: 'Paket Duo',
    desc: '2 Shawarma Klasik + 2 Minuman. Hemat 15.000.',
    basePrice: 70000, comparePrice: 85000, isBestSeller: true, available: true,
    emoji: '🍱', variants: [V_PEDAS],
  },
  {
    id: 'm-paket-keluarga', categoryId: 3, name: 'Paket Keluarga',
    desc: '4 Shawarma + 4 Minuman + 1 French Fries Sharing.',
    basePrice: 130000, comparePrice: 150000, isBestSeller: false, available: true,
    emoji: '🍱', variants: [V_PEDAS],
  },
  {
    id: 'm-jeruk', categoryId: 4, name: 'Jeruk Peras Dingin',
    desc: 'Jeruk asli, tanpa gula tambahan.',
    basePrice: 12000, comparePrice: null, isBestSeller: false, available: true,
    emoji: '🍊', variants: [],
  },
  {
    id: 'm-teh', categoryId: 4, name: 'Es Teh Manis',
    desc: 'Klasik, dingin, segar.',
    basePrice: 6000, comparePrice: null, isBestSeller: false, available: true,
    emoji: '🥤', variants: [],
  },
];

// ── Helpers ─────────────────────────────────────────────
function formatRupiah(n) {
  if (n == null || isNaN(n)) return 'Rp 0';
  return 'Rp ' + Math.round(n).toLocaleString('id-ID').replace(/,/g, '.');
}

function calcUnitPrice(item, sel) {
  let p = item.basePrice;
  for (const v of item.variants) {
    const val = sel[v.id];
    if (v.isMulti) {
      for (const optName of (val || [])) {
        const o = v.options.find(o => o.name === optName);
        if (o) p += o.mod;
      }
    } else if (val) {
      const o = v.options.find(o => o.name === val);
      if (o) p += o.mod;
    }
  }
  return p;
}

function defaultSelections(item) {
  const sel = {};
  for (const v of item.variants) {
    if (v.isMulti) sel[v.id] = [];
    else {
      const def = v.options.find(o => o.isDefault) || v.options[0];
      sel[v.id] = def ? def.name : null;
    }
  }
  return sel;
}

function summarizeSelections(sel, variants) {
  const parts = [];
  for (const v of variants) {
    const val = sel[v.id];
    if (v.isMulti) {
      if (val && val.length) parts.push(val.join(', '));
    } else if (val && val !== (v.options.find(o => o.isDefault) || v.options[0]).name) {
      parts.push(val);
    } else if (val) {
      parts.push(val);
    }
  }
  return parts.join(' · ');
}

const SERVICE_FEE_RATE = 0.007;

Object.assign(window, {
  OUTLETS, CATEGORIES, MENU,
  formatRupiah, calcUnitPrice, defaultSelections, summarizeSelections,
  SERVICE_FEE_RATE,
});
