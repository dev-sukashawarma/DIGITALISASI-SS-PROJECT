// Audited Monthly Closing Data for Mitra Outlets
// Generated from OPEX AGUSTUS FINAL BANGET.xlsx

export interface MitraMonthlyClosingOutlet {
  name: string
  pos: { revenue: number; cogs: number; deductions: number }
  foodApps: { revenue: number; cogs: number; deductions: number }
  tiktok: { revenue: number; cogs: number; deductions: number }
  totals: {
    grossRevenue: number
    totalDeductions: number
    netRevenue: number
    totalCogs: number
    grossProfit: number
    totalWaste: number
    totalOpex: number
    managementFeePct: number
    managementFeeAmount: number
    netProfit: number
    mitraShare: number
    /** Persentase bagi hasil mitra yang dipakai closing (hanya diisi mulai September 2026). */
    profitSharingPct?: number
  }
  /**
   * Rincian OPEX per baris laporan (hanya diisi mulai September 2026). Jumlahnya
   * WAJIB sama dengan `totals.totalOpex` — dijaga `lib/mitraClosing.test.ts`.
   */
  opexLines?: { label: string; amount: number; source: 'petty_cash' | 'monthly' }[]
}

export const MITRA_CLOSING_DATA_AUGUST_2026: Record<string, MitraMonthlyClosingOutlet> = {
  '550e8400-e29b-41d4-a716-446655440014': {
    name: 'MITRA CIBINONG',
    pos: { revenue: 43834236, cogs: 28941022, deductions: 0 },
    foodApps: { revenue: 81251000, cogs: 39054840, deductions: 11828231 },
    tiktok: { revenue: 9299877, cogs: 7746983, deductions: 1542000 },
    totals: {
      grossRevenue: 134385113,
      totalDeductions: 13370231,
      netRevenue: 121014882,
      totalCogs: 75742845,
      grossProfit: 45272037,
      totalWaste: 1205350,
      totalOpex: 13982001.9,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 30084685.1,
      mitraShare: 15042342.55
    }
  },
  '550e8400-e29b-41d4-a716-446655440017': {
    name: 'MITRA CISEENG',
    pos: { revenue: 12275756, cogs: 8079390, deductions: 0 },
    foodApps: { revenue: 26348000, cogs: 12272755, deductions: 3340637 },
    tiktok: { revenue: 9000378, cogs: 7711896, deductions: 38000 },
    totals: {
      grossRevenue: 47624134,
      totalDeductions: 3378637,
      netRevenue: 44245497,
      totalCogs: 28064041,
      grossProfit: 16181456,
      totalWaste: 28200,
      totalOpex: 10825083.9,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 5328172.1,
      mitraShare: 3196903.26
    }
  },
  '550e8400-e29b-41d4-a716-446655440018': {
    name: 'MITRA PEKAYON',
    pos: { revenue: 17989603, cogs: 11751960, deductions: 0 },
    foodApps: { revenue: 36321000, cogs: 16824005, deductions: 5324709 },
    tiktok: { revenue: 5480434, cogs: 4499116, deductions: 0 },
    totals: {
      grossRevenue: 59791037,
      totalDeductions: 5324709,
      netRevenue: 54466328,
      totalCogs: 33075081,
      grossProfit: 21391247,
      totalWaste: 63700,
      totalOpex: 13324064.7,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 8003482.3,
      mitraShare: 4802089.38
    }
  },
  '550e8400-e29b-41d4-a716-446655440019': {
    name: 'MITRA KALISARI',
    pos: { revenue: 12675466, cogs: 8316561, deductions: 0 },
    foodApps: { revenue: 26922001, cogs: 13066020, deductions: 4055609 },
    tiktok: { revenue: 3404244, cogs: 2733750, deductions: 0 },
    totals: {
      grossRevenue: 43001711,
      totalDeductions: 4055609,
      netRevenue: 38946102,
      totalCogs: 24116331,
      grossProfit: 14829771,
      totalWaste: 0,
      totalOpex: 9531394.4,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 5298376.6,
      mitraShare: 3179025.96
    }
  },
  '43b7bbd1-1fd4-44b5-87ca-b07a271151af': {
    name: 'MITRA SENTUL',
    pos: { revenue: 40978780, cogs: 26665771, deductions: 0 },
    foodApps: { revenue: 24557000, cogs: 11447040, deductions: 3347336 },
    tiktok: { revenue: 8822686, cogs: 7359465, deductions: 0 },
    totals: {
      grossRevenue: 74358466,
      totalDeductions: 3347336,
      netRevenue: 71011130,
      totalCogs: 45472276,
      grossProfit: 25538854,
      totalWaste: 2302711,
      totalOpex: 14430894.9,
      managementFeePct: 3,
      managementFeeAmount: 2230753.98,
      netProfit: 6574494.12,
      mitraShare: 6574494.12
    }
  },
  '3f38c41d-11e3-49ce-a189-d7303e45f9ad': {
    name: 'MITRA CIBUBUR',
    pos: { revenue: 58240063, cogs: 37906220, deductions: 0 },
    foodApps: { revenue: 20903000, cogs: 10409465, deductions: 0 },
    tiktok: { revenue: 18091857, cogs: 16575613, deductions: 0 },
    totals: {
      grossRevenue: 97234920,
      totalDeductions: 0,
      netRevenue: 97234920,
      totalCogs: 64891298,
      grossProfit: 32343622,
      totalWaste: 313500,
      totalOpex: 17326358.4,
      managementFeePct: 3,
      managementFeeAmount: 2917047.6,
      netProfit: 11786716,
      mitraShare: 11786716
    }
  },
  'd9a2ef93-c298-4501-a471-1c5e2b3dff08': {
    name: 'MITRA CICURUG',
    pos: { revenue: 117452508, cogs: 76924760, deductions: 0 },
    foodApps: { revenue: 12381000, cogs: 5553405, deductions: 1392775 },
    tiktok: { revenue: 10627270, cogs: 8830105, deductions: 0 },
    totals: {
      grossRevenue: 140460778,
      totalDeductions: 1392775,
      netRevenue: 139068003,
      totalCogs: 91308270,
      grossProfit: 47759733,
      totalWaste: 2720600,
      totalOpex: 18884964.4,
      managementFeePct: 3,
      managementFeeAmount: 4213823.34,
      netProfit: 21940345.26,
      mitraShare: 21940345.26
    }
  },
  '550e8400-e29b-41d4-a716-446655440003': {
    name: 'MITRA PALEDANG',
    pos: { revenue: 26380858, cogs: 17319060, deductions: 0 },
    foodApps: { revenue: 41032000, cogs: 19862645, deductions: 6084038 },
    tiktok: { revenue: 2425094, cogs: 1987096, deductions: 38000 },
    totals: {
      grossRevenue: 69837952,
      totalDeductions: 6122038,
      netRevenue: 63715914,
      totalCogs: 39168801,
      grossProfit: 24547113,
      totalWaste: 489100,
      totalOpex: 14312547.4,
      managementFeePct: 3,
      managementFeeAmount: 2095138.56,
      netProfit: 7650327.04,
      mitraShare: 7650327.04
    }
  },
  '62a56103-2085-4dd5-9d25-a3c0cffc88ff': {
    name: 'MITRA CILEUNGSI',
    pos: { revenue: 157918050, cogs: 103425740, deductions: 0 },
    foodApps: { revenue: 3478000, cogs: 1874400, deductions: 0 },
    tiktok: { revenue: 23572000, cogs: 19569184, deductions: 0 },
    totals: {
      grossRevenue: 184968050,
      totalDeductions: 0,
      netRevenue: 184968050,
      totalCogs: 124869324,
      grossProfit: 60098726,
      totalWaste: 1421000,
      totalOpex: 23112776.4,
      managementFeePct: 3,
      managementFeeAmount: 5549041.5,
      netProfit: 30015908.1,
      mitraShare: 30015908.1
    }
  },
};

export function getMitraAugustClosing(outletId: string): MitraMonthlyClosingOutlet | undefined {
  return MITRA_CLOSING_DATA_AUGUST_2026[outletId];
}

export function isAugust2026Period(from: string, to: string): boolean {
  return from === '2026-08-01' && to === '2026-08-31';
}

/* ── September 2026 ─────────────────────────────────────────────────────────
 *
 * Angka closing resmi September 2026. Sumber kebenaran tunggal = laporan closing
 * owner "SS LAP. LABA RUGI 2026", sheet "MITRA SEPTEMBER 2026" (ditetapkan 12 Okt 2026).
 *
 * Angka di bawah TIDAK dihitung dari data transaksi dan memang tidak sama dengan
 * hitungan live — itu bukan bug, jangan "diperbaiki" agar cocok. Data transaksi
 * di DB tidak diubah.
 *
 * Pemetaan sheet → struktur di bawah:
 *   - pos       = "TRANSAKSI OUTLET" + "TRANSAKSI WEBSITE SS" (dashboard hanya punya 3 kanal)
 *   - deductions foodApps = "ADMIN FEE"; tiktok = "ADMIN FEE (COM & CREATORS)"
 *   - grossRevenue memakai revenue kotor TikTok; "TOTAL REVENUE" di sheet memakai
 *     settlement (revenue − admin fee). Laba bersihnya sama.
 *
 * Isi blok ini dibangkitkan skrip dari sel Excel, bukan diketik tangan.
 */
export const MITRA_CLOSING_DATA_SEPTEMBER_2026: Record<string, MitraMonthlyClosingOutlet> = {
  '550e8400-e29b-41d4-a716-446655440014': {
    name: 'MITRA CIBINONG',
    pos: { revenue: 38637280, cogs: 23817843, deductions: 0 },
    foodApps: { revenue: 78164000, cogs: 38902964, deductions: 22086848 },
    tiktok: { revenue: 11257000, cogs: 8214997, deductions: 1032620 },
    totals: {
      grossRevenue: 128058280,
      totalDeductions: 23119468,
      netRevenue: 104938812,
      totalCogs: 70935804,
      grossProfit: 34003008,
      totalWaste: 568216,
      totalOpex: 14425221,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 19009571,
      mitraShare: 9504785.5,
      profitSharingPct: 50
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 2707700, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 8714714, source: 'monthly' },
      { label: 'Bonus Crew', amount: 311927, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 107500, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Lembur', amount: 200000, source: 'petty_cash' },
      { label: 'Ads', amount: 388500, source: 'monthly' },
      { label: 'Endorsement', amount: 500000, source: 'monthly' },
      { label: 'Promo', amount: 235400, source: 'monthly' },
      { label: 'PLN', amount: 870406, source: 'monthly' },
      { label: 'Internet', amount: 260850, source: 'monthly' },
    ]
  },
  '550e8400-e29b-41d4-a716-446655440017': {
    name: 'MITRA CISEENG',
    pos: { revenue: 13735552, cogs: 8685630, deductions: 0 },
    foodApps: { revenue: 26486000, cogs: 13006085, deductions: 6510274 },
    tiktok: { revenue: 8638000, cogs: 6344925, deductions: 796440 },
    totals: {
      grossRevenue: 48859552,
      totalDeductions: 7306714,
      netRevenue: 41552838,
      totalCogs: 28036640,
      grossProfit: 13516198,
      totalWaste: 243945,
      totalOpex: 11261845,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 2010408,
      mitraShare: 2010408,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 1858000, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 6127714, source: 'monthly' },
      { label: 'Bonus Crew', amount: 135866, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 107500, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Endorsement', amount: 335000, source: 'monthly' },
      { label: 'Promo', amount: 87268, source: 'monthly' },
      { label: 'PDAM', amount: 5000, source: 'monthly' },
      { label: 'Internet', amount: 392940, source: 'monthly' },
      { label: 'Biaya Sewa Outlet', amount: 2084333, source: 'monthly' },
    ]
  },
  '550e8400-e29b-41d4-a716-446655440018': {
    name: 'MITRA PEKAYON',
    pos: { revenue: 15070000, cogs: 9304963, deductions: 0 },
    foodApps: { revenue: 36930000, cogs: 18197182, deductions: 10479489 },
    tiktok: { revenue: 6310000, cogs: 4591151, deductions: 596750 },
    totals: {
      grossRevenue: 58310000,
      totalDeductions: 11076239,
      netRevenue: 47233761,
      totalCogs: 32093296,
      grossProfit: 15140465,
      totalWaste: 163846,
      totalOpex: 12641679,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 2334940,
      mitraShare: 2334940,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 2875108, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 6392713, source: 'monthly' },
      { label: 'Bonus Crew', amount: 154200, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 70550, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Endorsement', amount: 500000, source: 'monthly' },
      { label: 'Promo', amount: 169034, source: 'monthly' },
      { label: 'PDAM', amount: 133000, source: 'monthly' },
      { label: 'PLN', amount: 208000, source: 'monthly' },
      { label: 'Internet', amount: 260850, source: 'monthly' },
      { label: 'Biaya Sewa Outlet', amount: 1750000, source: 'monthly' },
    ]
  },
  '550e8400-e29b-41d4-a716-446655440019': {
    name: 'MITRA KALISARI',
    pos: { revenue: 10368396, cogs: 6461144, deductions: 0 },
    foodApps: { revenue: 26983000, cogs: 13406059, deductions: 7343136 },
    tiktok: { revenue: 2971000, cogs: 2147893, deductions: 267270 },
    totals: {
      grossRevenue: 40322396,
      totalDeductions: 7610406,
      netRevenue: 32711990,
      totalCogs: 22015096,
      grossProfit: 10696894,
      totalWaste: 263850,
      totalOpex: 9883860,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 549184,
      mitraShare: 549184,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 1360000, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 6227714, source: 'monthly' },
      { label: 'Bonus Crew', amount: 119817, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 124987, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Lembur', amount: 150000, source: 'petty_cash' },
      { label: 'Endorsement', amount: 1135000, source: 'monthly' },
      { label: 'Promo', amount: 254468, source: 'monthly' },
      { label: 'PDAM', amount: 21000, source: 'monthly' },
      { label: 'PLN', amount: 101800, source: 'monthly' },
      { label: 'Internet', amount: 260850, source: 'monthly' },
    ]
  },
  '5a4df577-5237-476e-b54c-9eb642a5a516': {
    name: 'MITRA SAWANGAN DTC',
    pos: { revenue: 5764000, cogs: 3484939, deductions: 0 },
    foodApps: { revenue: 3541000, cogs: 1732789, deductions: 779391 },
    tiktok: { revenue: 0, cogs: 0, deductions: 0 },
    totals: {
      grossRevenue: 9305000,
      totalDeductions: 779391,
      netRevenue: 8525609,
      totalCogs: 5217728,
      grossProfit: 3307881,
      totalWaste: 59682,
      totalOpex: 4330272,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: -1082073,
      mitraShare: -1082073,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Gaji Crew Outlet', amount: 3937714, source: 'monthly' },
      { label: 'Bonus Crew', amount: 112484, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 151850, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
    ]
  },
  '43b7bbd1-1fd4-44b5-87ca-b07a271151af': {
    name: 'MITRA SENTUL',
    pos: { revenue: 29525000, cogs: 18202633, deductions: 0 },
    foodApps: { revenue: 27927000, cogs: 14035078, deductions: 6930915 },
    tiktok: { revenue: 7526000, cogs: 5480008, deductions: 738880 },
    totals: {
      grossRevenue: 64978000,
      totalDeductions: 7669795,
      netRevenue: 57308205,
      totalCogs: 37717719,
      grossProfit: 19590486,
      totalWaste: 395964,
      totalOpex: 13813889,
      managementFeePct: 3,
      managementFeeAmount: 1927173.6,
      netProfit: 3453459.4,
      mitraShare: 3453459.4,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 1952750, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 8717716, source: 'monthly' },
      { label: 'Bonus Crew', amount: 206249, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 107500, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Lembur', amount: 200000, source: 'petty_cash' },
      { label: 'Ads', amount: 777000, source: 'monthly' },
      { label: 'Endorsement', amount: 125000, source: 'monthly' },
      { label: 'Promo', amount: 83600, source: 'monthly' },
      { label: 'PDAM', amount: 5000, source: 'monthly' },
      { label: 'Internet', amount: 260850, source: 'monthly' },
      { label: 'Biaya Sewa Outlet', amount: 1250000, source: 'monthly' },
    ]
  },
  '3f38c41d-11e3-49ce-a189-d7303e45f9ad': {
    name: 'MITRA CIBUBUR',
    pos: { revenue: 37960924, cogs: 23322957, deductions: 0 },
    foodApps: { revenue: 19101000, cogs: 9480044, deductions: 4336650 },
    tiktok: { revenue: 15076000, cogs: 10966879, deductions: 1384680 },
    totals: {
      grossRevenue: 72137924,
      totalDeductions: 5721330,
      netRevenue: 66416594,
      totalCogs: 43769880,
      grossProfit: 22646714,
      totalWaste: 954494,
      totalOpex: 10246602,
      managementFeePct: 3,
      managementFeeAmount: 2122597.32,
      netProfit: 9323020.68,
      mitraShare: 9323020.68,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 1972650, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 6477717, source: 'monthly' },
      { label: 'Bonus Crew', amount: 201684, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 124988, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Endorsement', amount: 375000, source: 'monthly' },
      { label: 'Promo', amount: 169034, source: 'monthly' },
      { label: 'PDAM', amount: 201200, source: 'monthly' },
      { label: 'PLN', amount: 401855, source: 'monthly' },
      { label: 'Internet', amount: 194250, source: 'monthly' },
    ]
  },
  'd9a2ef93-c298-4501-a471-1c5e2b3dff08': {
    name: 'MITRA CICURUG',
    pos: { revenue: 69157764, cogs: 42780251, deductions: 0 },
    foodApps: { revenue: 44801000, cogs: 22522495, deductions: 11879173 },
    tiktok: { revenue: 18916000, cogs: 13750090, deductions: 1773230 },
    totals: {
      grossRevenue: 132874764,
      totalDeductions: 13652403,
      netRevenue: 119222361,
      totalCogs: 79052836,
      grossProfit: 40169525,
      totalWaste: 231780,
      totalOpex: 17360007,
      managementFeePct: 3,
      managementFeeAmount: 3933046.02,
      netProfit: 18644691.98,
      mitraShare: 18644691.98,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 3685000, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 9154252, source: 'monthly' },
      { label: 'Bonus Crew', amount: 404101, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 175680, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Lembur', amount: 350000, source: 'petty_cash' },
      { label: 'Endorsement', amount: 274000, source: 'monthly' },
      { label: 'Promo', amount: 41800, source: 'monthly' },
      { label: 'PLN', amount: 153000, source: 'monthly' },
      { label: 'Internet', amount: 493950, source: 'monthly' },
      { label: 'Biaya Sewa Outlet', amount: 2500000, source: 'monthly' },
    ]
  },
  '550e8400-e29b-41d4-a716-446655440003': {
    name: 'MITRA PALEDANG',
    pos: { revenue: 15072348, cogs: 9229317, deductions: 0 },
    foodApps: { revenue: 29858000, cogs: 15213371, deductions: 8918730 },
    tiktok: { revenue: 2343000, cogs: 1676094, deductions: 204140 },
    totals: {
      grossRevenue: 47273348,
      totalDeductions: 9122870,
      netRevenue: 38150478,
      totalCogs: 26118782,
      grossProfit: 12031696,
      totalWaste: 11000,
      totalOpex: 9309065,
      managementFeePct: 0,
      managementFeeAmount: 0,
      netProfit: 2711631,
      mitraShare: 2711631,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 1207200, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 5128484, source: 'monthly' },
      { label: 'Bonus Crew', amount: 134700, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 175680, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Lembur', amount: 100000, source: 'petty_cash' },
      { label: 'Endorsement', amount: 100000, source: 'monthly' },
      { label: 'Promo', amount: 41800, source: 'monthly' },
      { label: 'PDAM', amount: 147900, source: 'monthly' },
      { label: 'Internet', amount: 478410, source: 'monthly' },
      { label: 'Biaya Sewa Outlet', amount: 1666667, source: 'monthly' },
    ]
  },
  'bba67dba-2dca-4e98-bdb2-6a9e265e288c': {
    name: 'MITRA PAMULANG',
    pos: { revenue: 38371734, cogs: 23584284, deductions: 0 },
    foodApps: { revenue: 18703000, cogs: 9148126, deductions: 4780955 },
    tiktok: { revenue: 10136000, cogs: 7368258, deductions: 975130 },
    totals: {
      grossRevenue: 67210734,
      totalDeductions: 5756085,
      netRevenue: 61454649,
      totalCogs: 40100668,
      grossProfit: 21353981,
      totalWaste: 793658,
      totalOpex: 8300796,
      managementFeePct: 3,
      managementFeeAmount: 1987068.12,
      netProfit: 10272458.88,
      mitraShare: 10272458.88,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Gaji Crew Outlet', amount: 5183406, source: 'monthly' },
      { label: 'Bonus Crew', amount: 87316, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 151850, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Biaya Sewa Outlet', amount: 2750000, source: 'monthly' },
    ]
  },
  '62a56103-2085-4dd5-9d25-a3c0cffc88ff': {
    name: 'MITRA CILEUNGSI',
    pos: { revenue: 161491880, cogs: 100355993, deductions: 0 },
    foodApps: { revenue: 8930000, cogs: 4428909, deductions: 1995750 },
    tiktok: { revenue: 49110000, cogs: 35226071, deductions: 4588650 },
    totals: {
      grossRevenue: 219531880,
      totalDeductions: 6584400,
      netRevenue: 212947480,
      totalCogs: 140010973,
      grossProfit: 72936507,
      totalWaste: 1970370,
      totalOpex: 19218002,
      managementFeePct: 3,
      managementFeeAmount: 6448296.9,
      netProfit: 45299838.1,
      mitraShare: 45299838.1,
      profitSharingPct: 100
    },
    opexLines: [
      { label: 'Pengeluaran Outlet', amount: 5158911, source: 'petty_cash' },
      { label: 'Gaji Crew Outlet', amount: 11697791, source: 'monthly' },
      { label: 'Bonus Crew', amount: 652896, source: 'monthly' },
      { label: 'Bonus Area Manager', amount: 124988, source: 'monthly' },
      { label: 'Bonus Regional Manager', amount: 128224, source: 'monthly' },
      { label: 'Lembur', amount: 500000, source: 'petty_cash' },
      { label: 'Endorsement', amount: 600000, source: 'monthly' },
      { label: 'Promo', amount: 83600, source: 'monthly' },
      { label: 'Internet', amount: 271592, source: 'monthly' },
    ]
  },
}

export interface MitraClosingMonth {
  label: string
  from: string
  to: string
  /**
   * `false` (Agustus): perilaku lama — closing menimpa omzet/HPP/opex/laba, tetapi
   * persen fee, persen bagi hasil dan rincian OPEX tetap dari hitungan live, dan
   * cukup satu outlet punya closing agar berlaku.
   * `true` (September): closing menggantikan SELURUH hitungan, dan hanya berlaku
   * bila semua outlet yang diminta tercakup (lihat `isClosingBerlaku`).
   */
  terapkanPenuh: boolean
  data: Record<string, MitraMonthlyClosingOutlet>
}

const MITRA_CLOSING_MONTHS: MitraClosingMonth[] = [
  { label: 'Agustus 2026', from: '2026-08-01', to: '2026-08-31', terapkanPenuh: false, data: MITRA_CLOSING_DATA_AUGUST_2026 },
  { label: 'September 2026', from: '2026-09-01', to: '2026-09-30', terapkanPenuh: true, data: MITRA_CLOSING_DATA_SEPTEMBER_2026 },
]

/** Bulan closing untuk rentang tanggal — hanya cocok bila rentangnya tepat satu bulan penuh. */
export function getMitraClosingMonth(from: string, to: string): MitraClosingMonth | undefined {
  return MITRA_CLOSING_MONTHS.find(m => m.from === from && m.to === to)
}

export function getMitraClosing(outletId: string, from: string, to: string): MitraMonthlyClosingOutlet | undefined {
  return getMitraClosingMonth(from, to)?.data[outletId]
}

/**
 * Apakah closing bulan itu boleh menimpa hitungan live untuk daftar outlet ini.
 *
 * Bulan `terapkanPenuh`: semua outlet harus punya closing, kecuali outlet yang
 * memang tidak berjualan di periode itu (nilainya dianggap nol). Tanpa syarat
 * ini tampilan gabungan akan mencampur outlet ber-closing dengan outlet live
 * dan totalnya tidak menggambarkan keduanya.
 */
export function isClosingBerlaku(
  bulan: MitraClosingMonth | undefined,
  outletIds: string[],
  adaPenjualan: (outletId: string) => boolean
): boolean {
  if (!bulan) return false
  const adaClosing = outletIds.some(oid => bulan.data[oid] !== undefined)
  if (!adaClosing) return false
  if (!bulan.terapkanPenuh) return true
  return outletIds.every(oid => bulan.data[oid] !== undefined || !adaPenjualan(oid))
}

export interface SegmenPeriode {
  from: string
  to: string
  /** Terisi bila segmen ini adalah bulan closing penuh. */
  closing?: MitraClosingMonth
}

function geserHari(tanggal: string, hari: number): string {
  const d = new Date(`${tanggal}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + hari)
  return d.toISOString().slice(0, 10)
}

/**
 * Bulan closing penuh (`terapkanPenuh`) tidak boleh dipotong: rentang apa pun yang
 * menyentuhnya disajikan dengan bulan itu SEUTUHNYA, ditambah hari-hari di luar
 * bulan itu apa adanya. Tanpa aturan ini, memilih "7 hari" di dalam September
 * memunculkan hitungan live yang berbeda dari laporan closing bulan yang sama.
 *
 * Mengembalikan `undefined` bila rentang tidak menyentuh bulan closing penuh mana pun.
 */
export function rencanaPeriodeClosing(
  from: string,
  to: string
): { from: string; to: string; segmen: SegmenPeriode[] } | undefined {
  if (!from || !to || from > to) return undefined
  const bulan = MITRA_CLOSING_MONTHS
    .filter(m => m.terapkanPenuh && m.from <= to && m.to >= from)
    .sort((a, b) => a.from.localeCompare(b.from))
  if (bulan.length === 0) return undefined

  const segmen: SegmenPeriode[] = []
  let kursor = from
  for (const m of bulan) {
    if (kursor < m.from) segmen.push({ from: kursor, to: geserHari(m.from, -1) })
    segmen.push({ from: m.from, to: m.to, closing: m })
    kursor = geserHari(m.to, 1)
  }
  if (kursor <= to) segmen.push({ from: kursor, to })

  const akhir = bulan[bulan.length - 1].to
  return { from: from < bulan[0].from ? from : bulan[0].from, to: to > akhir ? to : akhir, segmen }
}
