export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-screen w-full">
      <div className="flex-1 w-full px-2 sm:px-4 lg:px-0">
        {children}
      </div>
    </div>
  )
}
