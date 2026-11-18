'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Building2, Check, ClipboardCheck, Coins, Copy, ExternalLink, Landmark, PackageX, Receipt, Send, Truck, Wallet, type LucideIcon } from 'lucide-react'
import { rupiah, relativeTime, tanggalWaktu } from '@/lib/format'
import { isLama, JENIS_LABEL, type HubItem, type HubJenis } from '@/lib/approval/hub'

/** Grid kolom baris Hub Approval (dipakai juga oleh header kolom di MenungguPanel). */
export const GRID_BARIS_HUB =
  'lg:grid-cols-[2.25rem_minmax(0,1fr)_8.5rem_8.5rem_6.5rem_minmax(0,1.15fr)_minmax(0,1.2fr)_14rem]'

/** Ikon per jenis, sama dengan menu sidebar asalnya. */
export const IKON_JENIS_HUB: Record<HubJenis, LucideIcon> = {
  petty_cash: Coins,
  pengeluaran_petty_cash: Receipt,
  kasbon: Wallet,
  serah_am: Send,
  po: ClipboardCheck,
  bayar_vendor: Truck,
  dana_kantor: Building2,
  retur_vendor: PackageX,
}

const LABEL_SETUJUI: Record<HubJenis, string> = {
  petty_cash: 'Setujui',
  pengeluaran_petty_cash: 'Setujui',
  kasbon: 'Cairkan',
  serah_am: 'Serahkan ke AM',
  po: 'Setujui',
  bayar_vendor: 'Setujui',
  dana_kantor: 'Verifikasi',
  retur_vendor: 'Setujui',
}

export function BarisHub({
  item,
  now,
  bolehPutuskan,
  onSetujui,
  onTolak,
}: {
  item: HubItem
  now: Date
  bolehPutuskan: boolean
  onSetujui: (i: HubItem) => void
  onTolak: (i: HubItem) => void
}) {
  const [salin, setSalin] = useState(false)
  const lama = isLama(item.menungguSejak, now)
  const bisaTolak = item.jenis !== 'serah_am'
  const Ikon = IKON_JENIS_HUB[item.jenis]

  const salinRekening = () => {
    const no = item.rekeningTujuan?.nomor
    if (!no || typeof navigator === 'undefined' || !navigator.clipboard) return
    void navigator.clipboard.writeText(no).then(() => {
      setSalin(true)
      setTimeout(() => setSalin(false), 1500)
    })
  }

  return (
    <li className={`grid grid-cols-[2.25rem_1fr] gap-x-3 gap-y-2.5 px-4 py-3.5 ${GRID_BARIS_HUB} lg:items-center`}>
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${lama ? 'bg-red-50 text-red-600' : 'bg-suka-orange/10 text-suka-orange'}`}
        aria-hidden="true"
      >
        <Ikon size={17} />
      </span>

      {/* Kolom pengaju / judul */}
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-semibold text-suka-ink">{item.judul}</span>
          {item.detailHref && (
            <Link
              href={item.detailHref}
              className="shrink-0 rounded text-suka-gray-400 hover:text-suka-orange focus-visible:outline-2 focus-visible:outline-suka-orange"
              aria-label={`Lihat detail ${item.judul}`}
            >
              <ExternalLink size={13} />
            </Link>
          )}
        </div>
        {item.jenis === 'pengeluaran_petty_cash' && item.data.receipt_url && (
          <div className="mt-1">
            <a
              href={item.data.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-semibold text-suka-orange hover:underline"
            >
              Lihat struk
              <ExternalLink size={11} />
            </a>
          </div>
        )}
      </div>

      {/* Kolom waktu pengajuan: tanggal & jam + umur */}
      <div className="col-start-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs lg:col-start-auto lg:block">
        <div className="font-medium tabular-nums text-suka-ink">{tanggalWaktu(item.menungguSejak)}</div>
        <div
          data-testid="umur-hub"
          className={lama ? 'font-semibold text-red-600' : 'text-suka-gray-400'}
        >
          {relativeTime(item.menungguSejak)}
        </div>
      </div>

      {/* Kolom outlet */}
      <div className="col-start-2 min-w-0 text-xs font-medium text-suka-gray-700 lg:col-start-auto">
        {item.outlet ? (
          <span className="block truncate" title={item.outlet}>{item.outlet}</span>
        ) : (
          <span className="text-suka-gray-300">-</span>
        )}
      </div>

      {/* Kolom kategori */}
      <div className="col-start-2 lg:col-start-auto">
        <span className="inline-flex items-center rounded-full bg-suka-cream px-2.5 py-0.5 text-xs font-medium text-suka-brown">
          {JENIS_LABEL[item.jenis]}
        </span>
      </div>

      {/* Kolom keterangan */}
      <div className="col-start-2 min-w-0 text-xs text-suka-gray-600 lg:col-start-auto">
        {item.keterangan ? (
          <p className="line-clamp-2" title={item.keterangan}>{item.keterangan}</p>
        ) : (
          <span className="text-suka-gray-300">-</span>
        )}
      </div>

      {/* Kolom rekening tujuan */}
      <div className="col-start-2 min-w-0 lg:col-start-auto">
        {item.rekeningTujuan && (
          <div
            data-testid="rekening-tujuan"
            className="inline-flex max-w-full items-center gap-2 rounded-lg border border-suka-gray-100 bg-suka-cream/40 px-2.5 py-1.5 text-xs text-suka-gray-600"
          >
            <Landmark size={13} className="shrink-0 text-suka-orange" aria-hidden="true" />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-1">
                {item.rekeningTujuan.bank && (
                  <span className="shrink-0 font-medium text-suka-gray-700">{item.rekeningTujuan.bank} ·</span>
                )}
                <span className="font-mono font-semibold text-suka-ink">{item.rekeningTujuan.nomor}</span>
              </div>
              {item.rekeningTujuan.atasNama && (
                <div className="truncate text-[11px] text-suka-gray-500">a.n. {item.rekeningTujuan.atasNama}</div>
              )}
            </div>
            <button
              type="button"
              onClick={salinRekening}
              aria-label={`Salin nomor rekening ${item.rekeningTujuan.nomor}`}
              title="Salin nomor rekening"
              className="ml-0.5 inline-flex shrink-0 items-center gap-0.5 rounded px-1.5 py-1 text-[11px] font-medium text-suka-gray-400 hover:bg-white hover:text-suka-brown focus-visible:outline-2 focus-visible:outline-suka-orange"
            >
              {salin ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
              {salin && <span className="text-emerald-600">Disalin</span>}
            </button>
          </div>
        )}
      </div>

      {/* Nominal + tombol: satu baris di bawah teks pada layar HP, kolom kanan di desktop. */}
      <div className="col-span-2 flex items-center justify-between gap-2.5 lg:col-span-1 lg:justify-end">
        <span className="whitespace-nowrap text-sm font-bold tabular-nums text-suka-ink">
          {rupiah(item.nominal)}
        </span>
        <div className="flex shrink-0 gap-2">
          {bisaTolak && (
            <button
              type="button"
              onClick={() => onTolak(item)}
              disabled={!bolehPutuskan}
              className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Tolak
            </button>
          )}
          <button
            type="button"
            onClick={() => onSetujui(item)}
            disabled={!bolehPutuskan}
            className="rounded-lg bg-suka-brown px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-suka-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-suka-orange disabled:cursor-not-allowed disabled:opacity-40"
          >
            {LABEL_SETUJUI[item.jenis]}
          </button>
        </div>
      </div>
    </li>
  )
}
