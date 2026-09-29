'use client'

import Link from 'next/link'
import { ArrowRight, Wrench } from 'lucide-react'
import { usePengingatAset } from '@/hooks/usePengingatAset'

/** Kartu ringkas di Ringkasan HR — tampil hanya bila ada aset perlu tindakan. */
export function PengingatAsetAlert() {
  const { ringkasan, isLoading, error } = usePengingatAset()
  const total = ringkasan.perluTindakan.length
  if (isLoading || error || total === 0) return null
  const { rusak, lewat_umur, perbaikan, segera } = ringkasan.hitung
  const bagian = [
    rusak && `${rusak} rusak`,
    perbaikan && `${perbaikan} perlu perbaikan`,
    lewat_umur && `${lewat_umur} lewat umur pakai`,
    segera && `${segera} segera habis umur`,
  ].filter(Boolean)

  return (
    <div className="space-y-2.5 rounded-2xl border-2 border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-4.5 shadow-xs">
      <div className="flex items-center gap-2 text-sm font-extrabold text-rose-900">
        <Wrench className="h-5 w-5 text-rose-600" />
        <span>Aset Outlet Perlu Tindak Lanjut</span>
      </div>
      <p className="text-xs font-medium leading-relaxed text-rose-800">
        <strong>{total} barang</strong> di outlet perlu ditindaklanjuti: {bagian.join(', ')}.
      </p>
      <Link href="/inventaris/pengingat" className="inline-flex items-center gap-1.5 rounded-xl bg-rose-200/80 px-3 py-1.5 text-xs font-black text-rose-900 transition-all hover:bg-rose-200">
        <span>Lihat pengingat aset</span>
        <ArrowRight size={13} />
      </Link>
    </div>
  )
}
