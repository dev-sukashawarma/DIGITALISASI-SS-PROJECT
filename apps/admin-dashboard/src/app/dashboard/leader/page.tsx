import React from 'react'
import { LayoutDashboard, TrendingUp, Package, Banknote, ArrowRight, Store, Receipt, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatRupiah } from '@/lib/validations'
import Link from 'next/link'

export default async function LeaderDashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return (
      <div className="p-6 max-w-lg mx-auto font-sans">
        <p className="text-red-600 font-medium">Sesi Anda telah berakhir. Silakan masuk kembali.</p>
      </div>
    )
  }

  // Embed WAJIB di-disambiguasi ke FK langsung: staff_outlets (many-to-many)
  // membentuk relasi KEDUA outlet_staff↔outlets, sehingga `outlets(name)` polos
  // dibalas error PGRST201 oleh PostgREST → staff selalu null → halaman ini
  // selalu jatuh ke layar "belum ditugaskan" walau outletnya jelas ada.
  const { data: staff } = await supabase
    .from('outlet_staff')
    .select('id, outlet_id, outlets!outlet_staff_outlet_id_fkey(name)')
    .eq('id', user.id)
    .maybeSingle()

  const pickName = (rel: unknown) =>
    (Array.isArray(rel)
      ? (rel[0] as { name?: string } | undefined)?.name
      : (rel as { name?: string } | null)?.name) || null

  // Sumber kebenaran scope = helper yang sama dipakai RLS (orders, petty cash, dll).
  // Untuk leader ini berarti outlet binaan lewat staff_outlets.
  const { data: accessible } = await supabase.rpc('accessible_outlet_ids')
  let outletIds: string[] = Array.isArray(accessible)
    ? ((accessible as unknown[])
        .map((v) => (typeof v === 'string' ? v : (v as { accessible_outlet_ids?: string })?.accessible_outlet_ids))
        .filter(Boolean) as string[])
    : []

  // Fallback bila RPC tak mengembalikan apa pun: outlet langsung + pemetaan staff_outlets.
  if (outletIds.length === 0) {
    const ids = new Set<string>()
    if (staff?.outlet_id) ids.add(staff.outlet_id)
    if (staff?.id) {
      const { data: mapped } = await supabase
        .from('staff_outlets')
        .select('outlet_id')
        .eq('staff_id', staff.id)
      for (const m of (mapped || []) as { outlet_id: string }[]) {
        if (m.outlet_id) ids.add(m.outlet_id)
      }
    }
    outletIds = Array.from(ids)
  }

  const primaryOutletId =
    staff?.outlet_id && outletIds.includes(staff.outlet_id)
      ? staff.outlet_id
      : outletIds[0] || staff?.outlet_id || null

  const outletNames = new Map<string, string>()
  if (outletIds.length > 0) {
    const { data: outletRows } = await supabase.from('outlets').select('id, name').in('id', outletIds)
    for (const o of (outletRows || []) as { id: string; name: string }[]) {
      outletNames.set(o.id, o.name)
    }
  }

  const outletName =
    (primaryOutletId ? outletNames.get(primaryOutletId) : null) || pickName(staff?.outlets) || 'Cabang'
  const headerTitle = outletIds.length > 1 ? `${outletIds.length} Cabang Binaan` : outletName

  const today = new Date(new Date().getTime() + 7 * 3600 * 1000).toISOString().split('T')[0]
  const fromStart = `${today}T00:00:00.000+07:00`
  const toEnd = `${today}T23:59:59.999+07:00`

  // Omzet POS hari ini. Tanpa filter outlet pun RLS `orders_select_scoped` sudah
  // membatasi ke outlet yang boleh diakses — filter .in() hanya mempersempit,
  // jadi angkanya tak pernah bocor lintas cabang.
  let ordersQuery = supabase
    .from('orders')
    .select('outlet_id, total_amount, created_at')
    .eq('status', 'completed')
    .gte('created_at', fromStart)
    .lte('created_at', toEnd)
  if (outletIds.length > 0) ordersQuery = ordersQuery.in('outlet_id', outletIds)

  const { data: orders } = await ordersQuery
  const orderRows = (orders || []) as { outlet_id: string; total_amount: number | string; created_at: string }[]

  const penjualanHariIni = orderRows.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0)
  const jumlahTransaksi = orderRows.length
  const rataRataTransaksi = jumlahTransaksi > 0 ? penjualanHariIni / jumlahTransaksi : 0

  const omzetPerOutlet = new Map<string, { omzet: number; trx: number }>()
  for (const o of orderRows) {
    const cur = omzetPerOutlet.get(o.outlet_id) || { omzet: 0, trx: 0 }
    cur.omzet += Number(o.total_amount) || 0
    cur.trx += 1
    omzetPerOutlet.set(o.outlet_id, cur)
  }
  const breakdown = outletIds
    .map((id) => ({
      id,
      name: outletNames.get(id) || 'Cabang',
      omzet: omzetPerOutlet.get(id)?.omzet || 0,
      trx: omzetPerOutlet.get(id)?.trx || 0,
    }))
    .sort((a, b) => b.omzet - a.omzet)

  const transaksiTerakhir = orderRows.map((o) => o.created_at).sort().pop()
  const jamTerakhir = transaksiTerakhir
    ? new Date(transaksiTerakhir).toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta',
      })
    : null

  let sisaPettyCash = 0
  let isPettyCashHampirHabis = false
  let activeShift: {
    admin_petty_cash_note?: string | null
    admin_petty_cash_updated_at?: string | null
  } | null = null
  let stockCount = 0
  let uniqueHadir = 0
  let expectedStaff = 0

  if (primaryOutletId) {
    const { data: shift } = await supabase
      .from('shifts')
      .select('id, starting_petty_cash, start_time, admin_petty_cash_balance, admin_petty_cash_note, admin_petty_cash_updated_at')
      .eq('outlet_id', primaryOutletId)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .maybeSingle()

    activeShift = shift

    if (shift) {
      const { data: topups } = await supabase
        .from('petty_cash_topups')
        .select('amount')
        .eq('outlet_id', primaryOutletId)
        .eq('status', 'completed')
        .gte('created_at', shift.start_time)

      const { data: expenses } = await supabase
        .from('petty_cash_expenses')
        .select('amount')
        .eq('outlet_id', primaryOutletId)
        .gte('created_at', shift.start_time)

      const totalTopups = (topups || []).reduce((sum, t) => sum + Number(t.amount), 0)
      const totalExpenses = (expenses || []).reduce((sum, e) => sum + Number(e.amount), 0)

      sisaPettyCash = Number(shift.starting_petty_cash) + totalTopups - totalExpenses
      const { data: sharedBalance, error: sharedBalanceError } = await supabase.rpc('get_petty_cash_balance', {
        p_outlet_id: primaryOutletId,
      })
      if (!sharedBalanceError) sisaPettyCash = Number(sharedBalance) || 0
      if (sisaPettyCash < 150000) isPettyCashHampirHabis = true
    }

    const { count: stok } = await supabase
      .from('inventory_batches')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', primaryOutletId)
      .gt('qty_remaining', 0)
    stockCount = stok || 0

    const { count: totalStaff } = await supabase
      .from('outlet_staff')
      .select('id', { count: 'exact', head: true })
      .eq('outlet_id', primaryOutletId)
      .eq('status', 'active')
    expectedStaff = totalStaff || 0

    const { data: clockIns } = await supabase
      .from('attendance')
      .select('outlet_staff_id')
      .eq('outlet_id', primaryOutletId)
      .eq('type', 'in')
      .gte('ts_server', fromStart)
      .lte('ts_server', toEnd)
    uniqueHadir = new Set((clockIns || []).map((c) => c.outlet_staff_id)).size
  }

  return (
    <div className="max-w-4xl mx-auto w-full font-sans pb-12">
      {/* Header Minimalist */}
      <div className="mb-8 mt-2 px-1">
        <p className="text-sm font-semibold text-suka-orange mb-1 uppercase tracking-wider">Dashboard Utama</p>
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight leading-tight">{headerTitle}</h1>
      </div>

      {!primaryOutletId && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-amber-50 ring-1 ring-amber-100 p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-900">Akun belum ditugaskan ke cabang</p>
            <p className="text-xs font-medium text-amber-700 mt-0.5">
              Omzet POS di bawah mengikuti hak akses akun Anda. Hubungi admin untuk penugasan outlet agar petty cash,
              stok, dan kehadiran ikut tampil.
            </p>
          </div>
        </div>
      )}

      {/* Grid Status - Mobile First List/Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">

        {/* Sales Card */}
        <div className="bg-white p-6 rounded-[20px] shadow-sm ring-1 ring-slate-100 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Omzet POS Hari Ini</p>
            <TrendingUp className="w-5 h-5 text-suka-orange" />
          </div>
          <div>
            <h3 className="text-4xl font-extrabold text-slate-900 tracking-tighter mb-1">{formatRupiah(penjualanHariIni)}</h3>
            <p className="text-sm font-medium text-slate-500">
              {jumlahTransaksi} transaksi{jamTerakhir ? ` · terakhir ${jamTerakhir}` : ''}
            </p>
          </div>
        </div>

        {/* Petty Cash Card */}
        <div className="bg-white p-6 rounded-[20px] shadow-sm ring-1 ring-slate-100 flex flex-col justify-between h-full">
          <div className="flex items-start justify-between mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sisa Petty Cash</p>
            <Banknote className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h3 className={`text-4xl font-extrabold tracking-tighter mb-1 ${sisaPettyCash < 0 || isPettyCashHampirHabis ? 'text-red-600' : 'text-slate-900'}`}>
              {formatRupiah(sisaPettyCash)}
            </h3>
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-500">
                {activeShift ? 'Shift Aktif' : 'Tidak ada shift'}
              </p>
              {isPettyCashHampirHabis && (
                <span className="px-2 py-0.5 text-[10px] font-bold bg-red-50 text-red-600 rounded-md uppercase tracking-wider">Kritis</span>
              )}
            </div>
            {activeShift?.admin_petty_cash_updated_at && (
              <p className="mt-2 text-xs font-semibold text-blue-600">
                Disesuaikan Admin{activeShift.admin_petty_cash_note ? `: ${activeShift.admin_petty_cash_note}` : ''}
              </p>
            )}
          </div>
        </div>

        {/* Stat kecil: rata-rata, stok, kehadiran, cabang */}
        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
          <div className="bg-white p-5 rounded-[20px] shadow-sm ring-1 ring-slate-100 flex flex-col justify-between">
            <div className="flex justify-between mb-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Rata-rata / Transaksi</p>
              <Receipt className="w-4 h-4 text-suka-orange" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tighter">{formatRupiah(rataRataTransaksi)}</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Omzet dibagi transaksi</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] shadow-sm ring-1 ring-slate-100 flex flex-col justify-between">
            <div className="flex justify-between mb-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Stok Cabang</p>
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tighter">{stockCount}</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Item tersedia</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] shadow-sm ring-1 ring-slate-100 flex flex-col justify-between">
            <div className="flex justify-between mb-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Kehadiran</p>
              <LayoutDashboard className="w-4 h-4 text-blue-500" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tighter">{uniqueHadir}/{expectedStaff}</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Tim hadir hari ini</p>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[20px] shadow-sm ring-1 ring-slate-100 flex flex-col justify-between">
            <div className="flex justify-between mb-4">
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cabang Binaan</p>
              <Store className="w-4 h-4 text-slate-400" />
            </div>
            <div>
              <h3 className="text-2xl font-extrabold text-slate-900 tracking-tighter">{outletIds.length}</h3>
              <p className="text-[11px] font-medium text-slate-500 mt-0.5">Outlet dalam akses Anda</p>
            </div>
          </div>
        </div>
      </div>

      {/* Rincian omzet per cabang */}
      {breakdown.length > 0 && (
        <div className="mb-10 bg-white rounded-[20px] shadow-sm ring-1 ring-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">Omzet per Cabang</h2>
            <Link href="/dashboard/leader/sales" className="text-xs font-bold text-suka-orange hover:underline">
              Detail
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {breakdown.map((row) => (
              <div key={row.id} className="px-6 py-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-900 truncate">{row.name}</p>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">{row.trx} transaksi hari ini</p>
                </div>
                <p className="text-sm font-extrabold text-slate-900 whitespace-nowrap">{formatRupiah(row.omzet)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Links - Mobile Optimized list */}
      <div className="px-1">
        <h2 className="text-sm font-bold text-slate-900 mb-4 px-1">Aksi Cepat</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/dashboard/leader/petty-cash"
            className="group relative flex items-center justify-between p-4 bg-slate-900 hover:bg-black rounded-2xl transition-all shadow-sm active:scale-[0.98]"
          >
            <div className="flex flex-col">
              <span className="text-white font-bold text-sm">Top Up Petty Cash</span>
              <span className="text-slate-400 text-xs font-medium mt-0.5">Ajukan pencairan dana operasional</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-colors">
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>

          <Link
            href="/dashboard/leader/stock"
            className="group relative flex items-center justify-between p-4 bg-white hover:bg-slate-50 rounded-2xl transition-all shadow-sm ring-1 ring-slate-200 active:scale-[0.98]"
          >
            <div className="flex flex-col">
              <span className="text-slate-900 font-bold text-sm">Cek Stok Cabang</span>
              <span className="text-slate-500 text-xs font-medium mt-0.5">Pantau dan update sisa bahan baku</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 transition-colors">
              <ArrowRight className="w-4 h-4" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
