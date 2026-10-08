import './globals.css'

export const metadata = {
  title: 'SukaShawarma Command Centre',
  description: 'SukaShawarma Command Centre — J.A.R.V.I.S. Multi-Agent Tactical Operations',
}
export const viewport = { themeColor: '#030712', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased bg-[#030712] text-zinc-100">{children}</body>
    </html>
  )
}
