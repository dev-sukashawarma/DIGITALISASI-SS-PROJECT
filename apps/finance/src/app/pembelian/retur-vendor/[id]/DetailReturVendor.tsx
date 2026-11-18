'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { ArrowLeft, PackageX } from 'lucide-react'
import { PageHeader } from '@/components/ui'
import { AlasanTolakModal } from '@/components/approval/AlasanTolakModal'
import { useFinanceRole } from '@/hooks/useFinanceRole'
import { useCashOverview } from '@/hooks/useCashData'
import { useDetailReturVendor, useMutasiReturVendor, type ReturVendor } from '@/hooks/useReturVendor'
import {
  aksiTersedia,
  LABEL_ALASAN,
  LABEL_CARA,
  LABEL_STATUS,
  type AksiRetur,
  type CaraPenyelesaian,
} from '@/lib/returVendor/aturan'
import { rupiah, tanggalWaktu } from '@/lib/format'

function pesan(err: unknown, cadangan: string) {
  return err instanceof Error && err.message ? err.message : cadangan
}

type Alasan = 'tolak' | 'batal' | 'tutup_sisa'

const JUDUL_ALASAN: Record<Alasan, string> = {
  tolak: 'Tolak retur',
  batal: 'Batalkan retur',
  tutup_sisa: 'Tutup — sisa tidak dikompensasi',
}

export function DetailReturVendor({ id }: { id: string }) {
  const { role, userId } = useFinanceRole()
  const { data: r, isLoading, error } = useDetailReturVendor(id)
  const m = useMutasiReturVendor()
  const [alasanUntuk, setAlasanUntuk] = useState<Alasan | null>(null)
  const [panel, setPanel] = useState<AksiRetur | null>(null)

  if (isLoading) return <p className="text-sm text-suka-gray-500">Memuat…</p>
  if (error || !r)
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {error ? pesan(error, 'Gagal memuat retur') : 'Retur tidak ditemukan.'}
      </p>
    )

  const aksi = role ? aksiTersedia(r.status, r.cara_penyelesaian, role, r.diajukan_oleh === userId) : []

  const jalankan = async (fn: () => Promise<unknown>, sukses: string) => {
    try {
      await fn()
      toast.success(sukses)
      setPanel(null)
    } catch (err) {
      toast.error(pesan(err, 'Gagal menyimpan'))
    }
  }

  const konfirmasiAlasan = async (alasan: string) => {
    if (alasanUntuk === 'tolak') await jalankan(() => m.putuskan.mutateAsync({ id, setuju: false, alasan }), 'Retur ditolak.')
    if (alasanUntuk === 'batal') await jalankan(() => m.batalkan.mutateAsync({ id, alasan }), 'Retur dibatalkan.')
    if (alasanUntuk === 'tutup_sisa') await jalankan(() => m.tutupSisa.mutateAsync({ id, alasan }), 'Retur ditutup.')
    setAlasanUntuk(null)
  }

  const klik = async (a: AksiRetur) => {
    if (a === 'setujui') {
      if (!confirm(`Setujui retur ${r.nomor}? Barang boleh diserahkan ke vendor.`)) return
      await jalankan(() => m.putuskan.mutateAsync({ id, setuju: true }), 'Retur disetujui.')
    } else if (a === 'tolak' || a === 'batal' || a === 'tutup_sisa') {
      setAlasanUntuk(a)
    } else {
      setPanel(a)
    }
  }

  const LABEL_AKSI: Record<AksiRetur, string> = {
    setujui: 'Setujui',
    tolak: 'Tolak',
    batal: 'Batalkan',
    serahkan: 'Catat serah ke vendor',
    catat_penyelesaian: 'Catat penyelesaian',
    konfirmasi_uang: 'Konfirmasi uang masuk',
    terima_pengganti: 'Terima barang pengganti',
    tutup_sisa: 'Tutup — sisa tidak dikompensasi',
  }

  return (
    <div className="space-y-5 pb-12 font-sans">
      <PageHeader title={`Retur ${r.nomor}`} icon={PackageX} description={`${r.supplier_nama} · ${LABEL_STATUS[r.status]}`}>
        <Link href="/pembelian/retur-vendor" className="inline-flex items-center gap-1 text-sm font-semibold text-suka-brown">
          <ArrowLeft size={16} /> Daftar retur
        </Link>
      </PageHeader>

      <section className="grid gap-3 rounded-2xl border border-suka-gray-100 bg-white p-4 text-sm sm:grid-cols-2">
        <Info label="Alasan" nilai={`${LABEL_ALASAN[r.alasan]}${r.catatan ? ` — ${r.catatan}` : ''}`} />
        <Info label="Nilai retur" nilai={rupiah(r.total)} />
        <Info label="Diajukan" nilai={tanggalWaktu(r.diajukan_at)} />
        {r.diputuskan_at && <Info label={r.status === 'ditolak' ? 'Ditolak' : 'Disetujui'} nilai={`${tanggalWaktu(r.diputuskan_at)}${r.alasan_tolak ? ` — ${r.alasan_tolak}` : ''}`} />}
        {r.dibatalkan_at && <Info label="Dibatalkan" nilai={`${tanggalWaktu(r.dibatalkan_at)} — ${r.alasan_batal ?? ''}`} />}
        {r.diserahkan_at && <Info label="Diserahkan ke vendor" nilai={`${tanggalWaktu(r.diserahkan_at)}${r.penerima_vendor ? ` · diterima ${r.penerima_vendor}` : ''}`} />}
        {r.cara_penyelesaian && <Info label="Penyelesaian" nilai={`${LABEL_CARA[r.cara_penyelesaian]}${r.catatan_penyelesaian ? ` — ${r.catatan_penyelesaian}` : ''}`} />}
        {r.uang_dijanjikan != null && <Info label="Uang dijanjikan / diterima" nilai={`${rupiah(r.uang_dijanjikan)} / ${r.uang_diterima != null ? rupiah(r.uang_diterima) : '—'}`} />}
        {r.nilai_tidak_dikompensasi > 0 && (
          <Info label="Tidak dikompensasi" nilai={`${rupiah(r.nilai_tidak_dikompensasi)}${r.alasan_tutup_sisa ? ` — ${r.alasan_tutup_sisa}` : ''}`} merah />
        )}
        {r.selesai_at && <Info label="Selesai" nilai={tanggalWaktu(r.selesai_at)} />}
      </section>

      <section className="overflow-x-auto rounded-2xl border border-suka-gray-100 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-suka-cream/50 text-left text-xs text-suka-gray-500">
            <tr>
              <th className="px-3 py-2">Bahan</th>
              <th className="px-3 py-2">PO asal</th>
              <th className="px-3 py-2 text-right">Jumlah</th>
              <th className="px-3 py-2 text-right">Harga beli</th>
              <th className="px-3 py-2 text-right">Subtotal</th>
              {r.cara_penyelesaian === 'ganti_barang' && <th className="px-3 py-2 text-right">Pengganti diterima</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-suka-gray-100">
            {r.items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 font-semibold text-suka-ink">
                  {i.bahan_nama}
                  <div className="text-xs font-normal text-suka-gray-500">{LABEL_ALASAN[i.alasan]}</div>
                </td>
                <td className="px-3 py-2">
                  {i.purchase_order_id ? (
                    <Link href={`/pembelian/${i.purchase_order_id}`} className="text-suka-brown underline">
                      {i.nomor_po}
                    </Link>
                  ) : (
                    i.nomor_po ?? '—'
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {i.qty} {i.satuan}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{rupiah(i.harga)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{rupiah(i.subtotal)}</td>
                {r.cara_penyelesaian === 'ganti_barang' && (
                  <td className="px-3 py-2 text-right tabular-nums">
                    {i.qty_pengganti_diterima} / {i.qty} {i.satuan}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {aksi.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {aksi.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => klik(a)}
              className={
                a === 'tolak' || a === 'batal' || a === 'tutup_sisa'
                  ? 'rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50'
                  : 'rounded-xl bg-suka-brown px-4 py-2 text-sm font-semibold text-white hover:bg-suka-ink'
              }
            >
              {LABEL_AKSI[a]}
            </button>
          ))}
        </div>
      )}

      {panel === 'serahkan' && (
        <PanelSerah
          sibuk={m.serahkan.isPending}
          onBatal={() => setPanel(null)}
          onSimpan={(penerima, bukti) => jalankan(() => m.serahkan.mutateAsync({ id, penerima, bukti }), 'Serah ke vendor tercatat. Stok Gudang Pusat berkurang.')}
        />
      )}
      {panel === 'catat_penyelesaian' && (
        <PanelPenyelesaian
          r={r}
          sibuk={m.catatPenyelesaian.isPending}
          onBatal={() => setPanel(null)}
          onSimpan={(v) => jalankan(() => m.catatPenyelesaian.mutateAsync({ id, ...v }), 'Penyelesaian dicatat.')}
        />
      )}
      {panel === 'konfirmasi_uang' && (
        <PanelUang
          r={r}
          sibuk={m.konfirmasiUang.isPending}
          onBatal={() => setPanel(null)}
          onSimpan={(v) => jalankan(() => m.konfirmasiUang.mutateAsync({ id, ...v }), 'Uang masuk dicatat.')}
        />
      )}
      {panel === 'terima_pengganti' && (
        <PanelPengganti
          r={r}
          sibuk={m.terimaPengganti.isPending}
          onBatal={() => setPanel(null)}
          onSimpan={(items) => jalankan(() => m.terimaPengganti.mutateAsync({ id, items }), 'Barang pengganti masuk stok Gudang Pusat.')}
        />
      )}

      <AlasanTolakModal
        isOpen={Boolean(alasanUntuk)}
        judul={alasanUntuk ? JUDUL_ALASAN[alasanUntuk] : ''}
        onClose={() => setAlasanUntuk(null)}
        onKonfirmasi={konfirmasiAlasan}
        isPending={m.putuskan.isPending || m.batalkan.isPending || m.tutupSisa.isPending}
      />
    </div>
  )
}

function Info({ label, nilai, merah = false }: { label: string; nilai: string; merah?: boolean }) {
  return (
    <div>
      <div className="text-xs font-semibold text-suka-gray-500">{label}</div>
      <div className={merah ? 'text-red-700' : 'text-suka-ink'}>{nilai}</div>
    </div>
  )
}

const KOTAK = 'space-y-3 rounded-2xl border border-suka-orange/30 bg-suka-cream/40 p-4 text-sm'
const INPUT = 'mt-1 w-full rounded-xl border border-suka-gray-200 bg-white px-3 py-2 text-sm'

function Tombol({ sibuk, aktif, onBatal, onSimpan }: { sibuk: boolean; aktif: boolean; onBatal: () => void; onSimpan: () => void }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onBatal} className="rounded-xl px-4 py-2 text-sm font-semibold text-suka-gray-600">
        Batal
      </button>
      <button
        type="button"
        disabled={!aktif || sibuk}
        onClick={onSimpan}
        className="rounded-xl bg-suka-brown px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        {sibuk ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  )
}

function PanelSerah({ sibuk, onBatal, onSimpan }: { sibuk: boolean; onBatal: () => void; onSimpan: (penerima: string, bukti: File) => void }) {
  const [penerima, setPenerima] = useState('')
  const [bukti, setBukti] = useState<File | null>(null)
  return (
    <div className={KOTAK}>
      <p className="font-semibold text-suka-brown">Catat serah barang ke vendor — stok Gudang Pusat akan berkurang.</p>
      <label className="block font-semibold text-suka-gray-600">
        Nama penerima di vendor (opsional)
        <input value={penerima} onChange={(e) => setPenerima(e.target.value)} className={INPUT} />
      </label>
      <label className="block font-semibold text-suka-gray-600">
        Bukti serah terima (wajib)
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setBukti(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
      </label>
      <Tombol sibuk={sibuk} aktif={Boolean(bukti)} onBatal={onBatal} onSimpan={() => bukti && onSimpan(penerima, bukti)} />
    </div>
  )
}

function PanelPenyelesaian({
  r,
  sibuk,
  onBatal,
  onSimpan,
}: {
  r: ReturVendor
  sibuk: boolean
  onBatal: () => void
  onSimpan: (v: { cara: CaraPenyelesaian; catatan: string; bukti: File | null; uangDijanjikan?: number }) => void
}) {
  const [cara, setCara] = useState<CaraPenyelesaian | ''>('')
  const [catatan, setCatatan] = useState('')
  const [bukti, setBukti] = useState<File | null>(null)
  const [uang, setUang] = useState(String(Math.round(r.total)))
  const nUang = Number(uang)
  const aktif = Boolean(cara) && (cara !== 'uang_kembali' || nUang > 0)
  return (
    <div className={KOTAK}>
      <p className="font-semibold text-suka-brown">Bagaimana vendor menyelesaikan retur ini?</p>
      <div className="flex flex-wrap gap-3">
        {(['ganti_barang', 'potong_tagihan', 'uang_kembali'] as CaraPenyelesaian[]).map((c) => (
          <label key={c} className="inline-flex items-center gap-2">
            <input type="radio" name="cara" checked={cara === c} onChange={() => setCara(c)} />
            {LABEL_CARA[c]}
          </label>
        ))}
      </div>
      {cara === 'potong_tagihan' && (
        <p className="text-xs text-suka-gray-600">
          Kredit {rupiah(r.total)} masuk ke saldo kredit vendor ini dan bisa dipakai saat mengajukan pembayaran PO berikutnya.
        </p>
      )}
      {cara === 'uang_kembali' && (
        <label className="block font-semibold text-suka-gray-600">
          Uang yang akan dikembalikan vendor (Rp)
          <input inputMode="numeric" value={uang} onChange={(e) => setUang(e.target.value.replace(/\D/g, ''))} className={INPUT} />
        </label>
      )}
      <label className="block font-semibold text-suka-gray-600">
        Catatan kesepakatan
        <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={INPUT} />
      </label>
      <label className="block font-semibold text-suka-gray-600">
        Bukti dari vendor (opsional)
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setBukti(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
      </label>
      <Tombol
        sibuk={sibuk}
        aktif={aktif}
        onBatal={onBatal}
        onSimpan={() => cara && onSimpan({ cara, catatan, bukti, uangDijanjikan: cara === 'uang_kembali' ? nUang : undefined })}
      />
    </div>
  )
}

function PanelUang({
  r,
  sibuk,
  onBatal,
  onSimpan,
}: {
  r: ReturVendor
  sibuk: boolean
  onBatal: () => void
  onSimpan: (v: { cashLocationId: string; jumlah: number; bukti: File; catatan: string }) => void
}) {
  const { locations } = useCashOverview()
  const rekening = useMemo(() => locations.filter((l) => l.grup && l.is_active), [locations])
  const bawaan = rekening.find((l) => l.grup === 'bahan_baku' && l.kind === 'bank')?.id ?? rekening[0]?.id ?? ''
  const [lokasi, setLokasi] = useState('')
  const [jumlah, setJumlah] = useState(String(Math.round(r.uang_dijanjikan ?? r.total)))
  const [bukti, setBukti] = useState<File | null>(null)
  const [catatan, setCatatan] = useState('')
  const lok = lokasi || bawaan
  const n = Number(jumlah)
  return (
    <div className={KOTAK}>
      <p className="font-semibold text-suka-brown">Catat uang kembali dari vendor yang sudah masuk rekening.</p>
      <label className="block font-semibold text-suka-gray-600">
        Rekening tujuan
        <select value={lok} onChange={(e) => setLokasi(e.target.value)} className={INPUT}>
          {rekening.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block font-semibold text-suka-gray-600">
        Jumlah yang benar-benar masuk (Rp)
        <input inputMode="numeric" value={jumlah} onChange={(e) => setJumlah(e.target.value.replace(/\D/g, ''))} className={INPUT} />
      </label>
      {n > 0 && n < r.total && (
        <p className="text-xs text-red-600">Selisih {rupiah(r.total - n)} akan dicatat sebagai tidak dikompensasi.</p>
      )}
      <label className="block font-semibold text-suka-gray-600">
        Bukti transfer (wajib)
        <input type="file" accept="image/*,application/pdf" onChange={(e) => setBukti(e.target.files?.[0] ?? null)} className="mt-1 block text-sm" />
      </label>
      <label className="block font-semibold text-suka-gray-600">
        Catatan
        <input value={catatan} onChange={(e) => setCatatan(e.target.value)} className={INPUT} />
      </label>
      <Tombol
        sibuk={sibuk}
        aktif={Boolean(lok && bukti && n > 0)}
        onBatal={onBatal}
        onSimpan={() => bukti && onSimpan({ cashLocationId: lok, jumlah: n, bukti, catatan })}
      />
    </div>
  )
}

function PanelPengganti({
  r,
  sibuk,
  onBatal,
  onSimpan,
}: {
  r: ReturVendor
  sibuk: boolean
  onBatal: () => void
  onSimpan: (items: { retur_vendor_item_id: string; qty: number }[]) => void
}) {
  const [isian, setIsian] = useState<Record<string, string>>({})
  const items = r.items
    .map((i) => ({ i, q: Number((isian[i.id] ?? '').replace(',', '.')) }))
    .filter(({ q }) => q > 0)
  const lebih = items.find(({ i, q }) => q > i.qty - i.qty_pengganti_diterima + 1e-6)
  return (
    <div className={KOTAK}>
      <p className="font-semibold text-suka-brown">Barang pengganti yang datang hari ini (masuk stok Gudang Pusat, tidak ditagih).</p>
      {r.items.map((i) => (
        <label key={i.id} className="flex items-center justify-between gap-3">
          <span>
            {i.bahan_nama} <span className="text-xs text-suka-gray-500">(sisa {i.qty - i.qty_pengganti_diterima} {i.satuan})</span>
          </span>
          <input
            inputMode="decimal"
            value={isian[i.id] ?? ''}
            onChange={(e) => setIsian((s) => ({ ...s, [i.id]: e.target.value }))}
            className="w-24 rounded-lg border border-suka-gray-200 bg-white px-2 py-1 text-right"
          />
        </label>
      ))}
      {lebih && <p className="text-xs text-red-600">Pengganti {lebih.i.bahan_nama} melebihi sisa.</p>}
      <Tombol
        sibuk={sibuk}
        aktif={items.length > 0 && !lebih}
        onBatal={onBatal}
        onSimpan={() => onSimpan(items.map(({ i, q }) => ({ retur_vendor_item_id: i.id, qty: q })))}
      />
    </div>
  )
}
