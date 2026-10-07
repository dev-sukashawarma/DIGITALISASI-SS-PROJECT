import './globals.css'

export const metadata = {
  title: 'Bot CEO — Suka Shawarma',
  description: 'Tanya data operasional Suka Shawarma',
}
export const viewport = { themeColor: '#f29744', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="antialiased">{children}</body>
    </html>
  )
}
