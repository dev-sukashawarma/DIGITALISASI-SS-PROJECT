'use client'

import React from 'react'
import { HargaBahanBoard } from '@/components/harga-bahan/HargaBahanBoard'
import { AppLayout } from '@/components/layout/AppLayout'

export default function HargaBahanPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <HargaBahanBoard showBackButton={false} />
      </div>
    </AppLayout>
  )
}
