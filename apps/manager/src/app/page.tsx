export const dynamic = 'force-dynamic';
export const revalidate = 0;

import React from 'react';
import Link from 'next/link';
import { TrendingUp, TrendingDown, Clock, AlertTriangle, ListChecks, Calendar, Trash2 } from 'lucide-react';
import RankingList from './RankingList';
import { CustomDateFilter } from '../components/CustomDateFilter';
import ZonePerformanceTable from '../components/ZonePerformanceTable';
import { BonusKpiCard } from '../components/BonusKpiCard';
import { cookies, headers } from 'next/headers';
import { createSupabaseServerClient, parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';
import { presetRange, previousRange, type Preset } from '../lib/period';
import { TEST_OUTLET_ID, isTestOutlet } from '@/lib/outletFilters';
import { computeOrderGross, mapEcommerceSaleToOrder } from '../lib/posReportKpi';

const formatRupiah = (amount: number) => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount);
};

const formatWIBTime = (tsServerStr: string) => {
  try {
    const d = new Date(tsServerStr)
    return d.toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).replace(':', '.') + ' WIB'
  } catch {
    return ''
  }
};

/**
 * Mengabaikan nama akun staff AM dummy/uji saat membangun peta AM dari `staff_outlets`,
 * tetapi TIDAK menyembunyikan outlet yang belum memiliki AM (masuk grup "Mitra" / "Lainnya").
 */
const isIgnoredAMStaffName = (name: string) => {
  if (!name) return true;
  const n = name.trim().toUpperCase();
  return (
    n.startsWith('AREA MANAGER') ||
    n.includes('TEST') ||
    n.includes('TES ') ||
    n === 'TES' ||
    n === 'ADMIN' ||
    n === 'DEVELOPER' ||
    n === 'LAINNYA' ||
    n === 'LAIN-LAIN' ||
    n === 'OTHER' ||
    n === 'OTHERS'
  );
};

const getAMName = (
  outletId: string,
  outletName: string,
  amMap: Map<string, string>,
  staffRole?: string,
  staffName?: string,
  outletRegion?: string | null
) => {
  if (staffRole === 'area_manager') {
    return staffName || 'Area Anda';
  }

  if (amMap.has(outletId)) {
    const mapped = amMap.get(outletId)!;
    if (!isIgnoredAMStaffName(mapped)) {
      return mapped;
    }
  }

  const name = (outletName || '').toUpperCase();

  if (name.includes('EMPANG') || name.includes('BCC') || name.includes('DRAMAGA') || name.includes('PALEDANG') || name.includes('CICURUG') || name.includes('CIMANGGU')) {
    return 'Abu Bakar';
  }
  if (name.includes('CIBINONG') || name.includes('CISEENG') || name.includes('SENTUL') || name.includes('PAJAJARAN')) {
    return 'Muchtar';
  }
  if (name.includes('SUKMAJAYA') || name.includes('BEJI') || name.includes('SAWANGAN') || name.includes('CIRENDEU') || name.includes('JAGAKARSA') || name.includes('PAMULANG')) {
    return 'Chairul Rizky';
  }
  if (name.includes('KALISARI') || name.includes('CIBUBUR') || name.includes('CILENGSI') || name.includes('CILEUNGSI')) {
    return 'Tri Rizky';
  }
  if (name.includes('PEKAYON') || name.includes('JATIASIH') || name.includes('JATIWARINGIN')) {
    return 'Mulyadi';
  }

  if (outletRegion && !isIgnoredAMStaffName(outletRegion)) {
    return outletRegion.trim();
  }

  if (name.startsWith('MITRA')) {
    return 'Mitra';
  }

  return 'Lainnya';
};

export default async function DashboardOverview(props: { searchParams?: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams;
  const period = (searchParams?.period as string) || 'today';
  
  const cookieStore = await cookies();
  const headersList = await headers();
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER));

  let mainStartDate: string;
  let mainEndDate: string;
  let prevStartDate: string;
  let prevEndDate: string;

  if (period === 'custom') {
    const fromParam = searchParams?.from as string;
    const toParam = searchParams?.to as string;
    if (fromParam && toParam) {
      mainStartDate = fromParam;
      mainEndDate = toParam;
      const prev = previousRange({ from: fromParam, to: toParam });
      prevStartDate = prev.from;
      prevEndDate = prev.to;
    } else {
      const cur = presetRange('today');
      mainStartDate = cur.from;
      mainEndDate = cur.to;
      const prev = previousRange(cur);
      prevStartDate = prev.from;
      prevEndDate = prev.to;
    }
  } else {
    const validPreset: Preset = (['today', 'yesterday', 'week', 'month', '7d', '30d', 'this_month'].includes(period)
      ? period
      : 'today') as Preset;
    const cur = presetRange(validPreset);
    mainStartDate = cur.from;
    mainEndDate = cur.to;
    const prev = previousRange(cur);
    prevStartDate = prev.from;
    prevEndDate = prev.to;
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Supabase PostgREST max-rows default = 1000, cannot be overridden by .limit().
  // Use manual pagination with .range() on a fresh query builder per page to fetch all rows deterministically.
  const fetchAllPages = async (buildQuery: () => any): Promise<any[]> => {
    const PAGE = 1000;
    let all: any[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await buildQuery().range(from, from + PAGE - 1);
      if (error || !data || data.length === 0) break;
      all = all.concat(data);
      if (data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  };

  let accessibleOutlets: string[] = [];
  if (staff?.role === 'area_manager') {
    const { data: so } = await supabaseAdmin.from('staff_outlets').select('outlet_id').eq('staff_id', staff.id);
    const assignedIds = [
      ...((so || []).map((s: any) => s.outlet_id)),
      ...(staff.outlet_id ? [staff.outlet_id] : [])
    ];
    const uniqueIds = Array.from(new Set(assignedIds));
    if (uniqueIds.length > 0) {
      accessibleOutlets = uniqueIds;
    } else {
      accessibleOutlets = ['00000000-0000-0000-0000-000000000000'];
    }
  }

  const filterOutletId = searchParams?.outlet_id as string | undefined;
  const isFullAccess = !staff || ['regional_manager', 'admin', 'owner', 'developer'].includes(staff.role);
  const includeEcommerce = isFullAccess && (!filterOutletId || filterOutletId === 'all' || filterOutletId === 'ss-online');
  const shouldFetchPosOrders = filterOutletId !== 'ss-online';

  const applyOutletFilter = <T,>(query: T, col: string = 'outlet_id'): T => {
    const q = query as any;
    if (staff?.role === 'area_manager') {
      if (filterOutletId && filterOutletId !== 'all' && accessibleOutlets.includes(filterOutletId)) {
        return q.eq(col, filterOutletId);
      }
      return q.in(col, accessibleOutlets);
    } else if (isFullAccess) {
      if (filterOutletId && filterOutletId !== 'all' && filterOutletId !== 'ss-online') {
        return q.eq(col, filterOutletId);
      }
      return q;
    } else if (staff?.outlet_id) {
      return q.eq(col, staff.outlet_id);
    }
    return q;
  };

  // Outlet uji developer jangan masuk perhitungan (lihat @/lib/outletFilters).
  // Disaring di daftar outlet DAN di tiap agregat di bawah — menyaring
  // daftarnya saja tidak cukup, omzet/waste dijumlahkan dari tabel mentah.
  const qOutlets = applyOutletFilter(
    supabaseAdmin.from('outlets').select('id, name, is_active, region, type').neq('id', TEST_OUTLET_ID).order('name'),
    'id'
  );

  const buildOrdersQuery = (startDate: string, endDate: string) =>
    applyOutletFilter(
      supabaseAdmin
        .from('orders')
        .select('id, outlet_id, status, total_amount, discount_amount, promo_subsidy, channel, sales_source, created_at, order_items(quantity, subtotal, unit_price)')
        .gte('created_at', `${startDate}T00:00:00+07:00`)
        .lte('created_at', `${endDate}T23:59:59.999+07:00`)
        .in('status', ['completed', 'settled'])
        .neq('outlet_id', TEST_OUTLET_ID)
        // `id` sebagai pemecah seri: created_at bisa kembar, dan paginasi tanpa
        // urutan unik bisa melompati/menggandakan baris antar halaman.
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      'outlet_id'
    );

  const buildEcommerceQuery = (startDate: string, endDate: string) =>
    supabaseAdmin
      .from('ecommerce_sales')
      .select('*')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true })
      .order('id', { ascending: true });

  const qAttendance = applyOutletFilter(
    supabaseAdmin.from('attendance')
      .select('outlet_id, ts_server, type, outlet_staff_id')
      .gte('ts_server', `${mainEndDate}T00:00:00+07:00`)
      .lte('ts_server', `${mainEndDate}T23:59:59.999+07:00`)
      .order('ts_server', { ascending: true }),
    'outlet_id'
  );

  const qStaffOutlets = applyOutletFilter(
    supabaseAdmin.from('staff_outlets')
      .select('outlet_id, staff_id, outlet_staff(name, role, is_active)')
      .order('staff_id'),
    'outlet_id'
  );

  const buildWasteApprovedQuery = () =>
    applyOutletFilter(
      supabaseAdmin
        .from('stok_waste_reports')
        .select('bahan_baku_id, qty, outlets!inner(id, type), bahan_baku!inner(id)')
        .eq('status', 'APPROVED')
        .neq('outlet_id', TEST_OUTLET_ID)
        .gte('created_at', `${mainStartDate}T00:00:00+07:00`)
        .lte('created_at', `${mainEndDate}T23:59:59.999+07:00`)
        // Dipaginasi (fetchAllPages) dengan urutan unik: dulu terpotong diam-diam
        // di 1.000 baris sehingga "kerugian waste" periode panjang kurang hitung.
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
      'outlet_id'
    );

  const qWastePending = applyOutletFilter(
    supabaseAdmin
      .from('stok_waste_reports')
      .select('id', { count: 'exact', head: true })
      .neq('outlet_id', TEST_OUTLET_ID)
      .eq('status', 'PENDING'),
    'outlet_id'
  );

  const [
    rawPosOrdersToday,
    rawPosOrdersYesterday,
    ecommerceSalesToday,
    ecommerceSalesYesterday,
    { data: rawOutlets },
    { data: attendanceToday },
    { data: staffOutlets },
    wasteApprovedData,
    { count: pendingWasteCount }
  ] = await Promise.all([
    shouldFetchPosOrders ? fetchAllPages(() => buildOrdersQuery(mainStartDate, mainEndDate)) : Promise.resolve([]),
    shouldFetchPosOrders ? fetchAllPages(() => buildOrdersQuery(prevStartDate, prevEndDate)) : Promise.resolve([]),
    includeEcommerce ? fetchAllPages(() => buildEcommerceQuery(mainStartDate, mainEndDate)) : Promise.resolve([]),
    includeEcommerce ? fetchAllPages(() => buildEcommerceQuery(prevStartDate, prevEndDate)) : Promise.resolve([]),
    qOutlets,
    qAttendance,
    qStaffOutlets,
    fetchAllPages(buildWasteApprovedQuery),
    qWastePending
  ]);

  const outlets = (rawOutlets || []).filter((o: any) => !isTestOutlet(o));
  const validOutletIdSet = new Set(outlets.map((o: any) => o.id));

  const posOrdersToday = (rawPosOrdersToday || []).filter((o: any) => validOutletIdSet.has(o.outlet_id));
  const posOrdersYesterday = (rawPosOrdersYesterday || []).filter((o: any) => validOutletIdSet.has(o.outlet_id));

  const ordersToday = [
    ...posOrdersToday,
    ...(ecommerceSalesToday || []).map(mapEcommerceSaleToOrder),
  ];
  const ordersYesterday = [
    ...posOrdersYesterday,
    ...(ecommerceSalesYesterday || []).map(mapEcommerceSaleToOrder),
  ];

  // Samakan 100% dengan Dashboard Admin (computeOrderGross):
  // - Walk-in/Offline: merekonstruksi Gross dari total_amount + diskon kasir
  // - Food Apps: total_amount sudah merupakan Harga Jual (Gross)
  // - SS Online (ecommerce_sales): omzet_net + total_potongan = Gross
  const getOrderGrossRevenue = (o: any) => computeOrderGross(o);

  const omzetToday = (ordersToday || []).reduce((sum, o) => sum + getOrderGrossRevenue(o), 0);
  const txToday = (ordersToday || []).length;
  const omzetYesterday = (ordersYesterday || []).reduce((sum, o) => sum + getOrderGrossRevenue(o), 0);

  const sumOrderItems = (order: any) => {
    const items = order.order_items || [];
    // @ts-ignore
    return items.reduce((s, item) => s + (Number(item.quantity) || 0), 0);
  };

  const itemsSoldToday = (ordersToday || []).reduce((sum, order) => sum + sumOrderItems(order), 0);
  const itemsSoldYesterday = (ordersYesterday || []).reduce((sum, order) => sum + sumOrderItems(order), 0);

  // Samakan 100% dengan RPC Bonus di Dashboard Admin (get_monthly_rm_bonus, get_monthly_am_bonus, get_monthly_crew_bonus):
  // 1. Hanya menghitung outlet operasional (bukan marketplace/SS Online, bukan tes/test/trial/demo/backup/kantor pusat/gudang)
  // 2. Hanya menghitung order POS dengan status === 'completed'
  const isBonusOperationalOutlet = (outlet?: { id?: string; name?: string | null; type?: string | null } | null): boolean => {
    if (!outlet || !outlet.id) return false;
    if (outlet.id === TEST_OUTLET_ID) return false;
    if (outlet.type === 'marketplace') return false;
    const lower = (outlet.name || '').toLowerCase();
    if (
      lower.includes('tes') ||
      lower.includes('test') ||
      lower.includes('trial') ||
      lower.includes('demo') ||
      lower.includes('backup') ||
      lower.includes('kantor pusat') ||
      lower.includes('gudang')
    ) {
      return false;
    }
    return true;
  };

  const bonusOutletIdSet = new Set(
    (outlets || []).filter(isBonusOperationalOutlet).map((o: any) => o.id)
  );

  const bonusOrdersToday = (posOrdersToday || []).filter(
    (o: any) => o.status === 'completed' && bonusOutletIdSet.has(o.outlet_id)
  );
  const bonusOrdersYesterday = (posOrdersYesterday || []).filter(
    (o: any) => o.status === 'completed' && bonusOutletIdSet.has(o.outlet_id)
  );

  const bonusItemsToday = bonusOrdersToday.reduce((sum: number, o: any) => sum + sumOrderItems(o), 0);
  const bonusItemsYesterday = bonusOrdersYesterday.reduce((sum: number, o: any) => sum + sumOrderItems(o), 0);

  let bonusTodayAmount = bonusItemsToday * 50;
  let bonusYesterdayAmount = bonusItemsYesterday * 50;
  let bonusSubtitle = `${bonusItemsToday.toLocaleString('id-ID')} pcs × Rp 50/pcs`;

  if (staff?.role === 'leader' || staff?.role === 'crew') {
    const targetOutletIds = Array.from(bonusOutletIdSet);
    if (targetOutletIds.length > 0) {
      const [
        { data: eligibleStaffRows },
        { data: attMainRows },
        { data: attPrevRows },
        { data: attLogMainRows },
        { data: attLogPrevRows }
      ] = await Promise.all([
        supabaseAdmin
          .from('outlet_staff')
          .select('id, name, outlet_id, role, is_active, is_bonus_eligible, onboarding_stage, account_category')
          .in('role', ['crew', 'leader']),
        supabaseAdmin
          .from('attendance')
          .select('outlet_id, outlet_staff_id, ts_server, type, status')
          .in('outlet_id', targetOutletIds)
          .in('type', ['in', 'masuk'])
          .gte('ts_server', `${mainStartDate}T00:00:00+07:00`)
          .lte('ts_server', `${mainEndDate}T23:59:59.999+07:00`),
        supabaseAdmin
          .from('attendance')
          .select('outlet_id, outlet_staff_id, ts_server, type, status')
          .in('outlet_id', targetOutletIds)
          .in('type', ['in', 'masuk'])
          .gte('ts_server', `${prevStartDate}T00:00:00+07:00`)
          .lte('ts_server', `${prevEndDate}T23:59:59.999+07:00`),
        supabaseAdmin
          .from('attendance_logs')
          .select('outlet_id, staff_id, date, status')
          .in('outlet_id', targetOutletIds)
          .eq('status', 'hadir')
          .gte('date', mainStartDate)
          .lte('date', mainEndDate),
        supabaseAdmin
          .from('attendance_logs')
          .select('outlet_id, staff_id, date, status')
          .in('outlet_id', targetOutletIds)
          .eq('status', 'hadir')
          .gte('date', prevStartDate)
          .lte('date', prevEndDate),
      ]);

      const eligibleCrewSet = new Set<string>();
      const activeCrewCountByOutlet = new Map<string, number>();

      for (const s of eligibleStaffRows || []) {
        const nameLower = (s.name || '').trim().toLowerCase();
        const isTestStaff =
          nameLower.startsWith('tes ') ||
          nameLower.startsWith('test') ||
          nameLower.includes(' tester') ||
          nameLower.includes('developer') ||
          nameLower.includes('devai') ||
          nameLower === 'tes' ||
          nameLower === 'test';
        const isBonusElig = s.is_bonus_eligible ?? true;
        const stage = s.onboarding_stage ?? 'completed';
        const cat = s.account_category ?? 'employee';

        if (!isTestStaff && isBonusElig && stage !== 'training_7_days' && stage !== 'failed' && cat === 'employee') {
          eligibleCrewSet.add(s.id);
          if (s.is_active && s.outlet_id) {
            activeCrewCountByOutlet.set(s.outlet_id, (activeCrewCountByOutlet.get(s.outlet_id) || 0) + 1);
          }
        }
      }

      const toWibDate = (iso: string) =>
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Jakarta',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(iso));

      const computeDailyProrataBonus = (ordersList: any[], attRows: any[], attLogRows: any[]) => {
        const dailyAttendanceMap = new Map<string, Set<string>>();
        const validAttStat = new Set(['tepat', 'telat', 'hadir', 'masuk', 'telat_toleransi']);

        for (const a of attRows || []) {
          if (!a.outlet_staff_id || !eligibleCrewSet.has(a.outlet_staff_id)) continue;
          if (a.status && !validAttStat.has(a.status)) continue;
          const d = toWibDate(a.ts_server);
          const key = `${a.outlet_id}::${d}`;
          if (!dailyAttendanceMap.has(key)) dailyAttendanceMap.set(key, new Set());
          dailyAttendanceMap.get(key)!.add(a.outlet_staff_id);
        }

        for (const al of attLogRows || []) {
          if (!al.staff_id || !eligibleCrewSet.has(al.staff_id)) continue;
          const key = `${al.outlet_id}::${al.date}`;
          if (!dailyAttendanceMap.has(key)) dailyAttendanceMap.set(key, new Set());
          dailyAttendanceMap.get(key)!.add(al.staff_id);
        }

        const dailyPcsMap = new Map<string, { outletId: string; pcs: number }>();
        for (const o of ordersList) {
          const d = toWibDate(o.created_at);
          const key = `${o.outlet_id}::${d}`;
          const prev = dailyPcsMap.get(key) || { outletId: o.outlet_id, pcs: 0 };
          prev.pcs += sumOrderItems(o);
          dailyPcsMap.set(key, prev);
        }

        let totalPerCrewShare = 0;
        let lastDivider = 1;
        for (const [key, { outletId, pcs }] of dailyPcsMap.entries()) {
          if (pcs <= 0) continue;
          const attSet = dailyAttendanceMap.get(key);
          const cnt = attSet && attSet.size > 0
            ? attSet.size
            : Math.max(activeCrewCountByOutlet.get(outletId) || 1, 1);
          lastDivider = cnt;
          totalPerCrewShare += Math.round((pcs * 100) / cnt);
        }

        return { totalPerCrewShare, lastDivider };
      };

      const curCrewBonus = computeDailyProrataBonus(bonusOrdersToday, attMainRows || [], attLogMainRows || []);
      const prevCrewBonus = computeDailyProrataBonus(bonusOrdersYesterday, attPrevRows || [], attLogPrevRows || []);

      bonusTodayAmount = curCrewBonus.totalPerCrewShare;
      bonusYesterdayAmount = prevCrewBonus.totalPerCrewShare;
      bonusSubtitle = `Pool ${bonusItemsToday.toLocaleString('id-ID')} pcs × Rp 100 ÷ ${curCrewBonus.lastDivider} kru`;
    } else {
      bonusTodayAmount = 0;
      bonusYesterdayAmount = 0;
      bonusSubtitle = '0 pcs × Rp 100/pcs';
    }
  }

  let percentageChange = 0;
  if (omzetYesterday === 0) {
    percentageChange = omzetToday > 0 ? 100 : 0;
  } else {
    percentageChange = ((omzetToday - omzetYesterday) / omzetYesterday) * 100;
  }

  let totalWasteLossToday = 0;
  const validWasteApproved = (wasteApprovedData || []).filter((w: any) => !isTestOutlet(w.outlets));
  if (validWasteApproved.length > 0) {
    const wasteBahanIds = Array.from(new Set(validWasteApproved.map((w: any) => w.bahan_baku_id)));
    const { data: bHarga } = await supabaseAdmin
      .from('bahan_baku_harga')
      .select('bahan_baku_id, harga_beli')
      .in('bahan_baku_id', wasteBahanIds);
    const hargaMap = new Map<string, number>();
    for (const bh of bHarga || []) {
      hargaMap.set(bh.bahan_baku_id, Number(bh.harga_beli) || 0);
    }
    for (const w of validWasteApproved) {
      const h = hargaMap.get(w.bahan_baku_id) || 0;
      totalWasteLossToday += (Number(w.qty) || 0) * h;
    }
  }
  const pendingWasteCountToday = pendingWasteCount || 0;

  const isPositive = percentageChange >= 0;
  const absChange = Math.abs(percentageChange).toFixed(1);

  const allOutlets = (outlets || []).sort((a, b) => {
    const isAMitra = a.name.toUpperCase().startsWith('MITRA');
    const isBMitra = b.name.toUpperCase().startsWith('MITRA');
    if (isAMitra && !isBMitra) return 1;
    if (!isAMitra && isBMitra) return -1;
    return a.name.localeCompare(b.name);
  });

  const outletFirstCheckIn = new Map<string, string>();
  const outletLastCheckOut = new Map<string, string>();
  const outletStaffStateMap = new Map<string, Map<string, 'in' | 'out'>>();

  (attendanceToday || []).forEach((att: any) => {
    const wibTime = new Date(att.ts_server)
      .toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false })
      .replace(':', '.');

    if (att.type === 'in' && !outletFirstCheckIn.has(att.outlet_id)) {
      outletFirstCheckIn.set(att.outlet_id, wibTime);
    }
    if (att.type === 'out') {
      outletLastCheckOut.set(att.outlet_id, wibTime);
    }
    if (att.outlet_staff_id && (att.type === 'in' || att.type === 'out')) {
      if (!outletStaffStateMap.has(att.outlet_id)) {
        outletStaffStateMap.set(att.outlet_id, new Map());
      }
      outletStaffStateMap.get(att.outlet_id)!.set(att.outlet_staff_id, att.type);
    }
  });

  const outletOmzetMap = new Map<string, number>();
  (ordersToday || []).forEach(o => {
    const current = outletOmzetMap.get(o.outlet_id) || 0;
    outletOmzetMap.set(o.outlet_id, current + getOrderGrossRevenue(o));
  });

  const amMap = new Map<string, string>();
  if (staffOutlets) {
    staffOutlets.forEach((so: any) => {
      if (so.outlet_staff && so.outlet_staff.role === 'area_manager' && so.outlet_staff.is_active !== false) {
        const staffName = (so.outlet_staff.name || '').trim();
        if (isIgnoredAMStaffName(staffName)) return;
        amMap.set(so.outlet_id, staffName);
      }
    });
  }

  const activeOutlets = (outlets || []).filter(o => o.is_active);

  const outletRankingBase = activeOutlets.map(outlet => ({
    id: outlet.id,
    name: outlet.name,
    amName: getAMName(outlet.id, outlet.name, amMap, staff?.role, staff?.name, outlet.region),
    omzet: outletOmzetMap.get(outlet.id) || 0
  }));

  const outletRanking = [
    ...outletRankingBase,
    ...(includeEcommerce
      ? [{
          id: 'ss-online',
          name: 'SS ONLINE',
          amName: 'Marketplace',
          omzet: outletOmzetMap.get('ss-online') || 0
        }]
      : [])
  ].sort((a, b) => b.omzet - a.omzet);

  const maxOmzet = outletRanking.length > 0 ? outletRanking[0].omzet : 1;

  const groupedOutlets = new Map<string, any[]>();
  allOutlets.forEach(outlet => {
    const amName = getAMName(outlet.id, outlet.name, amMap, staff?.role, staff?.name, outlet.region);
    const groupKey = amName;
    if (!groupedOutlets.has(groupKey)) {
      groupedOutlets.set(groupKey, []);
    }
    groupedOutlets.get(groupKey)!.push(outlet);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      
      {/* 🌟 Header Section & Segmented Filter Control */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-black text-suka-brown tracking-tight">Ringkasan Area</h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-suka-orange/10 text-suka-orange border border-suka-orange/20">
              USER: {staff?.role ? staff.role.replace('_', ' ').toUpperCase() : 'REGIONAL MANAGER'}
            </span>
          </div>
          <p className="text-xs font-semibold text-suka-gray-400 mt-1">
            Pantau performa pendapatan, transaksi, dan aktivitas cabang secara real-time
          </p>
        </div>

        {/* Segmented Filter Control */}
        <div className="flex items-center gap-0.5 sm:gap-1 bg-suka-brown/[0.04] rounded-2xl p-1 border border-suka-brown/10 shrink-0">
          <Link href="?period=today" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'today' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>Hari Ini</Link>
          <Link href="?period=yesterday" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'yesterday' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>Kemarin</Link>
          <Link href="?period=week" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'week' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>7 Hari</Link>
          <Link href="?period=month" className={`px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-extrabold rounded-xl transition-all whitespace-nowrap ${period === 'month' ? 'bg-suka-orange text-white shadow-xs' : 'text-suka-brown/70 hover:text-suka-brown hover:bg-white/50'}`}>30 Hari</Link>
          <CustomDateFilter />
        </div>
      </div>
      
      {/* 📊 Metrics Grid (Bento KPI Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        
        {/* KPI 1: Pendapatan */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 relative overflow-hidden group hover:border-suka-orange/30 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-suka-gray-400 uppercase tracking-wider">Gross Revenue</h3>
              <div className="p-2.5 bg-suka-orange/10 text-suka-orange rounded-2xl group-hover:scale-110 transition-transform">
                <TrendingUp size={20} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-3 tracking-tight">
              {formatRupiah(omzetToday)}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-suka-brown/5">
            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1 ${
              isPositive ? 'text-emerald-800 bg-emerald-100/80 border border-emerald-200' : 'text-red-700 bg-red-100/80 border border-red-200'
            }`}>
              {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {isPositive ? '+' : '-'}{absChange}% dari periode sebelumnya
            </span>
          </div>
        </div>
        
        {/* KPI 2: Jumlah Transaksi */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 relative overflow-hidden group hover:border-amber-500/30 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-suka-gray-400 uppercase tracking-wider">Jumlah Transaksi</h3>
              <div className="p-2.5 bg-amber-500/10 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
                <Clock size={20} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-3 tracking-tight">
              {txToday} <span className="text-sm font-bold text-suka-gray-400">order</span>
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-suka-brown/5">
            <span className="text-[10px] font-extrabold text-suka-brown/60 bg-suka-brown/5 px-2.5 py-1 rounded-full border border-suka-brown/10 inline-block">
              Selesai pada periode ini
            </span>
          </div>
        </div>

        {/* KPI 3: Jumlah Item Terjual */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 relative overflow-hidden group hover:border-emerald-500/30 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-suka-gray-400 uppercase tracking-wider">Jumlah Item Terjual</h3>
              <div className="p-2.5 bg-emerald-500/10 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
                <ListChecks size={20} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-suka-brown mt-3 tracking-tight">
              {itemsSoldToday} <span className="text-sm font-bold text-suka-gray-400">porsi</span>
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-suka-brown/5">
            <span className="text-[10px] font-extrabold text-suka-brown/60 bg-suka-brown/5 px-2.5 py-1 rounded-full border border-suka-brown/10 inline-block">
              Total Produk pada periode ini
            </span>
          </div>
        </div>

        {/* KPI 4: Kerugian Waste */}
        <div className="bg-white p-6 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 relative overflow-hidden group hover:border-red-500/30 transition-all duration-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-suka-gray-400 uppercase tracking-wider">Kerugian Waste</h3>
              <div className="p-2.5 bg-red-500/10 text-red-600 rounded-2xl group-hover:scale-110 transition-transform">
                <Trash2 size={20} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-red-600 mt-3 tracking-tight">
              {formatRupiah(totalWasteLossToday)}
            </p>
          </div>
          <div className="mt-3 pt-2 border-t border-suka-brown/5 flex items-center justify-between">
            <Link
              href="/waste"
              className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full inline-flex items-center gap-1 transition-all ${
                pendingWasteCountToday > 0
                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                  : 'text-suka-brown/60 bg-suka-brown/5 border border-suka-brown/10 hover:bg-suka-brown/10'
              }`}
            >
              {pendingWasteCountToday > 0 ? (
                <>
                  <AlertTriangle size={12} className="text-amber-600 shrink-0" />
                  <span>{pendingWasteCountToday} butuh approval</span>
                </>
              ) : (
                <span>Lihat Detail Waste &rarr;</span>
              )}
            </Link>
          </div>
        </div>

        {/* KPI 5: Estimasi Bonus & Insentif */}
        <BonusKpiCard
          itemsSoldToday={bonusItemsToday}
          itemsSoldYesterday={bonusItemsYesterday}
          bonusTodayAmount={bonusTodayAmount}
          bonusYesterdayAmount={bonusYesterdayAmount}
          subtitle={bonusSubtitle}
          userRole={staff?.role}
          userName={staff?.name}
        />
      </div>
      
      {/* 🏢 Zone Performance Monitoring Table for Regional Manager */}
      {(() => {
        if (staff?.role === 'area_manager') return null;

        const zonePerformanceMap = new Map<string, { outlets: { id: string; name: string; omzet: number }[]; totalOmzet: number }>();

        activeOutlets.forEach(outlet => {
          const amName = getAMName(outlet.id, outlet.name, amMap, staff?.role, staff?.name, outlet.region);

          const omzet = outletOmzetMap.get(outlet.id) || 0;
          if (!zonePerformanceMap.has(amName)) {
            zonePerformanceMap.set(amName, { outlets: [], totalOmzet: 0 });
          }
          const zData = zonePerformanceMap.get(amName)!;
          zData.outlets.push({ id: outlet.id, name: outlet.name, omzet });
          zData.totalOmzet += omzet;
        });

        const zonePerformanceData = Array.from(zonePerformanceMap.entries())
          .map(([zoneName, data]) => ({
            zoneName,
            outlets: data.outlets,
            totalOmzet: data.totalOmzet
          }))
          .sort((a, b) => b.totalOmzet - a.totalOmzet);

        return <ZonePerformanceTable zones={zonePerformanceData} />;
      })()}
      
      {/* 🏆 Bottom Grid: Leaderboard & Operational Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Leaderboard Ranking */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 lg:col-span-2 min-h-[300px]">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-suka-brown/10">
            <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider">
              Ranking Outlet (Berdasarkan Gross Revenue)
            </h3>
            <span className="text-xs font-bold text-suka-gray-400">
              {outletRanking.length} Outlet Terdaftar
            </span>
          </div>
          <RankingList outletRanking={outletRanking} maxOmzet={maxOmzet} />
        </div>

        {/* Live Outlet Status Feed */}
        <div className="bg-white p-6 sm:p-7 rounded-3xl shadow-[0_4px_24px_rgba(44,24,16,0.03)] border border-suka-brown/10 min-h-[300px] lg:col-span-1">
          <div className="flex items-center justify-between mb-6 pb-3 border-b border-suka-brown/10">
            <h3 className="text-sm font-black text-suka-brown uppercase tracking-wider">
              Status Outlet
            </h3>
            <span className="text-xs font-bold text-suka-gray-400">
              {allOutlets.length} Cabang
            </span>
          </div>

          {allOutlets.length === 0 ? (
            <p className="text-sm text-suka-gray-400">Tidak ada outlet.</p>
          ) : (
            <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1">
              {Array.from(groupedOutlets.entries()).map(([groupKey, groupOutlets]) => (
                <div key={groupKey} className="space-y-3">
                  {groupedOutlets.size > 1 && (
                    <h4 className="text-[11px] font-black text-suka-orange uppercase tracking-wider bg-suka-orange/10 px-3 py-1.5 rounded-lg inline-block border border-suka-orange/20">
                      {groupKey}
                    </h4>
                  )}
                  <ul className="divide-y divide-suka-brown/5">
                    {groupOutlets.map(outlet => {
                      const staffStates = outletStaffStateMap.get(outlet.id);
                      const stateValues = staffStates ? Array.from(staffStates.values()) : [];
                      const hasAnyoneIn = stateValues.some(s => s === 'in');
                      const isEveryoneOut = stateValues.length > 0 && stateValues.every(s => s === 'out');
                      const openTime = outletFirstCheckIn.get(outlet.id);
                      const closeTime = outletLastCheckOut.get(outlet.id);

                      return (
                        <li key={outlet.id} className="py-3 flex justify-between items-center first:pt-0 last:pb-0 hover:bg-suka-brown/[0.02] px-2 rounded-xl transition-colors">
                          <span className="text-sm font-extrabold text-suka-brown truncate mr-2">{outlet.name}</span>
                          {hasAnyoneIn || (openTime && !isEveryoneOut) ? (
                            <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 text-emerald-800 text-[10px] rounded-full font-black uppercase tracking-wider border border-emerald-200 shrink-0">
                              <span className="relative flex h-2 w-2 mr-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                              </span>
                              Buka{openTime ? ` - ${openTime}` : ''}
                            </span>
                          ) : isEveryoneOut ? (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 text-[10px] rounded-full font-black uppercase tracking-wider border border-slate-200 shrink-0">
                              Tutup Shift{closeTime ? ` - ${closeTime}` : ''}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-red-50 text-red-700 text-[10px] rounded-full font-black uppercase tracking-wider border border-red-200 shrink-0">
                              Tutup
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
