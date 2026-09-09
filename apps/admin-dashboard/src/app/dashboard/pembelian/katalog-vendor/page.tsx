'use client'

import { PageHeader } from '@/components/ui'
import { KatalogVendorBoard } from '@/components/katalog-vendor/KatalogVendorBoard'

export default function KatalogVendorPage() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Katalog Harga Vendor"
        description="Harga per vendor untuk tiap bahan. Perbandingan antar vendor selalu dihitung per satuan kecil, karena vendor bisa menota dalam kemasan berbeda."
      />
      <KatalogVendorBoard />
    </div>
  )
}
