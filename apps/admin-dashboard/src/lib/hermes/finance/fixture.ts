// Konteks finance palsu untuk test (registry/gerbang §6). Tanpa data pribadi.
// Sengaja memuat description & receipt_url di baris pengeluaran: gerbang §6 membuktikan
// keduanya TIDAK sampai ke keluaran alat.
import type { KonteksFinance } from './tipe'

export const financePalsu: KonteksFinance = {
  hariIni: '2026-10-07',
  outlets: async () => [
    { id: 'o1', name: 'SUKA SHAWARMA EMPANG', type: 'internal' },
    { id: 'o2', name: 'MITRA CIBINONG', type: 'mitra' },
  ],
  purchaseOrders: async () => [
    { nomorPo: 'SPB/PO/X/2026/001', supplier: 'Altindo', tanggalPo: '2026-09-20', status: 'diterima_lengkap', nilaiPesan: 1_000_000, nilaiTerima: 950_000, jatuhTempo: '2026-10-05', statusBayar: 'unpaid' },
    { nomorPo: 'SPB/PO/X/2026/002', supplier: 'Silaris', tanggalPo: '2026-10-01', status: 'dikirim_ke_supplier', nilaiPesan: 500_000, nilaiTerima: 0, jatuhTempo: null, statusBayar: 'unpaid' },
  ],
  pengeluaran: async () => [
    { id: 'e1', outlet_id: 'o1', outlet_name: 'SUKA SHAWARMA EMPANG', category: 'bahan_baku' as any, scope: 'outlet', amount: 120_000, description: 'beli bawang', expense_date: '2026-10-02', period_month: '2026-10-01', source: 'petty_cash', receipt_url: 'https://contoh/nota.jpg' },
    { id: 'e2', outlet_id: null, outlet_name: 'Kantor Pusat', category: 'pengeluaran_global' as any, scope: 'pusat', amount: 900_000, description: 'sewa kantor', expense_date: '2026-10-01', period_month: '2026-10-01', source: 'monthly' },
  ],
  setoran: async () => [
    { outletId: 'o2', nominal: 430_000, tanggalJual: '2026-10-01', occurredAt: '2026-10-07T03:00:00Z', jenis: 'Setoran Bank' },
  ],
  shift: async () => [
    { outletId: 'o1', mulai: '2026-10-06T02:00:00Z', status: 'closed', seharusnya: 1_500_000, fisik: 1_480_000, selisih: -20_000, kasir: 'Andi' },
    { outletId: 'o2', mulai: '2026-10-05T02:00:00Z', status: 'open', seharusnya: 0, fisik: 0, selisih: 0, kasir: 'Budi' },
  ],
}
