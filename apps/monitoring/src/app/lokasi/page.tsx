import type { Metadata } from 'next'
import LiveLocationBoard from '@/components/LiveLocationBoard'

export const metadata: Metadata = {
  title: 'Peta staff lapangan · Suka Monitor',
  description: 'Posisi live staff lapangan Sukashawarma di peta interaktif.',
}

export default function LokasiPage() {
  return <LiveLocationBoard />
}
