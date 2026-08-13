// @ts-nocheck
import { useState } from 'react'
import { Button } from '@suka/design-system'
import { UploadCloud, CheckCircle2, AlertTriangle, FileSpreadsheet, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import { importExpensesAction } from '@/app/actions/importExpensesAction'

export function BulkImportModal({
  isOpen,
  onClose,
  onSuccess
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<any[]>([])

  if (!isOpen) return null

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (!selected) return
    setFile(selected)
    setError(null)
    
    // Parse preview
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        const parsed = XLSX.utils.sheet_to_json(sheet)
        setPreview(parsed)
      } catch (err: any) {
        setError('Gagal membaca file Excel. Pastikan format benar.')
      }
    }
    reader.readAsBinaryString(selected)
  }

  const handleImport = async () => {
    if (preview.length === 0) {
      setError('Data kosong.')
      return
    }

    setLoading(true)
    setError(null)
    
    try {
      const rows = preview.map(row => {
        // Map excel columns to database columns
        // Expecting columns: Tanggal, Kategori, Outlet ID, Keterangan, Jumlah, Tipe
        if (!row.Tanggal || !row.Kategori || !row['Jumlah'] || !row.Tipe) {
          throw new Error('Kolom wajib (Tanggal, Kategori, Jumlah, Tipe) ada yang kosong')
        }
        
        return {
          expense_date: row.Tanggal,
          category: row.Kategori,
          outlet_id: row['Outlet ID'] || null,
          scope: row['Outlet ID'] ? 'outlet' : 'pusat',
          description: row.Keterangan || '',
          amount: Number(row.Jumlah),
          type: row.Tipe.toLowerCase() === 'pemasukan' || row.Tipe.toLowerCase() === 'income' ? 'income' : 'expense',
          source: 'monthly'
        }
      })

      await importExpensesAction(rows)
      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Gagal mengimpor data.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-suka-ink">Import Excel (OPEX)</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors text-suka-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          <div className="p-4 bg-suka-brown/5 rounded-xl border border-suka-brown/10 text-suka-brown">
            <p className="text-sm">Gunakan template Excel dengan kolom berikut:</p>
            <ul className="list-disc list-inside mt-2 text-xs font-mono font-bold">
              <li>Tanggal (YYYY-MM-DD)</li>
              <li>Kategori</li>
              <li>Outlet ID (Kosongkan jika pusat)</li>
              <li>Keterangan</li>
              <li>Jumlah (Angka)</li>
              <li>Tipe (pemasukan / pengeluaran)</li>
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-semibold text-suka-ink">Pilih File Excel (.xlsx)</label>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileChange}
              className="block w-full text-sm text-suka-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-xl file:border-0
                file:text-sm file:font-semibold
                file:bg-suka-brown/10 file:text-suka-brown
                hover:file:bg-suka-brown/20 file:transition-colors"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <p>{error}</p>
            </div>
          )}

          {preview.length > 0 && !error && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-suka-ink flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                Preview Data ({preview.length} baris siap diimpor)
              </h4>
              <div className="max-h-60 overflow-y-auto border border-suka-gray-200 rounded-xl">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-suka-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2">Tanggal</th>
                      <th className="px-3 py-2">Kategori</th>
                      <th className="px-3 py-2 text-right">Jumlah</th>
                      <th className="px-3 py-2">Tipe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-suka-gray-100">
                    {preview.slice(0, 10).map((row, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2">{row.Tanggal}</td>
                        <td className="px-3 py-2">{row.Kategori}</td>
                        <td className="px-3 py-2 text-right">{row.Jumlah}</td>
                        <td className="px-3 py-2">{row.Tipe}</td>
                      </tr>
                    ))}
                    {preview.length > 10 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-2 text-center text-suka-gray-400 italic">
                          ... dan {preview.length - 10} baris lainnya
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-suka-gray-100">
            <Button variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
            <Button 
              onClick={handleImport} 
              disabled={!file || !!error || loading || preview.length === 0}
              className="flex items-center gap-2"
            >
              {loading ? 'Mengimpor...' : <><UploadCloud className="w-4 h-4" /> Import Sekarang</>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}