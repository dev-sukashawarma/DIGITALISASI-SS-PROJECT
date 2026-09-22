'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import { useAuth } from '@suka/auth'
import type { Opname, OpnameItem } from '@/types/stok'
import { useBahanBaku } from '@/hooks/useBahanBaku'
import { formatTriUnitSaldoFromGram } from '@/lib/format/compositeUnit'
import { getThresholdPersen, computeSelisihPersen, getMaterialType, THRESHOLD_BULK_PERSEN } from '@/lib/stok/selisih'
import { isBahanOpname } from '@/lib/stok/opnameScope'

const TIPE_LABEL: Record<string, string> = {
  harian: 'Harian 📅',
  mingguan: 'Mingguan 📆',
  ad_hoc: 'Ad Hoc ⚡',
};

export function OpnameDetail({ opnameId }: { opnameId: string }) {
  const { outletStaff } = useAuth()
  const role = outletStaff?.role
  const canViewThresholdAndLoss = ['kitchen', 'admin', 'admin_finance', 'owner', 'developer', 'purchasing'].includes((role as string) ?? '')
  const [opname, setOpname] = useState<Opname | null>(null)
  const [items, setItems] = useState<OpnameItem[]>([])
  const [bomUsage, setBomUsage] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const { bahanBaku, loading: bahanLoading } = useBahanBaku()

  const bahanMap = useMemo(() => {
    const map: Record<string, {
      nama: string; satuan: string; kategori: string
      satuan_tengah: string | null; faktor_tengah: number | null
      satuan_kecil: string | null; faktor_tampilan: number | null
    }> = {}
    for (const b of bahanBaku) {
      map[b.id] = {
        nama: b.nama, satuan: b.satuan, kategori: b.kategori,
        satuan_tengah: b.satuan_tengah, faktor_tengah: b.faktor_tengah,
        satuan_kecil: b.satuan_kecil, faktor_tampilan: b.faktor_tampilan,
      }
    }
    return map
  }, [bahanBaku])

  useEffect(() => {
    setError(null)
    const supabase = createClient()
    const load = async () => {
      try {
        const [opnameRes, itemsRes] = await Promise.all([
          supabase.from('opname').select('*, outlet_staff!opname_created_by_fkey(name)').eq('id', opnameId).single(),
          supabase.from('opname_item').select('id, opname_id, bahan_baku_id, qty_fisik, qty_system, selisih, flagged, catatan').eq('opname_id', opnameId)
        ])
        
        if (opnameRes.error) throw opnameRes.error
        if (itemsRes.error) throw itemsRes.error

        const opData = opnameRes.data as Opname
        setOpname(opData)
        setItems((itemsRes.data as OpnameItem[]) ?? [])

        // Fetch daily BOM usage for the opname date
        if (opData?.tanggal && opData?.outlet_id) {
          const startIso = `${opData.tanggal}T00:00:00+07:00`
          const endIso = `${opData.tanggal}T23:59:59+07:00`
          const { data: usageData } = await supabase
            .from('ledger_stok')
            .select('bahan_baku_id, qty')
            .eq('outlet_id', opData.outlet_id)
            .eq('tipe', 'pemakaian')
            .gte('created_at', startIso)
            .lte('created_at', endIso)

          const usageMap: Record<string, number> = {}
          for (const row of usageData || []) {
            usageMap[row.bahan_baku_id] = (usageMap[row.bahan_baku_id] || 0) + Math.abs(row.qty || 0)
          }
          setBomUsage(usageMap)
        }
      } catch (err: any) {
        setError(`Gagal memuat detail opname: ${err.message || err}`)
      }
    }
    load()
  }, [opnameId])

  const [activeTab, setActiveTab] = useState<'opnamed' | 'skipped'>('opnamed');

  const roleLabel = useMemo(() => {
    switch (role) {
      case 'kitchen': return 'Kitchen'
      case 'purchasing': return 'Purchasing'
      case 'admin_finance': return 'Finance'
      case 'admin': return 'Admin'
      case 'owner': return 'Owner'
      case 'developer': return 'Developer'
      default: return (role as string) || 'Staff'
    }
  }, [role])

  const stats = useMemo(() => {
    let pas = 0;
    let withinTol = 0;
    let flagged = 0;

    for (const it of items) {
      if (it.qty_fisik === null) continue;
      if (it.selisih === 0) {
        pas++;
      } else if (it.flagged) {
        flagged++;
      } else {
        withinTol++;
      }
    }

    return { pas, withinTol, flagged };
  }, [items]);

  const opnamedBahanIds = useMemo(() => new Set(items.map(it => it.bahan_baku_id)), [items]);
  const skippedBahan = useMemo(() => {
    return bahanBaku.filter(b => isBahanOpname(b) && !opnamedBahanIds.has(b.id));
  }, [bahanBaku, opnamedBahanIds]);

  if (error) return <p className="text-xs font-bold text-[#ba1a1a] bg-[#ffdad6] border border-[#ba1a1a]/20 p-4 rounded-xl">{error}</p>
  if (!opname || bahanLoading) return <div className="text-center py-12 text-xs font-bold text-[#544437]/50 animate-pulse">Memuat Detail Opname...</div>

  const isFinalized = opname.status === 'finalized';
  const isPending = opname.status === 'pending_approval';
  const isRejected = opname.status === 'rejected';
  const formattedDate = new Date(opname.tanggal).toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-6">
      {/* Pending Approval Banner */}
      {isPending && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⏳</span>
          <div>
            <p className="font-bold text-amber-800 text-xs uppercase tracking-wide">Menunggu Persetujuan Leader</p>
            <p className="text-[10px] text-amber-700/80 mt-0.5">
              Opname ini memiliki selisih kritis dan sedang menunggu keputusan dari Leader.
            </p>
          </div>
        </div>
      )}

      {/* Rejected Banner */}
      {isRejected && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">❌</span>
          <div>
            <p className="font-bold text-[#ba1a1a] text-xs uppercase tracking-wide">Opname Ditolak</p>
            {opname.approval_notes && (
              <p className="text-[10px] text-red-700 mt-1 font-medium">
                Alasan: {opname.approval_notes}
              </p>
            )}
            <p className="text-[10px] text-red-600/70 mt-1">Silakan lakukan opname ulang.</p>
          </div>
        </div>
      )}

      {/* Overview Metadata Card */}
      <div className="bg-white border border-[#d9c2b2]/45 rounded-2xl shadow-[0px_4px_12px_rgba(144,77,0,0.03)] p-5 space-y-4">
        <div className="flex justify-between items-center border-b border-[#d9c2b2]/20 pb-4">
          <div>
            <span className="text-[9px] font-black text-[#544437]/50 uppercase tracking-widest leading-none">ID OPNAME</span>
            <p className="text-xs font-mono font-bold text-gray-500 mt-1.5 leading-none truncate max-w-[150px] lg:max-w-xs">{opname.id}</p>
          </div>
          {isFinalized ? (
            <span className="bg-[#93f997]/15 text-[#006e24] border border-[#93f997]/25 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
              Selesai
            </span>
          ) : (
            <span className="bg-[#ffdcc2] text-[#904d00] border border-[#ffdcc2]/10 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider">
              Draft
            </span>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-2.5">
            <span className="text-xs font-bold text-[#544437]/70">Tanggal Opname</span>
            <span className="text-xs font-bold text-[#1e1b15]">{formattedDate}</span>
          </div>

          <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-2.5">
            <span className="text-xs font-bold text-[#544437]/70">Tipe Opname</span>
            <span className="text-[9px] font-bold uppercase tracking-wider text-[#701604]/60 bg-[#faf2e9] px-2.5 py-0.5 rounded border border-[#d9c2b2]/30">
              {TIPE_LABEL[opname.tipe] || opname.tipe}
            </span>
          </div>

          {opname.outlet_staff?.name && (
            <div className="flex justify-between items-center border-b border-[#d9c2b2]/10 pb-2.5">
              <span className="text-xs font-bold text-[#544437]/70">Petugas Pencatat</span>
              <span className="text-xs font-bold text-[#701604] uppercase">{opname.outlet_staff.name}</span>
            </div>
          )}

          {opname.notes && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-xs font-bold text-[#544437]/70">Catatan</span>
              <span className="text-xs font-medium text-gray-600 bg-[#fff8f1]/50 p-2.5 rounded-lg border border-[#d9c2b2]/20">
                {opname.notes}
              </span>
            </div>
          )}

          {canViewThresholdAndLoss && (
            <div className="pt-2 border-t border-[#d9c2b2]/10">
              <Link
                href={`/stok/jurnal-mutasi?outletId=${opname.outlet_id}&opnameId=${opname.id}`}
                className="w-full py-2.5 px-4 bg-suka-orange hover:bg-orange-600 active:bg-orange-700 text-white rounded-xl font-black text-xs transition-all shadow-xs flex items-center justify-center gap-2 cursor-pointer active:scale-98"
              >
                <Scale className="w-4 h-4" />
                <span>🔍 Audit Jurnal & Rekonsiliasi Bahan</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Stat Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white border border-[#d9c2b2]/45 rounded-xl p-3.5 shadow-xs">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#544437]/60">Total Master Bahan</span>
          <p className="text-base font-black text-[#1e1b15] mt-0.5">{items.length + skippedBahan.length} Bahan</p>
        </div>
        <div className="bg-[#e8f5e9]/60 border border-[#0a7d2c]/20 rounded-xl p-3.5 shadow-xs">
          <span className="text-[9px] font-bold uppercase tracking-wider text-[#0a7d2c]">Di-opname (Dihitung)</span>
          <p className="text-base font-black text-[#0a7d2c] mt-0.5">{items.length} Bahan</p>
        </div>
        <div className="bg-gray-50/80 border border-gray-200/80 rounded-xl p-3.5 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">Dilewati (Skip)</span>
          <p className="text-base font-black text-gray-600 mt-0.5">{skippedBahan.length} Bahan</p>
        </div>
      </div>

      {/* Threshold & Loss Analysis Summary for Kitchen, Admin, and Finance */}
      {canViewThresholdAndLoss && items.length > 0 && (
        <div className="bg-[#fff4e5]/70 border border-[#f29744]/35 rounded-2xl p-4 space-y-3 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">📊</span>
              <div>
                <h4 className="text-xs font-black text-[#701604] uppercase tracking-wide">
                  Analisis Threshold & Loss ({roleLabel})
                </h4>
                <p className="text-[10px] text-[#544437]/75 font-medium">
                  Toleransi: <strong className="text-[#701604]">±{THRESHOLD_BULK_PERSEN}%</strong> (Bulk) • <strong className="text-[#701604]">±40%</strong> (Ayam, Sapi) • <strong className="text-[#701604]">0%</strong> (Count)
                </p>
              </div>
            </div>
            <span className="self-start sm:self-auto text-[9px] font-extrabold uppercase tracking-wider bg-[#f29744]/20 text-[#701604] border border-[#f29744]/40 px-2.5 py-1 rounded-lg">
              Mode Analisis Aktif
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-0.5">
            <div className="bg-white border border-[#d9c2b2]/30 rounded-xl p-2.5 text-center">
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500">Pas (0 Selisih)</span>
              <p className="text-base font-black text-gray-700 mt-0.5">{stats.pas} Bahan</p>
            </div>
            <div className="bg-[#e8f5e9]/80 border border-[#0a7d2c]/20 rounded-xl p-2.5 text-center">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[#0a7d2c]">Dalam Toleransi</span>
              <p className="text-base font-black text-[#0a7d2c] mt-0.5">{stats.withinTol} Bahan</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">
              <span className="text-[8px] font-bold uppercase tracking-wider text-[#ba1a1a]">Melebihi Toleransi</span>
              <p className="text-base font-black text-[#ba1a1a] mt-0.5">{stats.flagged} Bahan</p>
            </div>
          </div>
        </div>
      )}

      {/* Opname Items Log List */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#d9c2b2]/30 pb-2">
          <h3 className="text-xs font-black text-[#544437]/50 uppercase tracking-widest pl-1">Daftar Item Opname</h3>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('opnamed')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === 'opnamed'
                  ? 'bg-[#701604] text-white shadow-xs'
                  : 'bg-white text-[#544437]/70 hover:bg-[#faf2e9] border border-[#d9c2b2]/40'
              }`}
            >
              Di-opname ({items.length})
            </button>
            {skippedBahan.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveTab('skipped')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === 'skipped'
                    ? 'bg-gray-700 text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-300'
                }`}
              >
                Dilewati ({skippedBahan.length})
              </button>
            )}
          </div>
        </div>

        {activeTab === 'opnamed' ? (
          <div className="space-y-5">
            {(['bulk', 'count'] as const).map((tipe) => {
              const rows = items.filter((it) => {
                const b = bahanMap[it.bahan_baku_id]
                return getMaterialType(b?.satuan, b?.satuan_kecil, b?.nama) === tipe
              })
              if (rows.length === 0) return null
              return (
                <OpnameItemTable
                  key={tipe}
                  tipe={tipe}
                  rows={rows}
                  bahanMap={bahanMap}
                  bomUsage={bomUsage}
                  showAnalisis={canViewThresholdAndLoss}
                />
              )
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900">
              💡 Bahan di bawah ini <strong>tidak diisi angkanya</strong> saat formulir opname disimpan, sehingga stok sistem untuk bahan ini tetap aman dan tidak mengalami penyesuaian.
            </div>
            {skippedBahan.map(b => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 flex justify-between items-center shadow-2xs"
              >
                <div className="min-w-0 space-y-1">
                  <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 bg-gray-200/70 px-1.5 py-0.5 rounded border border-gray-300/40">
                    {b.kategori || 'Bahan'}
                  </span>
                  <h4 className="font-bold text-gray-700 text-xs uppercase tracking-wide truncate">
                    {b.nama}
                  </h4>
                  <p className="text-[9px] text-gray-400">Satuan: {b.satuan}</p>
                </div>
                <span className="text-[9px] font-bold text-gray-500 bg-white border border-gray-300/70 px-2.5 py-1 rounded-lg flex-shrink-0">
                  ⚪ Dilewati (Tidak Di-opname)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

type BahanInfo = {
  nama: string; satuan: string; kategori: string
  satuan_tengah: string | null; faktor_tengah: number | null
  satuan_kecil: string | null; faktor_tampilan: number | null
}

const TIPE_META = {
  bulk: {
    judul: 'Bulk Material',
    sub: 'Ditimbang / diukur',
    badge: 'bg-[#fff4e5] text-[#904d00] border-[#f29744]/35',
  },
  count: {
    judul: 'Count Material',
    sub: 'Dihitung per satuan',
    badge: 'bg-[#eef2ff] text-[#3730a3] border-[#6366f1]/25',
  },
} as const

/**
 * Tabel item opname untuk satu kelompok material. Kolom %, Threshold & Status
 * hanya untuk role analisis (sama dengan `canViewThresholdAndLoss`). Status
 * membaca `opname_item.flagged` yang tersimpan saat opname, bukan dihitung ulang.
 */
function OpnameItemTable({
  tipe,
  rows,
  bahanMap,
  bomUsage,
  showAnalisis,
}: {
  tipe: 'bulk' | 'count'
  rows: OpnameItem[]
  bahanMap: Record<string, BahanInfo>
  bomUsage: Record<string, number>
  showAnalisis: boolean
}) {
  const meta = TIPE_META[tipe]
  const jmlFlag = rows.filter((it) => it.qty_fisik !== null && it.flagged).length

  // Yang melebihi toleransi di atas, lalu urut nama
  const sorted = [...rows].sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1
    const na = bahanMap[a.bahan_baku_id]?.nama ?? ''
    const nb = bahanMap[b.bahan_baku_id]?.nama ?? ''
    return na.localeCompare(nb)
  })

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${meta.badge}`}>
            {meta.judul}
          </span>
          <span className="text-[10px] text-[#544437]/60 font-medium">{meta.sub} · {rows.length} bahan</span>
        </div>
        {showAnalisis && jmlFlag > 0 && (
          <span className="text-[9px] font-bold text-[#ba1a1a]">⚠️ {jmlFlag} melebihi toleransi</span>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[#d9c2b2]/45 bg-white shadow-[0px_4px_12px_rgba(144,77,0,0.03)]">
        <table className={`w-full text-[11px] border-collapse ${showAnalisis ? 'min-w-[640px]' : 'min-w-[420px]'}`}>
          <thead>
            <tr className="bg-[#faf2e9] text-[9px] font-black uppercase tracking-wider text-[#544437]/70 text-left">
              <th className="sticky left-0 z-10 bg-[#faf2e9] px-3 py-2.5 min-w-[150px]">Bahan</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Fisik</th>
              <th className="px-3 py-2.5 whitespace-nowrap">Sistem</th>
              <th className="px-3 py-2.5 whitespace-nowrap text-right">Selisih</th>
              {showAnalisis && (
                <>
                  <th className="px-3 py-2.5 whitespace-nowrap text-right">%</th>
                  <th className="px-3 py-2.5 whitespace-nowrap text-right">Threshold</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">Status</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sorted.map((it) => {
              const bahan = bahanMap[it.bahan_baku_id]
              const nama = bahan ? bahan.nama : `Bahan ${it.bahan_baku_id.slice(0, 8)}`
              // qty_fisik/qty_system/selisih SELALU satuan kecil -- jangan tempel
              // satuan besar ke angka mentah (lihat formatTriUnitSaldoFromGram).
              const fmt = (qty: number) =>
                bahan
                  ? formatTriUnitSaldoFromGram(qty, bahan.satuan, bahan.satuan_tengah, bahan.faktor_tengah, bahan.satuan_kecil, bahan.faktor_tampilan)
                  : `${qty}`
              const threshold = getThresholdPersen(bahan?.satuan, bahan?.satuan_kecil, bahan?.nama)
              const persen = computeSelisihPersen(it.selisih, it.qty_system)
              const belum = it.qty_fisik === null
              const pas = !belum && it.selisih === 0
              const bom = bomUsage[it.bahan_baku_id]

              let targetKitchen: string | null = null
              try {
                const parsed = JSON.parse(String(it.catatan || '').replace(/^\[RAW\]\s*/, ''))
                if (parsed?.t) targetKitchen = parsed.t as string
              } catch {
                // catatan bukan JSON -- lewati
              }

              const rowBg = it.flagged ? 'bg-[#fff5f4]' : 'bg-white'
              const selisihColor = it.flagged
                ? 'text-[#ba1a1a]'
                : it.selisih < 0
                  ? 'text-orange-700'
                  : it.selisih > 0
                    ? 'text-green-700'
                    : 'text-gray-500'

              return (
                <tr key={it.id} className={`border-t border-[#d9c2b2]/25 align-top ${rowBg}`}>
                  <td className={`sticky left-0 z-10 px-3 py-2.5 ${rowBg}`}>
                    <p className="font-bold text-[#1e1b15] uppercase tracking-wide leading-tight">{nama}</p>
                    {bom !== undefined && bom > 0 && (
                      <p className="text-[9px] text-[#a43c26] mt-0.5">🍽️ BOM: {fmt(bom)}</p>
                    )}
                    {targetKitchen && (
                      <p className="text-[9px] font-bold text-[#0a7d2c] mt-0.5">🎯 Target: {targetKitchen}</p>
                    )}
                    {it.catatan && !it.catatan.startsWith('[RAW]') && (
                      <p className="text-[9px] text-gray-500 italic mt-0.5">* {it.catatan}</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-bold text-[#1e1b15]">
                    {belum ? <span className="text-gray-400 italic font-medium">Belum terhitung</span> : fmt(it.qty_fisik as number)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-[#544437]">{fmt(it.qty_system)}</td>
                  <td className={`px-3 py-2.5 whitespace-nowrap text-right font-black ${selisihColor}`}>
                    {belum ? '—' : pas ? 'Pas' : `${it.selisih > 0 ? '+' : ''}${fmt(it.selisih)}`}
                  </td>
                  {showAnalisis && (
                    <>
                      <td className={`px-3 py-2.5 whitespace-nowrap text-right font-bold tabular-nums ${selisihColor}`}>
                        {belum ? '—' : persen.formatted}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-bold text-[#701604] tabular-nums">
                        ±{threshold}%
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {belum ? (
                          <span className="text-gray-400">—</span>
                        ) : it.flagged ? (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-red-50 text-[#ba1a1a] border-red-200">⚠️ Melebihi</span>
                        ) : pas ? (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-gray-50 text-gray-600 border-gray-200">⚖️ Pas</span>
                        ) : (
                          <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border bg-emerald-50 text-[#0a7d2c] border-emerald-200">✅ Dalam batas</span>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
