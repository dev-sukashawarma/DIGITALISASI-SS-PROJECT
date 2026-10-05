'use client'
import dynamic from 'next/dynamic'

// Dimuat terpisah dari bundle launcher; hanya dirender untuk admin/owner/developer.
const SukaBotWidget = dynamic(() => import('./SukaBotWidget'), { ssr: false })

export default function SukaBotMount({ apiBase }: { apiBase: string }) {
  return <SukaBotWidget apiBase={apiBase} />
}
