import React from 'react';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { parseStaffHeader, STAFF_HEADER } from '@suka/auth';
import { createClient } from '@supabase/supabase-js';
import LaporanPenjualanClient from './LaporanPenjualanClient';
import { buildAnalytics } from '@/lib/laporanPenjualan/aggregate';
import { addDays, getEarliestOrderDate, jakartaDate, loadDaySummaries } from '@/lib/laporanPenjualan/load';
import { susunOutletLaporan } from '@/lib/laporanPenjualan/outletLaporan';

type DateRange = 'today' | 'yesterday' | '7days' | '30days' | 'all' | 'custom';

export const dynamic = 'force-dynamic';

export default async function LaporanPenjualanPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const headersList = await headers();
  const staff = parseStaffHeader(headersList.get(STAFF_HEADER));

  // Role restriction: Khusus kitchen, purchasing, admin, owner
  if (staff && staff.role !== 'kitchen' && staff.role !== 'purchasing' && staff.role !== 'admin' && staff.role !== 'owner' && staff.role !== 'developer') {
    redirect('/dashboard');
  }

  const resolvedSearchParams = await searchParams;

  const range = (resolvedSearchParams.range as DateRange) || 'today';
  const customStart = (resolvedSearchParams.customStart as string) || '';
  const customEnd = (resolvedSearchParams.customEnd as string) || '';
  const channelFilter = (resolvedSearchParams.channel as string) || 'all';
  const outletFilter = (resolvedSearchParams.outlet_id as string) || 'all';

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Rentang tanggal WIB — aturan sama dengan versi sebelumnya.
  const today = jakartaDate();
  let from = today;
  let to = today;
  if (range === 'yesterday') {
    from = to = addDays(today, -1);
  } else if (range === '7days') {
    from = addDays(today, -6);
  } else if (range === '30days') {
    from = addDays(today, -29);
  } else if (range === 'all') {
    // Dulu mulai 1970 dan menarik seluruh riwayat order; kini dari order pertama.
    from = (await getEarliestOrderDate(supabaseAdmin)) ?? today;
  } else if (range === 'custom' && customStart && customEnd) {
    from = customStart;
    to = customEnd;
  }

  // Ringkasan per hari (lib/laporanPenjualan) — hari lampau dari cache, hari
  // ini segar; bukan lagi seluruh order mentah di setiap buka halaman.
  const [{ days }, { data: outletsData }] = await Promise.all([
    from <= to ? loadDaySummaries(supabaseAdmin, from, to) : Promise.resolve({ days: [] }),
    supabaseAdmin.from('outlets').select('id, name, type, status, is_active, slug, nonaktif_at').order('name', { ascending: true })
  ]);

  // Outlet operasional (internal/mitra, bukan Persiapan/SS Backup) lewat type/status,
  // bukan nama. Outlet tutup tetap dihitung, tapi di pemilih hanya tampil s/d
  // akhir bulan tutupnya (patokan: awal periode).
  const { idDihitung: validOutletIdSet, infoOutlet: outletInfoMap, pilihan: validOutlets, jumlahAktif } =
    susunOutletLaporan(outletsData || [], from);

  const analytics = buildAnalytics(days, { channelFilter, outletFilter, validOutletIdSet, outletInfoMap });

  return (
    <LaporanPenjualanClient
      analytics={analytics}
      outlets={validOutlets}
      jumlahOutletAktif={jumlahAktif}
      initialFilters={{
        range,
        customStart,
        customEnd,
        channelFilter,
        outletFilter
      }}
      dateRange={{ from, to }}
      staffName={staff?.name || 'Admin Kitchen'}
    />
  );
}
