'use client'

import { useState, useRef, useMemo } from 'react'
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  X,
  Users,
  DollarSign,
  ShieldCheck,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Clock,
  Receipt,
} from 'lucide-react'
import { Button, Spinner } from '@suka/design-system'
import { toast } from 'sonner'
import type { Outlet, Role, StaffStatus } from '@/lib/types'
import { parseStaffFile, type ParsedStaffRow } from '@/lib/parseStaffCsv'
import { bulkImportStaffAction, type BulkImportSummary } from '@/app/actions/bulkImportStaff'
import { formatRupiah } from '@/lib/format'

interface BulkImportStaffModalProps {
  outlets: Outlet[]
  onClose: () => void
  onSuccess: () => void
}

const ROLES: Role[] = [
  'crew',
  'leader',
  'kitchen',
  'spv',
  'area_manager',
  'regional_manager',
  'admin_hr',
  'admin',
  'admin_finance',
  'purchasing',
  'staff_pusat',
  'owner',
  'mitra',
]

type ModalSortKey = 'no' | 'name' | 'role' | 'outlet' | 'basicSalary' | 'mealAllowance' | 'overtime' | 'cashAdvance' | 'totalSalary' | 'status'

export function BulkImportStaffModal({ outlets, onClose, onSuccess }: BulkImportStaffModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [parsing, setParsing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ParsedStaffRow[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Sorting in modal
  const [sortKey, setSortKey] = useState<ModalSortKey>('no')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Options
  const [updateExisting, setUpdateExisting] = useState(true)
  const defaultPassword = '123456'
  const [periodMonth, setPeriodMonth] = useState(1)
  const [periodYear, setPeriodYear] = useState(2026)

  // Importing state
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<BulkImportSummary | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setParsing(true)
    setFileName(file.name)
    setSummary(null)

    try {
      const parsed = await parseStaffFile(file, outlets)
      if (parsed.length === 0) {
        toast.error('Tidak ada data karyawan yang valid ditemukan dalam file ini.')
        setRows([])
      } else {
        setRows(parsed)
        toast.success(`Berhasil membaca ${parsed.length} data karyawan dari ${file.name}`)
      }
    } catch (err: any) {
      toast.error(`Gagal membaca file: ${err.message}`)
      setRows([])
    } finally {
      setParsing(false)
    }
  }

  const handleSort = (key: ModalSortKey) => {
    if (sortKey === key) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortOrder(key.includes('Salary') || key === 'overtime' || key === 'cashAdvance' || key === 'mealAllowance' ? 'desc' : 'asc')
    }
  }

  const renderSortIcon = (key: ModalSortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown size={11} className="text-stone-400 group-hover:text-suka-orange transition-colors" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp size={11} className="text-suka-orange font-bold" />
    ) : (
      <ArrowDown size={11} className="text-suka-orange font-bold" />
    )
  }

  // Row update handlers
  const handleUpdateRowRole = (originalIndex: number, newRole: Role) => {
    setRows((prev) => {
      const next = [...prev]
      next[originalIndex] = { ...next[originalIndex], role: newRole }
      return next
    })
  }

  const handleUpdateRowOutlet = (originalIndex: number, newOutletId: string) => {
    const foundOutlet = outlets.find((o) => o.id === newOutletId)
    setRows((prev) => {
      const next = [...prev]
      next[originalIndex] = {
        ...next[originalIndex],
        outletId: newOutletId,
        outletName: foundOutlet?.name || 'Kantor Pusat',
        isOutletMatched: true,
      }
      return next
    })
  }

  const handleUpdateRowStatus = (originalIndex: number, newStatus: StaffStatus) => {
    setRows((prev) => {
      const next = [...prev]
      next[originalIndex] = { ...next[originalIndex], status: newStatus }
      return next
    })
  }

  // Filtered & Sorted rows for preview
  const displayRows = useMemo(() => {
    const q = searchTerm.toLowerCase().trim()
    const mappedWithIdx = rows.map((r, i) => ({ ...r, _originalIndex: i }))

    const filtered = mappedWithIdx.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.outletName.toLowerCase().includes(q) ||
        r.role.toLowerCase().includes(q) ||
        r.username.toLowerCase().includes(q)
    )

    const mult = sortOrder === 'desc' ? -1 : 1
    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'no':
          return (Number(a.no || 0) - Number(b.no || 0)) * mult
        case 'name':
          return a.name.localeCompare(b.name, 'id') * mult
        case 'role':
          return a.role.localeCompare(b.role, 'id') * mult
        case 'outlet':
          return a.outletName.localeCompare(b.outletName, 'id') * mult
        case 'basicSalary':
          return (a.basicSalary - b.basicSalary) * mult
        case 'mealAllowance':
          return (a.mealAllowance - b.mealAllowance) * mult
        case 'overtime':
          return (a.overtime - b.overtime) * mult
        case 'cashAdvance':
          return (a.cashAdvance - b.cashAdvance) * mult
        case 'totalSalary':
          return (a.totalSalary - b.totalSalary) * mult
        case 'status':
          return a.status.localeCompare(b.status, 'id') * mult
        default:
          return 0
      }
    })
  }, [rows, searchTerm, sortKey, sortOrder])

  const activeCount = rows.filter((r) => r.status === 'active').length
  const totalBaseSalary = rows.reduce((acc, r) => acc + r.basicSalary, 0)
  const totalMealAllowance = rows.reduce((acc, r) => acc + r.mealAllowance, 0)
  const totalOvertime = rows.reduce((acc, r) => acc + r.overtime, 0)
  const totalCashAdvance = rows.reduce((acc, r) => acc + r.cashAdvance, 0)
  const totalTHP = rows.reduce((acc, r) => acc + r.totalSalary, 0)

  const handleExecuteImport = async () => {
    if (rows.length === 0) {
      toast.error('Tidak ada data karyawan untuk di-import.')
      return
    }

    if (
      !confirm(
        `Konfirmasi import ${rows.length} data karyawan ke database & payroll?`
      )
    ) {
      return
    }

    setImporting(true)
    setSummary(null)

    try {
      const result = await bulkImportStaffAction(rows, {
        updateExisting,
        defaultPassword,
        syncPayrollMonth: periodMonth,
        syncPayrollYear: periodYear,
      })

      setSummary(result)

      if (result.failedCount === 0) {
        toast.success(
          `Import selesai! ${result.insertedCount} karyawan baru ditambahkan, ${result.updatedCount} karyawan & payroll diperbarui.`
        )
        onSuccess()
      } else {
        toast.warning(
          `Import selesai dengan catatan: ${result.insertedCount + result.updatedCount} berhasil, ${result.failedCount} gagal.`
        )
        onSuccess()
      }
    } catch (err: any) {
      toast.error(err.message || 'Terjadi kesalahan saat memproses import karyawan')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-5xl rounded-3xl border border-suka-gray-200 bg-white p-6 shadow-2xl space-y-4 animate-in zoom-in-95 my-4 max-h-[96vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex justify-between items-start border-b border-suka-gray-100 pb-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-100 text-suka-orange flex items-center justify-center font-bold">
              <Upload size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black text-suka-brown">Import Database Karyawan &amp; Payroll Report</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-orange-50 text-suka-orange border border-orange-200">
                  Full Payroll Sync
                </span>
              </div>
              <p className="text-xs text-suka-gray-500 font-medium mt-0.5">
                Membaca dan menyinkronkan <strong>Gaji Pokok</strong>, <strong>Tunjangan Makan</strong>, <strong>Lembur (Overtime)</strong>, <strong>Kasbon (Cash Advance)</strong>, dan <strong>Total Take Home Pay</strong>.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={importing}
            className="rounded-full p-1.5 text-suka-gray-400 hover:bg-stone-100 hover:text-suka-ink transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Upload Zone if no rows or change file */}
        <div className="shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
          />

          {!fileName ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-suka-orange/40 bg-orange-50/20 hover:bg-orange-50/50 rounded-2xl p-5 text-center cursor-pointer transition-all space-y-1.5 group"
            >
              <div className="w-11 h-11 rounded-2xl bg-orange-100 text-suka-orange mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                <FileSpreadsheet size={22} />
              </div>
              <div>
                <p className="text-sm font-black text-suka-brown">Klik atau Tarik File CSV / Excel Payroll ke Sini</p>
                <p className="text-xs text-suka-gray-500 mt-0.5">
                  Mendukung file: <strong>.csv</strong>, <strong>.xlsx</strong>, <strong>.xls</strong> (Membaca Base Salary, Overtime, Meal Allowance, Kasbon, Total Salary).
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between p-3 bg-stone-50 rounded-2xl border border-stone-200 gap-3">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet size={22} className="text-suka-orange shrink-0" />
                <div>
                  <span className="text-xs font-bold text-suka-ink block">{fileName}</span>
                  <span className="text-[11px] text-stone-500">
                    {parsing ? 'Sedang membaca file...' : `${rows.length} Baris Karyawan Terdeteksi`}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing || parsing}
                className="text-xs font-bold border border-stone-300 rounded-xl"
              >
                Ganti File
              </Button>
            </div>
          )}
        </div>

        {/* Analyzed KPIs Bar - 5 Financial Breakdown Cards */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 shrink-0">
            <div className="bg-stone-50 p-2.5 rounded-2xl border border-stone-200">
              <div className="flex items-center gap-1 text-stone-500 text-[10px] font-bold">
                <Users size={12} />
                <span>Total Staf</span>
              </div>
              <p className="text-base font-black text-suka-ink mt-0.5">{rows.length} Orang ({activeCount} Aktif)</p>
            </div>

            <div className="bg-[#FDF9F3] p-2.5 rounded-2xl border border-suka-brown/15">
              <div className="flex items-center gap-1 text-suka-brown text-[10px] font-bold">
                <DollarSign size={12} className="text-suka-orange" />
                <span>Base Salary (Gaji Pokok)</span>
              </div>
              <p className="text-xs font-black text-suka-brown mt-0.5 truncate">{formatRupiah(totalBaseSalary)}</p>
            </div>

            <div className="bg-blue-50/60 p-2.5 rounded-2xl border border-blue-200">
              <div className="flex items-center gap-1 text-blue-800 text-[10px] font-bold">
                <Receipt size={12} />
                <span>Meal Allowance (Tunj. Makan)</span>
              </div>
              <p className="text-xs font-black text-blue-900 mt-0.5 truncate">{formatRupiah(totalMealAllowance)}</p>
            </div>

            <div className="bg-amber-50/60 p-2.5 rounded-2xl border border-amber-200">
              <div className="flex items-center gap-1 text-amber-800 text-[10px] font-bold">
                <Clock size={12} />
                <span>Overtime / Kasbon</span>
              </div>
              <p className="text-[11px] font-bold text-amber-900 mt-0.5">
                OT: <span className="text-emerald-700 font-black">{formatRupiah(totalOvertime)}</span> &bull; Kasbon: <span className="text-red-600 font-black">{formatRupiah(totalCashAdvance)}</span>
              </p>
            </div>

            <div className="bg-emerald-50/70 p-2.5 rounded-2xl border border-emerald-300">
              <div className="flex items-center gap-1 text-emerald-800 text-[10px] font-bold">
                <CheckCircle2 size={12} />
                <span>Total Take Home Pay</span>
              </div>
              <p className="text-xs font-black text-emerald-800 mt-0.5 truncate">{formatRupiah(totalTHP)}</p>
            </div>
          </div>
        )}

        {/* Configurations & Search */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 shrink-0 border-b border-suka-gray-100 pb-2">
            <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={updateExisting}
                  onChange={(e) => setUpdateExisting(e.target.checked)}
                  className="rounded text-suka-orange focus:ring-suka-orange cursor-pointer"
                />
                <span>Update data jika sudah ada (Upsert)</span>
              </label>

              <div className="flex items-center gap-1">
                <span className="text-stone-500">Periode Payroll:</span>
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="rounded-lg border border-stone-300 px-2 py-0.5 text-xs font-bold bg-white"
                >
                  <option value={1}>Januari</option>
                  <option value={2}>Februari</option>
                  <option value={3}>Maret</option>
                  <option value={4}>April</option>
                  <option value={5}>Mei</option>
                  <option value={6}>Juni</option>
                  <option value={7}>Juli</option>
                  <option value={8}>Agustus</option>
                  <option value={9}>September</option>
                  <option value={10}>Oktober</option>
                  <option value={11}>November</option>
                  <option value={12}>Desember</option>
                </select>
                <input
                  type="number"
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="w-16 rounded-lg border border-stone-300 px-2 py-0.5 text-xs font-bold text-center"
                />
              </div>
            </div>

            {/* Search filter in preview */}
            <div className="relative w-44 sm:w-56">
              <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama / outlet..."
                className="w-full rounded-xl border border-stone-300 pl-8 pr-3 py-1 text-xs outline-none focus:border-suka-orange"
              />
            </div>
          </div>
        )}

        {/* Interactive Preview Table with All Breakdown Columns */}
        {rows.length > 0 && (
          <div className="flex-1 overflow-y-auto rounded-2xl border border-suka-gray-200 min-h-[240px]">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-[#FDF9F3] border-b border-suka-gray-200 text-suka-brown font-bold uppercase tracking-wider z-10 select-none text-[11px]">
                <tr>
                  <th
                    onClick={() => handleSort('no')}
                    className="p-2 w-10 text-center cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center justify-center gap-0.5">
                      <span>#</span>
                      {renderSortIcon('no')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('name')}
                    className="p-2 cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center gap-1">
                      <span>Nama &amp; User</span>
                      {renderSortIcon('name')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('role')}
                    className="p-2 cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center gap-1">
                      <span>Role</span>
                      {renderSortIcon('role')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('outlet')}
                    className="p-2 cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center gap-1">
                      <span>Outlet</span>
                      {renderSortIcon('outlet')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('basicSalary')}
                    className="p-2 text-right cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Gaji Pokok</span>
                      {renderSortIcon('basicSalary')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('mealAllowance')}
                    className="p-2 text-right cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Tunj. Makan</span>
                      {renderSortIcon('mealAllowance')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('overtime')}
                    className="p-2 text-right cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Lembur</span>
                      {renderSortIcon('overtime')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('cashAdvance')}
                    className="p-2 text-right cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Kasbon</span>
                      {renderSortIcon('cashAdvance')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('totalSalary')}
                    className="p-2 text-right cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Total Gaji</span>
                      {renderSortIcon('totalSalary')}
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('status')}
                    className="p-2 text-center cursor-pointer hover:bg-stone-100 transition-colors group"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span>Status</span>
                      {renderSortIcon('status')}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-suka-gray-100">
                {displayRows.map((r) => {
                  const origIdx = r._originalIndex
                  return (
                    <tr key={origIdx} className="hover:bg-amber-50/20 transition-colors">
                      <td className="p-2 text-center text-gray-400 font-mono">{r.no || origIdx + 1}</td>
                      <td className="p-2">
                        <div className="font-black text-suka-ink leading-tight">{r.name}</div>
                        <div className="text-[10px] font-mono text-suka-gray-500">@{r.username}</div>
                      </td>
                      <td className="p-2">
                        <select
                          value={r.role}
                          onChange={(e) => handleUpdateRowRole(origIdx, e.target.value as Role)}
                          className="rounded-lg border border-stone-300 px-1.5 py-0.5 text-xs font-semibold bg-white cursor-pointer"
                        >
                          {ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role.replace('_', ' ').toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2">
                        <select
                          value={r.outletId}
                          onChange={(e) => handleUpdateRowOutlet(origIdx, e.target.value)}
                          className={`rounded-lg border px-1.5 py-0.5 text-xs font-semibold bg-white cursor-pointer max-w-[140px] truncate ${
                            r.isOutletMatched
                              ? 'border-stone-300 text-suka-ink'
                              : 'border-amber-400 bg-amber-50 text-amber-900'
                          }`}
                        >
                          {outlets.map((o) => (
                            <option key={o.id} value={o.id}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-stone-800">
                        {formatRupiah(r.basicSalary)}
                      </td>
                      <td className="p-2 text-right font-mono text-blue-700">
                        {formatRupiah(r.mealAllowance)}
                      </td>
                      <td className="p-2 text-right font-mono text-emerald-700 font-bold">
                        {r.overtime > 0 ? formatRupiah(r.overtime) : '-'}
                      </td>
                      <td className="p-2 text-right font-mono text-red-600 font-bold">
                        {r.cashAdvance > 0 ? formatRupiah(r.cashAdvance) : '-'}
                      </td>
                      <td className="p-2 text-right font-mono font-black text-suka-brown">
                        {formatRupiah(r.totalSalary)}
                      </td>
                      <td className="p-2 text-center">
                        <select
                          value={r.status}
                          onChange={(e) => handleUpdateRowStatus(origIdx, e.target.value as StaffStatus)}
                          className={`rounded-lg px-1.5 py-0.5 text-[10px] font-bold border cursor-pointer ${
                            r.status === 'active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          <option value="active">Aktif</option>
                          <option value="inactive">Non-Aktif</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Execution Summary Report */}
        {summary && (
          <div className="p-3.5 bg-stone-50 rounded-2xl border border-stone-200 text-xs shrink-0 space-y-1">
            <div className="font-extrabold text-suka-ink text-sm">Hasil Eksekusi Import:</div>
            <p className="text-stone-700">
              Total <strong>{summary.total}</strong> data diproses &bull;{' '}
              <strong className="text-emerald-700">{summary.insertedCount} Baru Ditambahkan</strong> &bull;{' '}
              <strong className="text-blue-700">{summary.updatedCount} Diperbarui (Financials &amp; Payroll)</strong> &bull;{' '}
              <strong className="text-red-700">{summary.failedCount} Gagal</strong>
            </p>
            {summary.errors.length > 0 && (
              <div className="mt-1 text-red-600 space-y-0.5 max-h-20 overflow-y-auto">
                {summary.errors.map((e, i) => (
                  <div key={i}>
                    • <strong>{e.name}</strong>: {e.error}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex justify-between items-center pt-2 border-t border-suka-gray-100 shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={importing}
            className="rounded-xl font-bold text-xs"
          >
            Tutup
          </Button>

          <Button
            type="button"
            disabled={importing || rows.length === 0}
            onClick={handleExecuteImport}
            className="rounded-xl font-bold text-xs bg-suka-orange hover:bg-suka-orange/90 text-white flex items-center gap-2 px-6 shadow-md"
          >
            {importing ? (
              <>
                <Spinner size={14} />
                <span>Sedang Memproses Database &amp; Payroll...</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                <span>Simpan {rows.length} Karyawan &amp; Sinkron Payroll Jan 2026</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
