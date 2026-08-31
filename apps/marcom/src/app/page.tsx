import { redirect } from 'next/navigation'

export default function Home() {
  // Arahkan pengunjung awal langsung ke dashboard
  redirect('/dashboard')
}
