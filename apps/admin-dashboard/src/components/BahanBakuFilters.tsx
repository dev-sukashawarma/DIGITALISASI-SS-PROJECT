'use client'

export function BahanBakuFilters({
  search, onSearch,
}: {
  search: string
  onSearch: (v: string) => void
}) {
  const inputCls = 'rounded-xl border border-suka-gray-200 px-3 py-2 text-sm outline-none focus:border-suka-orange'
  return (
    <div className="flex flex-wrap gap-2">
      <input className={inputCls} placeholder="Cari nama bahan"
        value={search} onChange={(e) => onSearch(e.target.value)} />
    </div>
  )
}
