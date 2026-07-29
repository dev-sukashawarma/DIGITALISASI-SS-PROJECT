import { Card } from '@suka/design-system/src/components/Card'

export function GridSkeleton({ cards = 18 }: { cards?: number }) {
  return (
    <div className="p-4 sm:p-6 space-y-4 animate-in fade-in duration-500">
      <div className="h-7 w-56 bg-suka-gray-200 rounded-lg animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i} className="p-4 space-y-3" style={{ minHeight: 200 }}>
            <div className="h-4 w-2/3 bg-suka-gray-200 rounded animate-pulse" />
            <div className="h-3 w-1/2 bg-suka-gray-100 rounded animate-pulse" />
            <div className="h-20 bg-suka-gray-50 rounded-xl animate-pulse" />
          </Card>
        ))}
      </div>
    </div>
  )
}
