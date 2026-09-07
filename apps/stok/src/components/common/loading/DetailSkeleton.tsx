import { Card } from '@suka/design-system'

export function DetailSkeleton() {
  return (
    <div className="space-y-6 p-4 max-w-2xl mx-auto animate-in fade-in duration-500">
      <div className="h-7 w-32 bg-suka-gray-200 rounded-lg animate-pulse" />
      <Card className="p-5 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex justify-between items-center border-b border-suka-gray-100 pb-3">
            <div className="h-3 w-24 bg-suka-gray-100 rounded animate-pulse" />
            <div className="h-3 w-32 bg-suka-gray-200 rounded animate-pulse" />
          </div>
        ))}
      </Card>
      <Card className="p-5 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 bg-suka-gray-50 rounded-xl animate-pulse" />
        ))}
      </Card>
    </div>
  )
}
