'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { bolehUbahHarga } from '@/lib/masterBahan/akses'
import { KatalogVendorBoard } from '@/components/katalog-vendor/KatalogVendorBoard'
import { FormHargaVendor } from './FormHargaVendor'

export function TabVendor() {
  const { role } = useRole()
  const bolehHarga = bolehUbahHarga(role)
  const { data: bahan = [] } = useDaftarBahan()
  const aktif = bahan.filter((b) => b.is_active)
  const [pilihBahan, setPilihBahan] = useState('')
  const [buka, setBuka] = useState(false)
  const target = aktif.find((b) => b.id === pilihBahan) ?? null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        {bolehHarga ? (
          <div className="flex flex-wrap items-center gap-2">
            <select value={pilihBahan} onChange={(e) => setPilihBahan(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm">
              <option value="">— pilih bahan —</option>
              {aktif.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
            <button onClick={() => setBuka(true)} disabled={!target}
              className="flex items-center gap-2 rounded-xl bg-suka-orange px-4 py-2 text-sm font-bold text-white disabled:opacity-40">
              <Plus size={16} /> Tambah harga vendor
            </button>
          </div>
        ) : <span className="text-sm text-gray-500">Hanya admin, owner, dan purchasing yang bisa mengubah harga vendor.</span>}
        <Link href="/dashboard/pembelian/supplier" className="flex items-center gap-2 text-sm font-bold text-suka-orange hover:underline">
          <Truck size={16} /> Kelola daftar supplier
        </Link>
      </div>
      <KatalogVendorBoard />
      {buka && target && <FormHargaVendor bahan={target} onBatal={() => setBuka(false)} onSelesai={() => setBuka(false)} />}
    </div>
  )
}
