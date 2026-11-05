import { redirect } from 'next/navigation'

// Rekening & Kas digabung ke Mutasi Rekening (tombol "Kelola rekening").
export default function LokasiPage() {
  redirect('/mutasi')
}
