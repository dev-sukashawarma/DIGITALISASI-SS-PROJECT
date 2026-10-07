import './globals.css'

export const metadata = {
  title: 'Kantor Bot — Suka Shawarma',
  description: 'Kantor bot Suka Shawarma — status bot dan tanya data operasional',
}
export const viewport = { themeColor: '#f29744', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  )
}
