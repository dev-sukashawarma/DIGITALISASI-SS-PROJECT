// Satu sumber aturan tampil-tidaknya menu stok per role. Dipakai sidebar
// (AppSidebar) DAN tab dashboard monitoring (SPVTabs) — sebelumnya tab
// dashboard tak mengecek role sama sekali, sehingga leader melihat tab
// Approval Permintaan, Plafon & Belanja, Approval Waste, dan Penerimaan PO
// yang di sidebar sudah disembunyikan darinya.
//
// Ini hanya menentukan TAMPILAN. Otorisasi sebenarnya tetap wajib di Server
// Action / RPC (lihat approver.ts & outletAccess.ts).

type Role = string | null | undefined

const has = (list: readonly string[], role: Role) => !!role && list.includes(role)

const PENERIMA_PO = ['kitchen', 'purchasing', 'admin', 'owner', 'admin_finance', 'developer'] as const
// Leader SENGAJA tidak termasuk (keputusan owner 2026-09-22): harga beli
// bahan baku bukan urusan leader outlet.
const PEMBACA_HARGA_VENDOR = [
  'kitchen', 'purchasing', 'admin_finance', 'admin', 'owner', 'spv', 'regional_manager', 'area_manager', 'developer',
] as const
const PENYETUJU_WASTE = ['area_manager', 'regional_manager', 'admin', 'kitchen', 'developer'] as const
const PEMBACA_PENJUALAN = ['kitchen', 'admin', 'owner', 'admin_finance', 'developer', 'purchasing'] as const

export const canReceivePO = (role: Role) => has(PENERIMA_PO, role)
export const canViewVendorPrices = (role: Role) => has(PEMBACA_HARGA_VENDOR, role)
export const canApproveWaste = (role: Role) => has(PENYETUJU_WASTE, role)
// Tab waste di dashboard: penyetuju melihat antrean approval; leader melihat
// daftar (Riwayat Waste, di-scope ke outlet binaannya) tanpa bisa approve —
// approve/reject ditolak di server (requireApproverIdentity, actions/waste.ts).
export const canViewWasteList = (role: Role) => canApproveWaste(role) || role === 'leader'
export const canViewSales = (role: Role) => has(PEMBACA_PENJUALAN, role)
// Plafon & Belanja Outlet ikut grup Laporan Penjualan di sidebar.
export const canViewBudgetOutlet = canViewSales
