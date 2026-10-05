'use client'
import { Component, useCallback, useEffect, useState, type ReactNode } from 'react'
import AvatarSukaBot from './AvatarSukaBot'
import PanelSukaBot from './PanelSukaBot'
import { ambilRekap, type Rekap } from './api'

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

function Widget({ apiBase }: { apiBase: string }) {
  const [buka, setBuka] = useState(false)
  const [adaBaru, setAdaBaru] = useState(false)

  useEffect(() => {
    ambilRekap(apiBase).then(({ rekap }) => setAdaBaru(bacaDibaca() !== rekap.id)).catch(() => {})
  }, [apiBase])

  const saatRekap = useCallback((r: Rekap) => { tulisDibaca(r.id); setAdaBaru(false) }, [])

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-3">
      {buka && <PanelSukaBot apiBase={apiBase} onRekap={saatRekap} />}
      <button onClick={() => setBuka((b) => !b)} aria-label={buka ? 'Tutup SUKA Bot' : 'Buka SUKA Bot'} className="relative">
        <AvatarSukaBot pose={adaBaru ? 'rekap' : 'diam'} />
        {adaBaru && !buka && <span className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-red-500 ring-2 ring-white" />}
      </button>
    </div>
  )
}

export default function SukaBotWidget({ apiBase }: { apiBase: string }) {
  return <Pengaman><Widget apiBase={apiBase} /></Pengaman>
}
