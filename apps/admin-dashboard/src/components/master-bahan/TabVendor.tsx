'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Truck } from 'lucide-react'
import { useRole } from '@/components/layout/RoleContext'
import { useDaftarBahan } from '@/hooks/masterBahan/useDaftarBahan'
import { bolehUbahHarga } from '@/lib/masterBahan/akses'
import { KatalogVendorBoard } from '@/components/katalog-vendor/KatalogVendorBoard'
import { FormHargaVendor } from './FormHargaVendor'
import { Pilih } from './Tabel'

export function TabVendor() {
  const { role } = useRole()
  const bolehHarga = bolehUbahHarga(role)
  const { data: bahan = [] } = useDaftarBahan()
  const aktif = bahan.filter((b) => b.is_active)
  const [pilihBahan, setPilihBahan] = useState('')
  const [buka, setBuka] = useState(false)
  const target = aktif.find((b) => b.id === pilihBahan) ?? null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {bolehHarga ? (
          <div className="flex flex-wrap items-center gap-2">
            <Pilih nilai={pilihBahan} onUbah={setPilihBahan} label="Pilih bahan untuk harga vendor baru">
              <option value="">— pilih bahan —</option>
              {aktif.map((b) => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </Pilih>
            <button onClick={() => setBuka(true)} disabled={!target}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-suka-orange px-3.5 text-sm font-bold text-white shadow-sm hover:brightness-95 disabled:opacity-40">
              <Plus size={16} /> Tambah harga vendor
            </button>
          </div>
        ) : <span className="text-[13px] text-stone-500">Hanya admin, owner, dan purchasing yang bisa mengubah harga vendor.</span>}
        <Link href="/dashboard/pembelian/supplier"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-[13px] font-semibold text-stone-700 hover:border-stone-300 hover:text-suka-brown">
          <Truck size={15} /> Kelola daftar supplier
        </Link>
      </div>
      <KatalogVendorBoard />
      {buka && target && <FormHargaVendor bahan={target} onBatal={() => setBuka(false)} onSelesai={() => setBuka(false)} />}
    </div>
  )
}
