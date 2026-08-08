'use client'

import { useState } from 'react'
import { Button } from '@suka/design-system'
import { toast } from 'sonner'
import { parseFile, ParsedMenuData } from '../utils/parsers'
import { getDBDataForValidation, DBMenuData } from '../actions'

type ValidationResultRow = {
  menuName: string
  fileQty: number
  dbQty: number
  isMatch: boolean
}

export default function DataValidateClient({ outlets }: { outlets: any[] }) {
  const [selectedOutlet, setSelectedOutlet] = useState<string>('')
  const [selectedChannel, setSelectedChannel] = useState<string>('tiktok_go')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<ValidationResultRow[]>([])

  const handleValidate = async () => {
    if (!selectedOutlet) return toast.error('Pilih Outlet terlebih dahulu')
    if (!dateFrom) return toast.error('Pilih Tanggal Dari terlebih dahulu')
    if (!dateTo) return toast.error('Pilih Tanggal Sampai terlebih dahulu')
    if (dateFrom > dateTo) return toast.error('Tanggal Dari harus sebelum Tanggal Sampai')
    if (!file) return toast.error('Pilih File terlebih dahulu')

    setLoading(true)
    try {
      // 1. Parse File
      const parsedData = await parseFile(file, selectedChannel)

      // 2. Fetch DB Data
      const dbData = await getDBDataForValidation(selectedOutlet, selectedChannel, dateFrom, dateTo)

      // 3. Compare Data
      const comparisonMap = new Map<string, ValidationResultRow>()

      // Add file data
      parsedData.forEach(p => {
        comparisonMap.set(p.name, {
          menuName: p.name,
          fileQty: p.qty,
          dbQty: 0,
          isMatch: false
        })
      })

      // Add DB data
      dbData.forEach(db => {
        const existing = comparisonMap.get(db.name)
        if (existing) {
          existing.dbQty = db.qty
          existing.isMatch = existing.fileQty === existing.dbQty
        } else {
          comparisonMap.set(db.name, {
            menuName: db.name,
            fileQty: 0,
            dbQty: db.qty,
            isMatch: false
          })
        }
      })

      // Convert map to array and sort
      const comparisonArray = Array.from(comparisonMap.values()).sort((a, b) => a.menuName.localeCompare(b.menuName))
      setResults(comparisonArray)
      toast.success('Validasi selesai!')

    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Terjadi kesalahan saat memvalidasi data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-lg">Filter & Upload Data</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Outlet</label>
              <select 
                className="w-full p-2 border rounded-md"
                value={selectedOutlet} 
                onChange={(e) => setSelectedOutlet(e.target.value)}
              >
                <option value="" disabled>Pilih Outlet</option>
                {outlets.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}</option>
                ))}
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel</label>
              <select 
                className="w-full p-2 border rounded-md"
                value={selectedChannel} 
                onChange={(e) => setSelectedChannel(e.target.value)}
              >
                <option value="tiktok_go">TikTok GO</option>
                <option value="tiktok_seller">TikTok Seller</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal Dari</label>
              <input 
                type="date" 
                className="w-full p-2 border rounded-md" 
                value={dateFrom} 
                onChange={(e) => setDateFrom(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Tanggal Sampai</label>
              <input 
                type="date" 
                className="w-full p-2 border rounded-md" 
                value={dateTo} 
                min={dateFrom}
                onChange={(e) => setDateTo(e.target.value)} 
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">File (Excel/CSV)</label>
              <input 
                type="file" 
                className="w-full p-2 border rounded-md" 
                accept=".csv, .xlsx, .xls" 
                onChange={(e) => setFile(e.target.files?.[0] || null)} 
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleValidate} disabled={loading}>
              {loading ? 'Memvalidasi...' : 'Validasi Data'}
            </Button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-lg">Hasil Validasi (Fokus pada QTY)</h3>
          </div>
          <div className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase bg-gray-100">
                  <tr>
                    <th className="px-6 py-3">Nama Menu</th>
                    <th className="px-6 py-3">QTY (File Export)</th>
                    <th className="px-6 py-3">QTY (Database)</th>
                    <th className="px-6 py-3">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((row, idx) => {
                    const selisih = row.fileQty - row.dbQty
                    return (
                      <tr 
                        key={idx} 
                        className={`border-b ${row.isMatch ? '' : 'bg-red-50 text-red-900'}`}
                      >
                        <td className="px-6 py-4 font-medium">{row.menuName}</td>
                        <td className="px-6 py-4">{row.fileQty}</td>
                        <td className="px-6 py-4">{row.dbQty}</td>
                        <td className="px-6 py-4 font-bold">
                          {selisih !== 0 ? (selisih > 0 ? `+${selisih}` : selisih) : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
