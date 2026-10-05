'use client'
import { Component, useCallback, useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import AvatarSukaBot, { type Pose } from './AvatarSukaBot'
import PanelSukaBot from './PanelSukaBot'
import PanelSetelan from './PanelSetelan'
import { KLIP, RASIO } from './avatar/klip.gen'
import { posisiPanel, posisiTab, UKURAN_TAB, ukuranPanel } from './avatar/posisi'
import { tinggiChef, UKURAN_PANEL } from './avatar/setelan'
import { ambilRekap, type Rekap } from './api'
import { useGeserChef, useUkuranLayar } from './useGeserChef'
import { useSetelan } from './useSetelan'

const KUNCI_DIBACA = 'sukaBot.rekapDibaca'

const bacaDibaca = () => { try { return localStorage.getItem(KUNCI_DIBACA) } catch { return null } }
const tulisDibaca = (id: string) => { try { localStorage.setItem(KUNCI_DIBACA, id) } catch { /* abaikan */ } }

/** Kegagalan SUKA Bot tidak boleh merusak launcher (pintu login semua role). */
class PengamanKelas extends Component<{ children: ReactNode }, { rusak: boolean }> {
  state = { rusak: false }
  static getDerivedStateFromError() { return { rusak: true } }
  componentDidCatch(e: unknown) { console.error('[suka-bot] widget error:', e) }
  render() { return this.state.rusak ? null : this.props.children }
}
// Portal memakai @types/react 19, sementara pemeriksa JSX membandingkan dengan
// ReactNode dari @types/react lama di root monorepo → TS2786 untuk class component
// dan untuk tipe apa pun dari `react` portal. Diketik dengan JSX.Element global (tipe
// yang dipakai pemeriksa itu sendiri). Perilaku runtime tidak terpengaruh.
const Pengaman = PengamanKelas as unknown as (props: { children: ReactNode }) => JSX.Element

function TitikMerah({ gaya }: { gaya: CSSProperties }) {
  return (
    <span className="absolute flex w-3.5 h-3.5" style={gaya}>
      <span className="absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75 motion-safe:animate-ping" />
      <span className="relative inline-flex w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white" />
    </span>
  )
}

function Widget({ apiBase }: { apiBase: string }) {
  const [buka, setBuka] = useState(false)
  const [adaBaru, setAdaBaru] = useState(false)
  const [posePanel, setPosePanel] = useState<Pose>('rekap')
  const [ketukan, setKetukan] = useState(0)
  const { setelan, ubah } = useSetelan()
  const layar = useUkuranLayar()
  const tinggi = tinggiChef(setelan.ukuranChef, layar.w)
  const ukuranChef = { w: Math.round(tinggi * RASIO), h: tinggi }
  const { posisi, penangan, baruSajaDigeser, kembalikan } = useGeserChef(ukuranChef, layar)

  useEffect(() => {
    ambilRekap(apiBase).then(({ rekap }) => setAdaBaru(bacaDibaca() !== rekap.id)).catch(() => {})
  }, [apiBase])

  const saatRekap = useCallback((r: Rekap) => { tulisDibaca(r.id); setAdaBaru(false) }, [])

  if (setelan.tersembunyi) {
    const tab = posisiTab({ y: posisi.y, h: ukuranChef.h }, layar)
    return (
      <button
        type="button"
        onClick={() => ubah({ tersembunyi: false })}
        aria-label="Munculkan SUKA Bot"
        className="fixed z-50 rounded-l-full bg-suka-cream border border-r-0 border-suka-orange/40 shadow-lg overflow-hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-suka-orange"
        style={{ left: tab.x, top: tab.y, width: UKURAN_TAB, height: UKURAN_TAB }}
      >
        <img src={KLIP.diam.gambar} alt="" draggable={false} className="h-full w-full object-cover" style={{ objectPosition: '50% 6%' }} />
        {adaBaru && <TitikMerah gaya={{ top: 2, left: 2 }} />}
      </button>
    )
  }

  const pose: Pose = buka ? posePanel : adaBaru ? 'rekap' : 'diam'
  const panel = buka
    ? posisiPanel({ ...posisi, ...ukuranChef }, ukuranPanel(layar, UKURAN_PANEL[setelan.ukuranPanel]), layar)
    : null

  return (
    <>
      {panel && (
        <div className="fixed z-50" style={{ left: panel.x, top: panel.y }}>
          <PanelSukaBot
            apiBase={apiBase}
            onRekap={saatRekap}
            onPose={setPosePanel}
            ukuran={{ w: panel.w, h: panel.h }}
            setelan={
              <PanelSetelan
                setelan={setelan}
                ubah={ubah}
                kembalikanPosisi={kembalikan}
                sembunyikan={() => { setBuka(false); ubah({ tersembunyi: true }) }}
              />
            }
          />
        </div>
      )}
      <button
        type="button"
        {...penangan}
        onClick={() => {
          if (baruSajaDigeser()) return
          setBuka((b) => !b)
          setKetukan((n) => n + 1)
        }}
        aria-label={buka ? 'Tutup SUKA Bot' : 'Buka SUKA Bot'}
        className="fixed z-50 touch-none cursor-grab active:cursor-grabbing rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-suka-orange"
        style={{ left: posisi.x, top: posisi.y, width: ukuranChef.w, height: ukuranChef.h }}
      >
        <AvatarSukaBot pose={pose} tinggi={tinggi} ketukan={ketukan} animasi={setelan.animasi} />
        {adaBaru && !buka && <TitikMerah gaya={{ top: '3%', right: '18%' }} />}
      </button>
    </>
  )
}

export default function SukaBotWidget({ apiBase }: { apiBase: string }) {
  return <Pengaman><Widget apiBase={apiBase} /></Pengaman>
}
