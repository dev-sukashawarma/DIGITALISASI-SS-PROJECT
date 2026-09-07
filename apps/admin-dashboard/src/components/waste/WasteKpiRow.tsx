'use client'

import CountUp from 'react-countup'
import { TrendingDown, TrendingUp, Minus, Percent, Target, ClipboardList } from 'lucide-react'
import { StatTile } from '@/components/ui'
import { rupiah } from '@/lib/format'
import { computeDeltaPct, computeWastePctOmzet } from '@/lib/wasteMetrics'
import { computeWasteGap } from '@/lib/wasteGap'

interface WasteKpiRowProps {
  totalNilai: number
  totalPrevious: number
  totalOmzet: number
  totalBudget: number
  totalInsiden: number
  outletCount: number
}

export function WasteKpiRow({
  totalNilai, totalPrevious, totalOmzet, totalBudget, totalInsiden, outletCount,
}: WasteKpiRowProps) {
  const delta = computeDeltaPct(totalNilai, totalPrevious)
  const pctOmzet = computeWastePctOmzet(totalNilai, totalOmzet)
  const gap = computeWasteGap(totalNilai, totalBudget)
  const rataPerOutlet = outletCount > 0 ? totalInsiden / outletCount : null

  const deltaSub =
    delta === null
      ? 'Tak ada data periode sebelumnya'
      : `${delta > 0 ? '▲' : delta < 0 ? '▼' : '='} ${Math.abs(delta).toFixed(1)}% vs periode sebelumnya`

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatTile
        label="Total Kerugian Waste"
        value={<><span className="text-lg align-top">Rp </span><CountUp end={totalNilai} duration={1} separator="." /></>}
        sub={deltaSub}
        icon={delta === null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown}
        accent={delta === null || delta === 0 ? 'brown' : delta > 0 ? 'red' : 'green'}
        tooltip="Nilai waste yang sudah di-approve pada periode terpilih, dibandingkan dengan periode sama panjang tepat sebelumnya."
      />

      <StatTile
        label="Waste % Omzet"
        value={pctOmzet === null ? 'N/A' : <><CountUp end={pctOmzet} duration={1} decimals={2} /> %</>}
        sub={pctOmzet === null ? 'Belum ada omzet pada periode ini' : `Dari omzet ${rupiah(totalOmzet)}`}
        icon={Percent}
        accent={pctOmzet === null ? 'brown' : pctOmzet > 2 ? 'red' : 'green'}
        tooltip="Waste dibagi omzet. Pembanding yang adil antar-outlet: rupiah mentah membuat outlet besar selalu tampak paling boros."
      />

      <StatTile
        label="Gap vs Alokasi BOM"
        value={gap.gapPct === null ? 'N/A' : <><CountUp end={gap.gapPct} duration={1} decimals={1} /> %</>}
        sub={gap.gapPct === null ? 'Belum ada alokasi BOM pada periode ini' : `${rupiah(totalNilai)} aktual vs ${rupiah(totalBudget)} alokasi`}
        icon={Target}
        accent={gap.gapPct === null ? 'brown' : gap.gapPct > 0 ? 'red' : 'green'}
        tooltip="Alokasi = buffer_amount di resep dikali qty terjual. Gap positif berarti waste melebihi yang sudah dianggarkan resep."
      />

      <StatTile
        label="Jumlah Insiden"
        value={<CountUp end={totalInsiden} duration={1} separator="." />}
        sub={rataPerOutlet === null ? 'Belum ada outlet dengan waste' : `Rata-rata ${rataPerOutlet.toFixed(1)} per outlet`}
        icon={ClipboardList}
        accent="brown"
        tooltip="Banyaknya laporan waste yang di-approve. Membedakan banyak kerugian kecil dari satu kerugian besar."
      />
    </div>
  )
}
