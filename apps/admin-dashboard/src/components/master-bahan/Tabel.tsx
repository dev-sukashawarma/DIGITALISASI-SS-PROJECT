'use client'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

/**
 * Primitif tabel bersama untuk keempat tab Master Bahan Baku, supaya jarak sel,
 * kepala kolom, perataan angka, dan lencana seragam di semua tab.
 */

type Rata = 'kiri' | 'kanan' | 'tengah'
const RATA: Record<Rata, string> = { kiri: 'text-left', kanan: 'text-right', tengah: 'text-center' }

/** Wadah tabel: bergulir sendiri, kepala kolom menempel di atas. */
export function Tabel({
  children, lebarMin = 760, bergulir = true,
}: { children: ReactNode; lebarMin?: number; bergulir?: boolean }) {
  return (
    <div className={`overflow-auto rounded-xl border border-stone-200 bg-white ${bergulir ? 'max-h-[calc(100vh-17rem)]' : ''}`}>
      <table className="w-full table-fixed border-collapse text-sm" style={{ minWidth: lebarMin }}>
        {children}
      </table>
    </div>
  )
}

/** Lebar kolom; dipakai berurutan di dalam <Tabel>. Nilai CSS, mis. '28%' atau '7rem'. */
export function LebarKolom({ lebar }: { lebar: string[] }) {
  return (
    <colgroup>
      {lebar.map((l, i) => <col key={i} style={{ width: l }} />)}
    </colgroup>
  )
}

export function KepalaTabel({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 z-10 bg-stone-50 text-[11px] font-semibold uppercase tracking-wide text-stone-500 shadow-[inset_0_-1px_0_#e7e5e4]">
      <tr>{children}</tr>
    </thead>
  )
}

export function Th({ children, rata = 'kiri' }: { children?: ReactNode; rata?: Rata }) {
  return <th scope="col" className={`px-3 py-2.5 font-semibold ${RATA[rata]}`}>{children}</th>
}

export function BarisTabel({
  children, onKlik, redup = false, sorot = false,
}: { children: ReactNode; onKlik?: () => void; redup?: boolean; sorot?: boolean }) {
  return (
    <tr
      onClick={onKlik}
      className={`border-b border-stone-100 last:border-0 transition-colors hover:bg-orange-50/50 ${
        onKlik ? 'cursor-pointer' : ''} ${redup ? 'text-stone-500' : ''} ${sorot ? 'bg-amber-50/50' : ''}`}
    >
      {children}
    </tr>
  )
}

/** `angka` = rata kanan, digit sejajar, tanpa patah baris. */
export function Td({
  children, rata = 'kiri', angka = false, className = '',
}: { children?: ReactNode; rata?: Rata; angka?: boolean; className?: string }) {
  const r = angka ? 'kanan' : rata
  return (
    <td className={`px-3 py-2.5 align-middle ${RATA[r]} ${angka ? 'whitespace-nowrap tabular-nums' : ''} ${className}`}>
      {children}
    </td>
  )
}

export function BarisKosong({ kolom, pesan }: { kolom: number; pesan: string }) {
  return (
    <tr>
      <td colSpan={kolom} className="px-3 py-10 text-center text-sm text-stone-500">{pesan}</td>
    </tr>
  )
}

/** Nilai kosong yang konsisten di semua tab. */
export function Kosong() {
  return <span className="text-stone-300">—</span>
}

type Nada = 'netral' | 'hijau' | 'kuning' | 'biru' | 'abu' | 'oranye'
const NADA: Record<Nada, string> = {
  netral: 'bg-stone-100 text-stone-600',
  hijau: 'bg-emerald-50 text-emerald-700 ring-emerald-600/15',
  kuning: 'bg-amber-50 text-amber-800 ring-amber-600/20',
  biru: 'bg-sky-50 text-sky-700 ring-sky-600/15',
  abu: 'bg-stone-50 text-stone-500 ring-stone-400/20',
  oranye: 'bg-orange-50 text-orange-700 ring-orange-600/15',
}

export function Lencana({ children, nada = 'netral' }: { children: ReactNode; nada?: Nada }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ring-transparent ${NADA[nada]}`}>
      {children}
    </span>
  )
}

export function KolomCari({
  nilai, onUbah, placeholder,
}: { nilai: string; onUbah: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
      <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full rounded-xl border border-stone-200 bg-stone-50/60 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-suka-orange focus:bg-white"
      />
    </div>
  )
}

/** "Menampilkan 12 dari 48 bahan" — memberi tahu bahwa saringan sedang aktif. */
export function InfoJumlah({ tampil, total, satuan }: { tampil: number; total: number; satuan: string }) {
  return (
    <p className="text-xs text-stone-500">
      {tampil === total ? `${total} ${satuan}` : `Menampilkan ${tampil} dari ${total} ${satuan}`}
    </p>
  )
}
