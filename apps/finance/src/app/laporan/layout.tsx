export default function LaporanLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full">
      <div className="flex-1 w-full">
        {children}
      </div>
    </div>
  )
}
