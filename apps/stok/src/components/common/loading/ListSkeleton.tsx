import { Card } from '@suka/design-system/src/components/Card'

export function ListSkeleton({ rows = 6, title = 'Memuat...' }: { rows?: number; title?: string }) {
  return (
    <div className="space-y-4 p-4 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="h-7 w-40 bg-suka-gray-200 rounded-lg animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i} className="p-4 flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-suka-gray-100 animate-pulse shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-1/2 bg-suka-gray-200 rounded animate-pulse" />
            <div className="h-3 w-1/3 bg-suka-gray-100 rounded animate-pulse" />
          </div>
          <div className="h-6 w-16 bg-suka-orange/10 rounded-full animate-pulse" />
        </Card>
      ))}
      <span className="sr-only">{title}</span>
    </div>
  )
}
