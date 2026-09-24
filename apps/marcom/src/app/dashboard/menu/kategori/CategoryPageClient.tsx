'use client'

import { useState } from 'react'
import CategoryManagementView from '../CategoryManagementView'
import type { Category, MenuItem } from '@/types/menu'
import { cn } from '@/lib/utils'
import { CheckCircle2, AlertCircle } from 'lucide-react'

export default function CategoryPageClient({
  initialCategories,
  initialItems,
}: {
  initialCategories: Category[]
  initialItems: MenuItem[]
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [items, setItems] = useState<MenuItem[]>(initialItems)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3500)
  }

  return (
    <div className="py-2 space-y-6">
      <CategoryManagementView
        categories={categories}
        items={items}
        onCategoriesChange={setCategories}
        onItemsChange={setItems}
        onToast={showToast}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl font-bold text-xs sm:text-sm animate-in fade-in slide-in-from-bottom-4',
            toast.type === 'success' ? 'bg-stone-900 text-white' : 'bg-red-600 text-white'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : (
            <AlertCircle className="w-4 h-4 text-white" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  )
}
