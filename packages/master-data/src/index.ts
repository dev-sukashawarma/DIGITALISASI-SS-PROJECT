// @suka/master-data — layar Master Bahan Baku, Katalog Vendor & Master Supplier yang dipakai
// admin-dashboard DAN finance. Satu kode, dua tempat: jangan menyalin layar ini ke app mana pun.
// Semua tulis lewat RPC (_peran_master di DB); role hanya menyembunyikan tombol.

export { MasterDataProvider, peranDariStaff, useRole as useMasterDataRole, type RuteMasterData } from './peran'
export { MasterBahanPage } from './components/master-bahan/MasterBahanPage'
export { KatalogVendorBoard } from './components/katalog-vendor/KatalogVendorBoard'
export { HalamanSupplier } from './components/supplier/HalamanSupplier'
export {
  useSuppliers, useBahanBakuOptions, useCreateSupplier, useUpdateSupplier, useDeleteSupplier,
  type Supplier, type BahanBakuOption,
} from './hooks/supplier'
export * from './lib/bahanBaku'
