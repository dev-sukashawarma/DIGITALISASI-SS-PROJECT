'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@suka/design-system'
import { useAuth } from '@/context/AuthContext'
import { useLedgerList } from '@/hooks/useLedger'
import { LedgerList } from '@/components/stok/LedgerList'

export default function LedgerPage() {
  const { outletStaff } = useAuth()
  const [page, setPage] = useState(0)
  const { ledger, loading } = useLedgerList(outletStaff?.outlet_id, page)
  return (
    <main className="max-w-2xl mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-xl font-bold">Ledger Stok</h1>
        <Link href="/stok/ledger/new"><Button>+ Entri Manual</Button></Link>
      </div>
      {loading ? <p>Memuat…</p> : <LedgerList items={ledger} />}
      <div className="flex justify-between mt-4">
        <Button disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Sebelumnya</Button>
        <Button disabled={ledger.length<50} onClick={()=>setPage(p=>p+1)}>Berikutnya →</Button>
      </div>
    </main>
  )
}
