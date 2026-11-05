import { redirect } from 'next/navigation'

// Transaksi Manual dihapus 5 Nov 2026: mutasi per rekening ada di /mutasi,
// transfer antar rekening lewat tombol Transfer di sana.
export default function TransaksiPage() {
  redirect('/mutasi')
}
