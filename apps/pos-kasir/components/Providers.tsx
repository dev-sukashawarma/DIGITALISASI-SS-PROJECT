'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <QueryClientProvider client={queryClient}>
      {
        // @types/react is duplicated across the monorepo root (v18) and this app (v19),
        // which makes @tanstack/react-query's root-resolved `children` prop type
        // (typed against the root's React 18 types) structurally incompatible with
        // this app's React 19 ReactNode. Cast narrowly here rather than touching
        // root/app dependency declarations, which is out of scope for this change.
        children as any
      }
    </QueryClientProvider>
  )
}
