'use client'
import { useState } from 'react'
import { Card, Button, Input } from '@suka/design-system'
import { useSuratJalanActions } from '@/hooks/useSuratJalan'
import type { SuratJalan } from '@/types/distribusi'

interface SignatureEntry {
  user_id: string
  timestamp: string
}

export function SignatureFlow({ sj, onSent }: { sj: SuratJalan; onSent?: (updated: SuratJalan) => void }) {
  const { send } = useSuratJalanActions()
  const [signatures, setSignatures] = useState<SignatureEntry[]>(
    Array(3).fill(null).map(() => ({ user_id: '', timestamp: '' }))
  )
  const [busy, setBusy] = useState(false)

  const updateSig = (idx: number, field: string, value: string) => {
    const updated = [...signatures]
    updated[idx] = { ...updated[idx], [field]: value }
    setSignatures(updated)
  }

  const canSend = signatures.every(s => s.user_id && s.timestamp)

  const handleSend = async () => {
    setBusy(true)
    try {
      const updated = await send(sj.id, signatures)
      onSent?.(updated)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <h3 className="font-semibold">Approval dari 3 Petugas (Pusat)</h3>
      {signatures.map((sig, idx) => (
        <div key={idx} className="border rounded p-3 space-y-2">
          <p className="text-sm font-medium">Penanda tangan {idx + 1}</p>
          <Input placeholder="User ID / Email" value={sig.user_id}
            onChange={e => updateSig(idx, 'user_id', e.target.value)} />
          <Input type="datetime-local" value={sig.timestamp}
            onChange={e => updateSig(idx, 'timestamp', e.target.value)} />
        </div>
      ))}
      <Button disabled={!canSend || busy} onClick={handleSend} className="w-full">
        {busy ? 'Mengirim…' : 'Kirim Surat Jalan'}
      </Button>
    </Card>
  )
}
