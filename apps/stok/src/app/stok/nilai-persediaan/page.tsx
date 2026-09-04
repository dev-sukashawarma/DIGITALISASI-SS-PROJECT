'use client'

import React from 'react'
import { NilaiPersediaanBoard } from '@/components/nilai-persediaan/NilaiPersediaanBoard'
import { AppLayout } from '@/components/layout/AppLayout'

export default function NilaiPersediaanPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-6">
        <NilaiPersediaanBoard />
      </div>
    </AppLayout>
  )
}
