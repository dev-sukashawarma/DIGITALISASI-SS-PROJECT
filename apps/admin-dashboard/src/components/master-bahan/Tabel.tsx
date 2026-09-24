'use client'
import type { ReactNode } from 'react'
import { Search } from 'lucide-react'

/**
 * Primitif tabel bersama untuk keempat tab Master Bahan Baku.
 * Gaya data-dense: baris rapat, pemisah kolom tipis, angka monospace sejajar,
 * kepala kolom menempel — dipakai berjam-jam oleh admin & purchasing.
 */

type Rata = 'kiri' | 'kanan' | 'tengah'
const RATA: Record<Rata, string> = { kiri: 'text-left', kanan: 'text-right', tengah: 'text-center' }

/** Wadah tabel: bergulir sendiri, kepala kolom menempel di atas. */
export function Tabel({
  children, lebarMin = 760, bergulir = true,
}: { children: ReactNode; lebarMin?: number; bergulir?: boolean }) {
  return (
    <div className={`overflow-auto rounded-lg border border-stone-200 bg-white ${bergulir ? 'max-h-[calc(100vh-16rem)]' : ''}`}>
      <table className="w-full table-fixed border-collapse text-[13px] leading-5" style={{ minWidth: lebarMin }}>
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
    <thead className="sticky top-0 z-10 bg-stone-100 text-[10.5px] font-bold uppercase tracking-[0.06em] text-stone-500 shadow-[inset_0_-1px_0_#d6d3d1]">
      <tr>{children}</tr>
    </thead>
  )
}

export function Th({ children, rata = 'kiri' }: { children?: ReactNode; rata?: Rata }) {
  return (
    <th scope="col" className={`border-r border-stone-200/80 px-3 py-2 font-bold last:border-r-0 ${RATA[rata]}`}>
      {children}
    </th>
  )
}

export function BarisTabel({
  children, onKlik, redup = false, sorot = false,
}: { children: ReactNode; onKlik?: () => void; redup?: boolean; sorot?: boolean }) {
  return (
    <tr
      onClick={onKlik}
      className={`border-b border-stone-100 last:border-0 transition-colors ${
        sorot ? 'bg-amber-50/70' : 'even:bg-stone-50/60'} hover:bg-orange-50 ${
        onKlik ? 'cursor-pointer' : ''} ${redup ? 'text-stone-500' : 'text-stone-800'}`}
    >
      {children}
    </tr>
  )
}

/** `angka` = rata kanan, monospace, digit sejajar, tanpa patah baris. */
export function Td({
  children, rata = 'kiri', angka = false, className = '',
}: { children?: ReactNode; rata?: Rata; angka?: boolean; className?: string }) {
  const r = angka ? 'kanan' : rata
  return (
    <td className={`border-r border-stone-100 px-3 py-1.5 align-middle last:border-r-0 ${RATA[r]} ${
      angka ? 'whitespace-nowrap font-mono text-[12.5px] tabular-nums' : ''} ${className}`}>
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

export type Nada = 'netral' | 'hijau' | 'kuning' | 'biru' | 'abu' | 'oranye'
const NADA: Record<Nada, string> = {
  netral: 'bg-stone-100 text-stone-700 ring-stone-300/60',
  hijau: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  kuning: 'bg-amber-50 text-amber-900 ring-amber-600/25',
  biru: 'bg-sky-50 text-sky-800 ring-sky-600/20',
  abu: 'bg-stone-50 text-stone-600 ring-stone-400/30',
  oranye: 'bg-orange-50 text-orange-800 ring-orange-600/20',
}

export function Lencana({ children, nada = 'netral' }: { children: ReactNode; nada?: Nada }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-px text-[10.5px] font-semibold ring-1 ring-inset ${NADA[nada]}`}>
      {children}
    </span>
  )
}

const KELAS_KONTROL =
  'h-9 rounded-lg border border-stone-200 bg-white text-sm text-stone-800 outline-none transition-colors hover:border-stone-300 focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/15'

export function KolomCari({
  nilai, onUbah, placeholder,
}: { nilai: string; onUbah: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={`${KELAS_KONTROL} w-full pl-9 pr-3`}
      />
    </div>
  )
}

/** Select ringkas dengan gaya kontrol yang sama dengan kolom cari. */
export function Pilih({
  nilai, onUbah, label, children,
}: { nilai: string; onUbah: (v: string) => void; label: string; children: ReactNode }) {
  return (
    <select value={nilai} onChange={(e) => onUbah(e.target.value)} aria-label={label} className={`${KELAS_KONTROL} px-3`}>
      {children}
    </select>
  )
}

/** Tombol-tombol saringan cepat berdampingan, masing-masing dengan jumlahnya. */
export function FilterCepat<T extends string>({
  pilihan, nilai, onUbah, label,
}: {
  pilihan: { id: T; label: string; jumlah?: number; nada?: 'netral' | 'kuning' }[]
  nilai: T
  onUbah: (v: T) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1">
      {pilihan.map((p) => {
        const aktif = p.id === nilai
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onUbah(p.id)}
            aria-pressed={aktif}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[13px] font-semibold transition-colors ${
              aktif ? 'bg-white text-suka-brown shadow-sm ring-1 ring-stone-200' : 'text-stone-600 hover:text-stone-900'}`}
          >
            {p.label}
            {p.jumlah !== undefined && (
              <span className={`rounded px-1 font-mono text-[11px] tabular-nums ${
                p.nada === 'kuning' && p.jumlah > 0 ? 'bg-amber-100 text-amber-900' : aktif ? 'bg-orange-100 text-orange-900' : 'bg-stone-200/70 text-stone-700'}`}>
                {p.jumlah}
              </span>
            )}
          </button>
        )
      })}
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
