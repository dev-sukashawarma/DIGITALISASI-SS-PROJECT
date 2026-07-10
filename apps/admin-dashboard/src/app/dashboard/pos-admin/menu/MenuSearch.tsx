'use client'

import { Search } from 'lucide-react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { useDebounce } from 'use-debounce'

export default function MenuSearch() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [debouncedQuery] = useDebounce(query, 300)

  useEffect(() => {
    const currentQ = searchParams.get('q') || ''
    
    // Only replace if the actual value has changed
    if (currentQ !== debouncedQuery) {
      const params = new URLSearchParams(searchParams)
      if (debouncedQuery) {
        params.set('q', debouncedQuery)
      } else {
        params.delete('q')
      }
      
      // Use replace to avoid filling up browser history with keystrokes
      router.replace(`${pathname}?${params.toString()}`)
    }
  }, [debouncedQuery, pathname, router, searchParams])

  return (
    <div className="relative w-full sm:w-auto sm:min-w-[200px]">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-4 w-4 text-gray-400" />
      </div>
      <input
        type="text"
        className="block w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors text-sm"
        placeholder="Cari menu..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  )
}
