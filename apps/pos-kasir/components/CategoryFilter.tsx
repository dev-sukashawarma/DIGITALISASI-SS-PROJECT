'use client'

import type { Category } from '@/types'

interface Props {
  categories: Category[]
  selected: string
  onChange: (id: string) => void
}

export default function CategoryFilter({ categories, selected, onChange }: Props) {
  const tabs = [{ id: 'all', name: 'Semua Menu' }, ...categories]

  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 px-1 py-1">
      {tabs.map((tab) => {
        const isActive = selected === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`relative flex-shrink-0 px-5 py-2.5 text-[15px] font-bold rounded-full border-2 transition-all outline-none
              ${isActive 
                ? 'border-amber-500 bg-amber-50 text-amber-700' 
                : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:bg-gray-50'}`}
          >
            {tab.name}
          </button>
        )
      })}
    </div>
  )
}
