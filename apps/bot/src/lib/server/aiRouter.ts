/**
 * Klien AI Router (OpenAI-compatible) untuk inferensi J.A.R.V.I.S. berbasis live data.
 * Memanfaatkan model combo 9Router & Hermes (hermes-combo, MANAGER_SS, STOKIS_SS, ANALYTIC-SOSMED-COMBO).
 */
import { buatPengurai } from '@/lib/hermes'
import { TelemetriHariIni, formatRupiah } from './telemetriNyata'
import { deteksiPermintaanTanggal, ambilDataDinamisRentang } from './queryDinamis'

export interface PesanRiwayat {
  role: 'user' | 'assistant'
  content: string
}

export const DEFAULT_HERMES_COMBO_MODEL = 'hermes-combo'

/**
 * Model utama & fallback 9Router berkeandalan tinggi (diuji < 2.5 detik dengan konteks telemetri penuh).
 */
export const MODEL_FALLBACK_STABIL = ['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'cx/gpt-6-sol', 'ag/gemini-3.8-flash']

/**
 * Mengembalikan kandidat model 9Router yang sesuai dengan profil agen Hermes.
 * Urutan pertama mengutamakan model berlatensi rendah & stabil (`ag/gemini-3.8-flash-high`, `cx/gpt-6-luna`, `cx/gpt-6-sol`, `ag/gemini-3.8-flash`)
 * agar tidak terkena hang/timeout pada combo `CEO_SS` atau `hermes-combo` (deprecated 410).
 */
export function kandidatModel9Router(profil: string, envModel?: string): string[] {
  const override = envModel?.trim()
  if (override && override !== DEFAULT_HERMES_COMBO_MODEL && override !== 'CEO_SS') {
    return Array.from(new Set([override, ...MODEL_FALLBACK_STABIL]))
  }
  switch (profil.trim().toLowerCase()) {
    case 'ceo':
      return ['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'cx/gpt-6-sol', 'ag/gemini-3.8-flash', 'MANAGER_SS']
    case 'manager':
      return ['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', 'MANAGER_SS']
    case 'gudang':
    case 'stokis':
      return ['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', 'STOKIS_SS']
    case 'marcom':
    case 'review':
    case 'sukareview':
      return ['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'ag/gemini-3.8-flash', 'ANALYTIC-SOSMED-COMBO']
    case 'hrd':
      return [...MODEL_FALLBACK_STABIL]
    case 'finance':
      return ['ag/gemini-3.8-flash-high', 'cx/gpt-6-luna', 'cx/gpt-6-sol', 'ag/gemini-3.8-flash', 'MANAGER_SS']
    default:
      return [...MODEL_FALLBACK_STABIL]
  }
}

export async function* tanyaAiRouter(o: {
  pesan: string
  profil: string
  telemetri: TelemetriHariIni | null
  riwayat?: PesanRiwayat[]
  signal?: AbortSignal
}): AsyncGenerator<string> {
  const base = process.env.AI_BASE_URL?.replace(/\/+$/, '')
  const key = process.env.AI_API_KEY
  const daftarModel = kandidatModel9Router(o.profil, process.env.AI_MODEL)

  if (!base || !key) {
    throw new Error('AI Router belum dikonfigurasi (AI_BASE_URL atau AI_API_KEY kosong)')
  }

  const t = o.telemetri

  // Bangun data operasional real-time Suka Shawarma sebagai referensi knowledge base
  let konteksData = 'Data operasional real-time saat ini tidak tersedia.'
  if (t) {
    const formatBarisOutlet = (out: any, i: number) => {
      const aov = out.orderCount > 0 ? Math.round(out.omzet / out.orderCount) : 0
      const net = out.omzetBersih !== undefined ? ` | Net: ${formatRupiah(out.omzetBersih)}` : ''
      const pot = out.potongan ? ` | Potongan: ${formatRupiah(out.potongan)}` : ''
      const hpp = out.totalHpp !== undefined ? ` | HPP: ${formatRupiah(out.totalHpp)} | Laba Kotor: ${formatRupiah(out.labaKotor || 0)}` : ''
      const porsi = out.totalPorsi !== undefined ? `, ${out.totalPorsi} porsi` : ''
      const kanalInfo =
        out.rincianKanal && out.rincianKanal.length > 0
          ? ` [Kanal: ${out.rincianKanal
              .map((rk: any) =>
                rk.potongan > 0
                  ? `${rk.kanal} Kotor ${formatRupiah(rk.omzetKotor)}/Net ${formatRupiah(rk.omzetBersih)} (${rk.orderCount})`
                  : `${rk.kanal} ${formatRupiah(rk.omzetKotor)} (${rk.orderCount})`
              )
              .join(', ')}]`
          : ''
      const menuCabangInfo =
        out.topMenuCabang && out.topMenuCabang.length > 0
          ? ` [Top Menu: ${out.topMenuCabang
              .slice(0, 3)
              .map((m: any) => `${m.nama} (${m.qty} porsi)`)
              .join(', ')}]`
          : ''
      const sepiCabangInfo =
        out.menuTersepiCabang && out.menuTersepiCabang.length > 0
          ? ` [Menu Tersepi: ${out.menuTersepiCabang
              .slice(0, 2)
              .map((m: any) => `${m.nama} (${m.qty} porsi)`)
              .join(', ')}]`
          : ''
      return `${i + 1}. ${out.nama} [${out.type}]: Kotor ${formatRupiah(out.omzet)}${net}${pot}${hpp} (${out.orderCount} order${porsi}, AOV ${formatRupiah(aov)})${kanalInfo}${menuCabangInfo}${sepiCabangInfo}`
    }

    const listTransaksi = t.outletsAktifTransaksi.map(formatBarisOutlet).join('\n')

    const listNol = t.outletsNolTransaksi.map((out) => `- ${out.nama} (${out.type})`).join('\n')
    const listMenu = t.topMenu.map((m, i) => `${i + 1}. ${m.nama}: ${m.qty} porsi (${formatRupiah(m.omzet)})`).join('\n')
    const listMenuKemarin = (t.topMenuKemarin ?? t.ringkasanKemarin?.topMenu ?? [])
      .map((m, i) => `${i + 1}. ${m.nama}: ${m.qty} porsi (${formatRupiah(m.omzet)})`)
      .join('\n')
    const listMenuTersepiKemarin = (t.ringkasanKemarin?.menuTersepi ?? [])
      .map((m, i) => `${i + 1}. ${m.nama}: ${m.qty} porsi (${formatRupiah(m.omzet)})`)
      .join('\n')
    const listBahan = t.bahanBaku.map((b) => `- ${b.nama} (${b.satuan})`).join('\n')
    const listCuti = (t.stafCutiIzin || [])
      .map((c) => `- ${c.nama} (${c.role}): ${c.jenis} [status: ${c.status}] - Alasan: ${c.alasan}`)
      .join('\n')
    const listTelat = (t.stafTelat || [])
      .map((s) => `- ${s.nama} (${s.outlet}): telat ${s.telatMenit} menit`)
      .join('\n')
    const listCutiKemarin = (t.hrdKemarin?.stafCutiIzin || [])
      .map((c) => `- ${c.nama} (${c.role}): ${c.jenis} [status: ${c.status}] - Alasan: ${c.alasan}`)
      .join('\n')
    const listTelatKemarin = (t.hrdKemarin?.stafTelat || [])
      .map((s) => `- ${s.nama} (${s.outlet}): telat ${s.telatMenit} menit`)
      .join('\n')

    const w = t.waste
    const listWasteBahan = (w?.topBahan || [])
      .map(
        (b, i) =>
          `${i + 1}. ${b.nama}: ${b.totalQty} ${b.satuan} (${b.frekuensi}x dilaporkan) — Est. Rugi: ${formatRupiah(
            b.estKerugianRp
          )} | Alasan: ${b.alasanDominan}`
      )
      .join('\n')
    const listWasteOutlet = (w?.topOutlet || [])
      .map(
        (out, i) =>
          `${i + 1}. ${out.nama}: ${out.frekuensi} laporan (${out.totalQty} unit${
            out.estKerugianRp ? `, Est. Rugi: ${formatRupiah(out.estKerugianRp)}` : ''
          })`
      )
      .join('\n')

    const listWasteKemarinPerOutlet = (w?.rekapOutletKemarin || [])
      .map(
        (o, i) =>
          `  ${i + 1}. ${o.outlet}: ${o.totalLaporan} laporan (${Math.round(o.totalQty * 100) / 100} unit, Est. Rugi: ${formatRupiah(o.estKerugianRp)}) [Item: ${o.items.slice(0, 4).join(', ')}]`
      )
      .join('\n')

    const listWasteKemarinDetail = (w?.rincianKemarin || [])
      .slice(0, 25)
      .map(
        (r, i) =>
          `  ${i + 1}. ${r.outlet}: ${r.bahan} ${r.qty} ${r.satuan} (${r.reason}) — Est. Rugi ${formatRupiah(r.estKerugianRp)} [${r.status}]`
      )
      .join('\n')

    const listWasteHariIniPerOutlet = (w?.rekapOutletHariIni || [])
      .map(
        (o, i) =>
          `  ${i + 1}. ${o.outlet}: ${o.totalLaporan} laporan (${Math.round(o.totalQty * 100) / 100} unit, Est. Rugi: ${formatRupiah(o.estKerugianRp)}) [Item: ${o.items.slice(0, 4).join(', ')}]`
      )
      .join('\n')

    const listWasteHariIniDetail = (w?.rincianHariIni || [])
      .slice(0, 15)
      .map(
        (r, i) =>
          `  ${i + 1}. ${r.outlet}: ${r.bahan} ${r.qty} ${r.satuan} (${r.reason}) — Est. Rugi ${formatRupiah(r.estKerugianRp)} [${r.status}]`
      )
      .join('\n')

    const listWaste7HariBahan = (w?.topBahan7Hari || [])
      .map(
        (b, i) =>
          `  ${i + 1}. ${b.nama}: ${b.totalQty} ${b.satuan} (${b.frekuensi}x dilaporkan) — Est. Rugi: ${formatRupiah(
            b.estKerugianRp
          )} | Alasan: ${b.alasanDominan}`
      )
      .join('\n')

    const listWaste7HariOutlet = (w?.topOutlet7Hari || [])
      .map(
        (out, i) =>
          `  ${i + 1}. ${out.nama}: ${out.frekuensi} laporan (${out.totalQty} unit${
            out.estKerugianRp ? `, Est. Rugi: ${formatRupiah(out.estKerugianRp)}` : ''
          })`
      )
      .join('\n')

    const listWaste7HariPerOutlet = (w?.rekapOutlet7Hari || [])
      .slice(0, 10)
      .map(
        (o, i) =>
          `  ${i + 1}. ${o.outlet}: ${o.totalLaporan} laporan (${Math.round(o.totalQty * 100) / 100} unit, Est. Rugi: ${formatRupiah(o.estKerugianRp)}) [Item: ${o.items.slice(0, 4).join(', ')}]`
      )
      .join('\n')

    const v = t.voidOrder
    const listVoid = (v?.daftarOutletVoidHariIni || [])
      .map((vo) => `- ${vo.outlet}: ${formatRupiah(vo.nilai)} (${vo.waktu} WIB)`)
      .join('\n')
    const listVoidKemarin = (v?.daftarOutletVoidKemarin || [])
      .map((vo) => `- ${vo.outlet}: ${formatRupiah(vo.nilai)} (${vo.waktu} WIB)`)
      .join('\n')

    const sbk = t.statusBuka
    const listBuka = (sbk?.daftarBuka || [])
      .map((b) => `- ${b.outlet}: buka shift jam ${b.jamBuka} WIB [status: ${b.status}]`)
      .join('\n')

    const k = t.ringkasanKemarin
    const listKemarinTransaksi = (k?.outletsAktifTransaksi || []).map(formatBarisOutlet).join('\n')
    const listKemarinNol = (k?.outletsNolTransaksi || []).map((out) => `- ${out.nama} (${out.type})`).join('\n')

    const f = t.finance
    let teksFinance = ''
    if (f) {
      const listExpHariIni = (f.pengeluaranHariIni?.topPengeluaran || [])
        .slice(0, 15)
        .map(
          (x, i) =>
            `${i + 1}. ${formatRupiah(x.nominal)} - ${x.deskripsi} (${x.outlet}) [kategori: ${x.kategori}, jenis: ${x.tipe}]`
        )
        .join('\n')

      const listExpHariIniPerOutlet = (f.pengeluaranHariIni?.rekapPerOutlet || [])
        .map(
          (o, i) =>
            `  ${i + 1}. ${o.outlet}: Total ${formatRupiah(o.totalNominal)} (${o.jumlahTransaksi} item: ${o.rincian.join(', ')})`
        )
        .join('\n')

      const listExpKemarin = (f.pengeluaranKemarin?.topPengeluaran || [])
        .slice(0, 15)
        .map(
          (x, i) =>
            `${i + 1}. ${formatRupiah(x.nominal)} - ${x.deskripsi} (${x.outlet}) [kategori: ${x.kategori}, jenis: ${x.tipe}]`
        )
        .join('\n')

      const listExpKemarinPerOutlet = (f.pengeluaranKemarin?.rekapPerOutlet || [])
        .map(
          (o, i) =>
            `  ${i + 1}. ${o.outlet}: Total ${formatRupiah(o.totalNominal)} (${o.jumlahTransaksi} item: ${o.rincian.join(', ')})`
        )
        .join('\n')

      const listExpBulan = (f.pengeluaranBulanIni?.topPengeluaran || [])
        .map(
          (x, i) =>
            `${i + 1}. ${formatRupiah(x.nominal)} - ${x.deskripsi} (${x.outlet}) [kategori: ${x.kategori}]`
        )
        .join('\n')

      const listPo = (f.utangPo?.daftarPo || [])
        .slice(0, 10)
        .map(
          (p, i) =>
            `${i + 1}. ${p.nomorPo} - ${p.supplier}: ${formatRupiah(p.nilaiTerima)} [Jatuh Tempo: ${p.jatuhTempo || '-'}, Overdue: ${p.hariLewat ? `${p.hariLewat} hari` : 'Belum'}]`
        )
        .join('\n')

      const listSupplier = (f.utangPo?.topSupplier || [])
        .map((s, i) => `${i + 1}. ${s.supplier}: ${formatRupiah(s.total)} (${s.jumlahPo} PO)`)
        .join('\n')

      const listSetoran = (f.setoranKas?.daftarSetoranTerbaru || [])
        .slice(0, 10)
        .map(
          (s, i) =>
            `${i + 1}. ${s.outlet}: ${formatRupiah(s.nominal)} (Tgl Jual: ${s.tanggalJual}, Status: ${s.status})`
        )
        .join('\n')

      const listSelisihKemarin = (f.selisihKasir?.selisihKemarin || [])
        .map(
          (s, i) =>
            `${i + 1}. ${s.outlet} (Kasir: ${s.kasir}): Fisik ${formatRupiah(s.fisik)} vs Seharusnya ${formatRupiah(s.seharusnya)} -> Selisih ${s.selisih < 0 ? 'Minus/Tekor' : 'Lebih'} ${formatRupiah(s.selisih)}`
        )
        .join('\n')

      const listSelisih = (f.selisihKasir?.daftarSelisihTerbaru || [])
        .slice(0, 5)
        .map(
          (s, i) =>
            `${i + 1}. ${s.outlet} (Kasir: ${s.kasir}): Selisih ${s.selisih < 0 ? 'Minus/Tekor' : 'Lebih'} ${formatRupiah(s.selisih)}`
        )
        .join('\n')

      const inputHariIni = f.setoranKas?.inputHariIni
      const shiftKemarin = f.setoranKas?.tutupShiftKemarin

      const listShiftCabangKemarin = (shiftKemarin?.rincianCabang || [])
        .map(
          (c, i) =>
            `    ${i + 1}. ${c.outlet} (Kasir: ${c.kasir}): Kas Fisik ${formatRupiah(c.fisik)} | Seharusnya ${formatRupiah(c.seharusnya)} | Selisih ${formatRupiah(c.selisih)} [${c.sudahDirekap ? 'SUDAH DIREKAP BANK' : 'BELUM SETOR/REKAP'}]`
        )
        .join('\n')

      const listPerTglJual = inputHariIni?.rekapPerTanggalJual?.map(
        r => `    * Penjualan ${r.tanggalJual}: ${formatRupiah(r.totalNominal)} (${r.jumlah} transaksi)`
      ).join('\n') || '    (Belum ada transaksi diinput hari ini)'

      teksFinance = `
DATA KEUANGAN, BIAYA, OPEX, & REKONSILIASI KAS (FINANCE H-1 KEMARIN & HARI INI):
- Total Pengeluaran / OPEX Kemarin (${k?.tglIso || 'H-1'}): ${formatRupiah(f.pengeluaranKemarin?.totalNominal || 0)} (${f.pengeluaranKemarin?.jumlahTransaksi || 0} transaksi kas kecil/operasional)
- Rekap Total OPEX & Petty Cash Per Cabang Kemarin (H-1):
${listExpKemarinPerOutlet || '  (Tidak ada pengeluaran per cabang kemarin)'}
- Top 15 Item Pengeluaran Terbesar Kemarin (H-1):
${listExpKemarin || '(Tidak ada pengeluaran tercatat kemarin)'}

- Total Pengeluaran / OPEX Live Hari Ini (${t.tanggalWIB}): ${formatRupiah(f.pengeluaranHariIni?.totalNominal || 0)} (${f.pengeluaranHariIni?.jumlahTransaksi || 0} transaksi kas kecil/operasional)
- Rekap OPEX Per Cabang Hari Ini:
${listExpHariIniPerOutlet || '  (Belum ada pengeluaran per cabang hari ini)'}
- Rincian Item Pengeluaran Hari Ini:
${listExpHariIni || '(Belum ada pengeluaran hari ini)'}

- Total Pengeluaran Operasional Bulan Berjalan: ${formatRupiah(f.pengeluaranBulanIni?.totalNominal || 0)}
- Top Pengeluaran Terbesar Bulan Berjalan:
${listExpBulan || '(Belum ada pengeluaran besar bulan ini)'}

- Ringkasan Utang PO Supplier:
  * Total Utang Diterima Belum Lunas: ${formatRupiah(f.utangPo?.totalUtang || 0)} (${f.utangPo?.jumlahPo || 0} PO)
  * Total Utang Overdue / Lewat Jatuh Tempo: ${formatRupiah(f.utangPo?.totalLewatJatuhTempo || 0)}
  * Top Supplier Utang Terbesar:
${listSupplier || '  (Tidak ada utang supplier)'}
  * Rincian PO Jatuh Tempo Terdekat:
${listPo || '  (Tidak ada PO aktif)'}

- Rekapitulasi Setoran Kas & Rekonsiliasi Bank:
  * Kas Fisik Tutup Shift POS Kemarin (${k?.tanggalLabel || 'Kemarin'}): Total Kas Fisik ${formatRupiah(shiftKemarin?.totalFisikKas || 0)} (${shiftKemarin?.jumlahOutletClosed || 0} cabang closed shift).
    Status rekonsiliasi: ${shiftKemarin?.sudahDirekap || 0} cabang sudah direkap ke bank pusat, ${shiftKemarin?.belumDirekap || 0} cabang belum direkap${shiftKemarin?.daftarBelumSetor?.length ? ` (${shiftKemarin.daftarBelumSetor.join(', ')})` : ''}.
  * Rincian Kas Fisik Tutup Shift Per Cabang Kemarin (H-1):
${listShiftCabangKemarin || '    (Tidak ada data tutup shift kemarin)'}
  * Setoran Di-input / Direkap Finance Hari Ini (${t.tanggalWIB}): ${formatRupiah(inputHariIni?.totalNominal || 0)} (${inputHariIni?.jumlahTransaksi || 0} setoran bank tercatat)
    Rincian tanggal penjualan yang dicakup:
${listPerTglJual}
  * Transaksi Setoran Bank Terbaru di Sistem:
${listSetoran || '    (Belum ada setoran dicatat)'}

- Rekap Audit Selisih Kasir Tutup Shift POS Kemarin (H-1):
${listSelisihKemarin || '(Nol / Seluruh kasir kemarin klop Rp 0 selisih)'}
- Rekap Audit Selisih Kasir Tutup Shift POS Terbaru (Lintas Hari):
${listSelisih || '(Nol / Selisih kasir klop)'}
`
    }

    const sStok = t.saldoStok
    let teksStok = ''
    if (sStok && sStok.length > 0) {
      const topStokKritis = sStok.filter((s) => s.outletKritisCount > 0).slice(0, 12)
      const listKritis =
        topStokKritis.length > 0
          ? topStokKritis
              .map((s) => {
                const cabangKosong = s.daftarOutlet
                  .filter((d) => d.qty <= 0)
                  .map((d) => `${d.outlet} (${d.qty})`)
                  .join(', ')
                return `  * ${s.nama}: ${s.outletKritisCount} cabang stok kosong/minus [${cabangKosong}] (Gudang Pusat: ${s.stokGudangPusat} ${s.satuan}, Total Cabang: ${s.totalStokJaringan} ${s.satuan})`
              })
              .join('\n')
          : '  (Seluruh stok bahan baku aman, tidak ada cabang dengan saldo kosong)'

      const topBahan = sStok
        .slice(0, 10)
        .map((s) => `  * ${s.nama}: ${s.totalStokJaringan} ${s.satuan} di cabang (${s.stokGudangPusat} ${s.satuan} di gudang pusat)`)
        .join('\n')

      teksStok = `
DATA SALDO STOK BAHAN BAKU REAL-TIME (MONITORING VIEW GUDANG & CABANG):
- Bahan Baku dengan Cabang Stok Menipis/Kosong (beserta nama cabang):
${listKritis}
- Saldo Bahan Baku Utama Jaringan:
${topBahan}
`
    }

    const dist = t.distribusi
    let teksDistribusi = ''
    if (dist) {
      const menggantung = dist.daftarSuratJalanMenggantung || (dist.daftarSuratJalanTerbaru || []).filter((s) =>
        ['dikirim', 'dikirim_lengkap'].includes(String(s.status || '').toLowerCase())
      )
      const listSjMenggantung = menggantung
        .map(
          (s, idx) =>
            `  ${idx + 1}. ${s.outlet} — ID: ${s.id} | Status: ${s.status} (Tgl: ${s.tanggal}) | Item (${s.totalItem}): ${s.ringkasanItem || '-'}`
        )
        .join('\n')

      const listSj = (dist.daftarSuratJalanTerbaru || [])
        .slice(0, 15)
        .map((s) => {
          const selisihInfo =
            s.adaSelisih && s.rincianSelisih?.length ? ` [PERHATIAN SELISIH: ${s.rincianSelisih.join('; ')}]` : ''
          return `  * [${s.tanggal}] Ke ${s.outlet} (ID: ${s.id}, Status: ${s.status}, ${s.totalItem} item: ${s.ringkasanItem || '-'})${selisihInfo}`
        })
        .join('\n')

      teksDistribusi = `
DATA LOGISTIK & PENGIRIMAN SURAT JALAN (DISTRIBUSI):
- Total Surat Jalan Menggantung / Status DIKIRIM (Belum Diterima/Verifikasi Cabang): ${menggantung.length} pengiriman aktif
- Daftar Surat Jalan Menggantung / Status DIKIRIM (WAJIB sebutkan semua jika ditanya SJ menggantung):
${listSjMenggantung || '  (Nihil - seluruh Surat Jalan sudah diverifikasi oleh cabang)'}
- Total Surat Jalan Terpantau: ${dist.totalSuratJalanDikirim} pengiriman
- Surat Jalan dengan Catatan Selisih/Rusak: ${dist.totalSuratJalanAdaSelisih} pengiriman
- Riwayat Pengiriman Surat Jalan Terbaru:
${listSj || '  (Tidak ada riwayat pengiriman)'}
`
    }

    const r = t.review
    let teksReview = ''
    if (r) {
      const listTopRating = (r.topCabangRating || [])
        .slice(0, 5)
        .map((c) => `  * ${c.outlet}: ${c.rating}⭐ (${c.totalUlasan} ulasan)`)
        .join('\n')

      const listNegatif = (r.ulasanNegatifTerbaru || [])
        .map((n, i) => `${i + 1}. ⭐${n.rating} ${n.outlet} (Oleh: ${n.reviewer}, Tgl: ${n.waktu}): "${n.komentar}"`)
        .join('\n')

      teksReview = `
DATA ULASAN GOOGLE REVIEWS & KEPUASAN PELANGGAN (SUKAREVIEW):
- Total Ulasan Terpantau: ${r.totalUlasan} ulasan
- Rating Rata-rata Konsolidasi: ${r.ratingRataRata}⭐
- Peringkat Rating Tertinggi Cabang:
${listTopRating || '  (Belum ada data cabang)'}
- Ulasan Kritis / Negatif Terbaru:
${listNegatif || '(Tidak ada ulasan negatif terbaru - kepuasan pelanggan terjaga)'}
`
    }

    const cek = t.ceklistHarian
    const listKunjunganKemarin = (cek?.daftarKunjunganKemarin || [])
      .map(
        (c, i) =>
          `  ${i + 1}. Cabang ${c.outlet} — Dikunjungi oleh AM ${c.namaAm} (${c.tanggal}) | Status Evaluasi: ${
            c.nilaiTerburuk === 'baik'
              ? 'BAIK (Sesuai SOP)'
              : c.nilaiTerburuk === 'perhatian'
              ? 'PERLU PERHATIAN'
              : 'BURUK (Kritis)'
          }${c.temuan.length > 0 ? ` | Catatan Temuan: ${c.temuan.join('; ')}` : ''}${
            c.perbaikan.length > 0 ? ` | Rencana Perbaikan: ${c.perbaikan.join('; ')}` : ''
          }`
      )
      .join('\n')
    const listTemuanCeklist = (cek?.daftarTemuanTerbaru || [])
      .map(
        (c, i) =>
          `  ${i + 1}. Cabang ${c.outlet} (Oleh AM ${c.namaAm}, Tgl: ${c.tanggal}) [Status: ${c.nilaiTerburuk.toUpperCase()}] -> Temuan: ${c.temuan.join('; ') || '-'} | Perbaikan: ${c.perbaikan.join('; ') || '-'}`
      )
      .join('\n')

    const kb = t.kasbonHrd
    const listKasbonPending = (kb?.daftarPendingTerbaru || [])
      .map((x, i) => `  ${i + 1}. ${x.nama} (${x.role} - ${x.outlet}): ${formatRupiah(x.nominal)} (Alasan: ${x.alasan})`)
      .join('\n')

    const tr = t.trenHarian
    const teksTrenH2 = tr
      ? `
PERBANDINGAN TREN DAY-OVER-DAY (H-1 KEMARIN VS H-2 TANGGAL ${tr.tanggalH2Iso}):
- Omzet H-2: ${formatRupiah(tr.omzetH2)} | Delta H-1 vs H-2: ${tr.deltaOmzetPersen !== null ? `${tr.deltaOmzetPersen > 0 ? '+' : ''}${tr.deltaOmzetPersen}%` : 'N/A'}
- Order H-2: ${tr.orderH2} struk | Delta H-1 vs H-2: ${tr.deltaOrderPersen !== null ? `${tr.deltaOrderPersen > 0 ? '+' : ''}${tr.deltaOrderPersen}%` : 'N/A'}
- OPEX H-2: ${formatRupiah(tr.opexH2)} | Delta H-1 vs H-2: ${tr.deltaOpexPersen !== null ? `${tr.deltaOpexPersen > 0 ? '+' : ''}${tr.deltaOpexPersen}%` : 'N/A'}
- Waste H-2: ${formatRupiah(tr.wasteH2Rp)} | Delta H-1 vs H-2: ${tr.deltaWastePersen !== null ? `${tr.deltaWastePersen > 0 ? '+' : ''}${tr.deltaWastePersen}%` : 'N/A'}
`
      : ''

    konteksData = `
======================================================================
ACUAN UTAMA DEFAULT: EVALUASI FULL CLOSING KEMARIN / H-1 (${k?.tanggalLabel || 'Kemarin'})
======================================================================
1. DATA PENJUALAN, HPP, LABA KOTOR, & MENU TERLARIS KEMARIN (H-1):
- Total Omzet Kotor Jaringan Kemarin: ${formatRupiah(k?.omzetTotal || 0)}
- Total Omzet Bersih (Net) Jaringan Kemarin: ${formatRupiah(k?.omzetBersihTotal ?? k?.omzetTotal ?? 0)} (Potongan Promo/Diskon: ${formatRupiah(k?.potonganTotal || 0)})
- Total HPP (COGS) Jaringan Kemarin: ${formatRupiah(k?.totalHpp || 0)}
- Total Laba Kotor (Gross Profit) Jaringan Kemarin: ${formatRupiah(k?.labaKotorTotal || 0)}
- Total Akumulasi Order & Porsi Kemarin: ${k?.totalOrder || 0} struk (${k?.totalPorsi || 0} porsi terjual, AOV ${formatRupiah(k?.aov || 0)})
- Peringkat Cabang Berpenjualan Kemarin (${k?.outletsAktifTransaksi?.length || 0} cabang — lengkap dengan Omzet Kotor, Net, Potongan, HPP, Laba Kotor, Porsi, Kanal, Top Menu & Menu Tersepi per cabang):
${listKemarinTransaksi || '(Tidak ada transaksi kemarin)'}
- Cabang Tanpa Transaksi Kemarin:
${listKemarinNol || '(Seluruh cabang mencatat penjualan)'}
- Top Menu Terlaris Jaringan Kemarin (H-1):
${listMenuKemarin || '(Belum ada data menu kemarin)'}
- Menu Paling Sepi (Tersepi) Jaringan Kemarin (H-1):
${listMenuTersepiKemarin || '(Belum ada data menu tersepi kemarin)'}

2. DATA PRESENSI & SDM KEMARIN (HRD H-1):
- Total Clock-in Kru Kemarin: ${t.hrdKemarin?.kehadiranTotal ?? 0} clock-in
- Presensi Tepat Waktu Kemarin: ${t.hrdKemarin?.kehadiranTepatWaktu ?? 0} (${t.hrdKemarin?.persenOnTime ?? 100}% On-Time)
- Presensi Terlambat Kemarin: ${t.hrdKemarin?.kehadiranTelat ?? 0} kru
- Daftar Kru Terlambat Masuk Kemarin (H-1):
${listTelatKemarin || '(Tidak ada kru terlambat kemarin)'}
- Daftar Kru Izin / Cuti Kemarin (H-1):
${listCutiKemarin || '(Tidak ada kru yang izin/cuti kemarin)'}
- Status Kasbon Kru (App HR — BEDAKAN TEGAS ANTARA PENGAJUAN BARU vs PINJAMAN BERJALAN):
  * [A] Pengajuan Kasbon Baru (Status PENDING — Menunggu Persetujuan HR/Manajemen, Belum Cair): ${kb?.totalPendingCount ?? 0} staf dengan total pengajuan ${formatRupiah(kb?.totalPendingNominal ?? 0)}
  * [B] Pinjaman Kasbon Berjalan (Status ACTIVE — Sudah Cair & Sedang Dicicil Potong Gaji): ${kb?.totalAktifCount ?? 0} staf dengan total sisa saldo piutang belum lunas ${formatRupiah(kb?.totalSisaPiutang ?? 0)}
${listKasbonPending ? `  * Rincian Pengajuan Baru yang Menunggu Approval:\n${listKasbonPending}` : ''}
- Laporan Kunjungan / Sidak Harian Area Manager (App Manager — CATATAN PENTING ANTI-MULTITAFSIR: Total ${cek?.totalOutletWajib ?? t.totalOutletAktif} cabang adalah total seluruh jaringan Suka Shawarma lintas wilayah; kunjungan AM bersifat bergilir/rolling per wilayah binaan, BUKAN 1 orang AM wajib mengunjungi seluruh ${cek?.totalOutletWajib ?? t.totalOutletAktif} cabang dalam sehari):
  * Cabang yang Dikunjungi & Diinput Laporan Sidak Kemarin: ${cek?.totalSudahDicekKemarin ?? 0} cabang dikunjungi (dari total ${cek?.totalOutletWajib ?? t.totalOutletAktif} cabang jaringan; ${cek?. daftarBelumDicekKemarin?.length ?? 0} cabang lainnya belum ada jadwal/input kunjungan AM kemarin)
  * Cabang dengan Catatan Perlu Perhatian/Perbaikan Kemarin: ${cek?.totalPerluPerhatianKemarin ?? 0} cabang (${cek?.totalBelumDitinjauRm ?? 0} laporan menunggu tinjauan Regional Manager)
${listKunjunganKemarin ? `  * Rincian Cabang yang Dikunjungi AM Kemarin:\n${listKunjunganKemarin}` : listTemuanCeklist ? `  * Rincian Temuan Sidak AM Terbaru:\n${listTemuanCeklist}` : '  * (Seluruh aspek kebersihan, rasa, stok, seragam & peralatan cabang yang disidak berstatus Baik)'}
${teksTrenH2}

3. AUDIT VOID POS & SHIFT KEMARIN (OPERASIONAL H-1):
- Total Cabang Closed Shift Kemarin: ${sbk?.shiftKemarinClosedCount ?? 0} cabang
- Total Transaksi Void / Batal Kemarin: ${v?.totalVoidKemarin ?? 0} transaksi (${formatRupiah(v?.totalNilaiVoidKemarin ?? 0)})
- Rincian Transaksi Void Kemarin:
${listVoidKemarin || '(Nol / Tidak ada pembatalan transaksi kemarin)'}
- Laporan Waste Kemarin: ${w?.laporanKemarinCount ?? 0} laporan (Est. Rugi Kemarin: ${formatRupiah(w?.estKerugianKemarinRp ?? 0)})
- Rekapitulasi Waste Per Cabang Kemarin (H-1):
${listWasteKemarinPerOutlet || '  (Tidak ada laporan waste per cabang kemarin)'}
- Rincian Laporan Waste Kemarin (H-1):
${listWasteKemarinDetail || '  (Tidak ada rincian laporan waste kemarin)'}

======================================================================
DATA PANTAUAN LIVE HARI INI / BERJALAN (${t.tanggalWIB})
======================================================================
- Total Penjualan Jaringan Live Hari Ini: ${formatRupiah(t.omzetTotal)} (${t.totalOrder} struk, AOV ${formatRupiah(t.aov)})
- Total Cabang Aktif Terdata: ${t.totalOutletAktif} cabang
- Peringkat Cabang Berpenjualan Hari Ini (${t.outletsAktifTransaksi.length} cabang):
${listTransaksi || '(Belum ada cabang bertransaksi hari ini)'}
- Cabang Belum Mencatatkan Order Hari Ini (${t.outletsNolTransaksi.length} unit):
${listNol || '(Semua cabang sudah ada transaksi)'}
- Top Menu Terlaris Live Hari Ini:
${listMenu || '(Belum ada data porsi hari ini)'}
- Status Shift Kasir Hari Ini: ${sbk?.totalBuka || 0} cabang sudah buka / ${sbk?.totalBelumBuka || 0} belum buka
${listBuka || '(Belum ada shift kasir yang tercatat hari ini)'}
- Audit Void POS Live Hari Ini: ${v?.totalVoidHariIni || 0} transaksi (${formatRupiah(v?.totalNilaiVoidHariIni || 0)})
${listVoid || '(Nol void hari ini)'}
- Presensi Kru Live Hari Ini: ${t.kehadiranTotal} clock-in (${t.persenOnTime}% On-Time, ${t.kehadiranTelat} telat)
${listTelat || '(Belum ada catatan keterlambatan hari ini)'}
- Kru Izin / Cuti Live Hari Ini:
${listCuti || '(Tidak ada kru yang izin/cuti hari ini)'}
- Laporan Waste Live Hari Ini: ${w?.laporanHariIniCount ?? 0} laporan (Est. Rugi Hari Ini: ${formatRupiah(w?.estKerugianHariIniRp ?? 0)})
- Rekapitulasi Waste Per Cabang Hari Ini:
${listWasteHariIniPerOutlet || '  (Belum ada laporan waste per cabang hari ini)'}
- Rincian Laporan Waste Hari Ini:
${listWasteHariIniDetail || '  (Belum ada rincian waste hari ini)'}

======================================================================
DATA WASTE 7 HARI & 30 HARI, STOK, DISTRIBUSI, KEUANGAN, & GOOGLE REVIEW
======================================================================
DATA REKAPITULASI LOSS & WASTE 7 HARI TERAKHIR (MINGGUAN / H-7 S.D. H-1):
- Total Laporan Waste 7 Hari: ${w?.laporan7HariCount || 0} laporan
- Total Akumulasi Estimasi Kerugian 7 Hari: ${formatRupiah(w?.estKerugian7HariRp || 0)}
- Top Cabang Penyumbang Waste 7 Hari Terakhir:
${listWaste7HariOutlet || '  (Tidak ada catatan waste cabang 7 hari)'}
- Top Bahan Paling Banyak Terbuang 7 Hari Terakhir:
${listWaste7HariBahan || '  (Tidak ada data waste bahan 7 hari)'}
- Rekapitulasi Waste Per Cabang 7 Hari Terakhir:
${listWaste7HariPerOutlet || '  (Tidak ada data per cabang)'}

DATA WASTE & REJECT BAHAN BAKU (AUDIT LOSS PREVENTION 30 HARI TERAKHIR):
- Total Laporan Waste Tercatat (30H): ${w?.totalLaporan30Hari || 0} laporan
- Total Akumulasi Kerugian Estimasi (30H): ${formatRupiah(w?.totalEstKerugianRp || 0)}
- Top 5 Bahan Paling Banyak Waste / Terbuang:
${listWasteBahan || '(Belum ada data waste)'}
- Top 5 Cabang Penyumbang Laporan Waste Terbanyak:
${listWasteOutlet || '(Belum ada catatan waste cabang)'}

KATALOG BAHAN BAKU UTAMA GUDANG:
${listBahan || '- Gas, Kulit, Daging, Saus'}
${teksStok}
${teksDistribusi}
${teksFinance}
${teksReview}
`.trim()
  }

  // Deteksi query rentang tanggal fleksibel (misal: 10 hari kebelakang, 7 hari, tanggal 15 Oktober, dll)
  const infoTanggal = deteksiPermintaanTanggal(o.pesan, o.riwayat)
  let teksDataDinamis = ''
  if (infoTanggal) {
    try {
      teksDataDinamis = await ambilDataDinamisRentang(infoTanggal)
    } catch (err) {
      console.warn('[aiRouter] Gagal mengambil data dinamis rentang:', err)
    }
  }

  if (teksDataDinamis) {
    konteksData = `${konteksData}\n\n${teksDataDinamis}`
  }

  const profilClean = o.profil.trim().toLowerCase()
  const isManager = profilClean === 'manager'
  const isFinance = profilClean === 'finance'
  const isReview = profilClean === 'review' || profilClean === 'sukareview'
  const promptSistem = isFinance
    ? `
Anda adalah Bot Finance Suka Shawarma, asisten AI operasional divisi Keuangan & Treasury Suka Shawarma.
Tugas Anda mendampingi tim finance dan manajemen operasional dalam membaca serta menganalisis data keuangan:
1. Utang Supplier & PO: PO yang barangnya sudah diterima dan belum lunas (nilai terima), monitoring jatuh tempo, dan rincian per supplier. Komitmen (PO belum diterima) dilaporkan terpisah.
2. Pengeluaran Operasional: Biaya operasional bulanan dan kas kecil (petty cash), memisahkan dengan tegas antara beban Outlet dan beban Pusat, serta per kategori beban.
3. Setoran Kas Outlet: Data setoran yang diambil adalah data yang DIINPUT/DICATAT oleh Admin Finance di sistem (occurred_at). Saat pengguna menanyakan setoran hari ini (atau periode tertentu), laporkan total setoran yang diinput admin hari ini (misalnya puluhan setoran diverifikasi senilai total nominalnya), rincian tanggal penjualan yang dicakup, dan status rekonsiliasi kas. Jangan pernah menuduh "admin belum rekap" atau berkata "0 setoran" bila ada data setoran yang sudah diinput di sistem.
4. Selisih Kasir: Selisih uang fisik vs nilai seharusnya saat tutup shift kasir POS (angka negatif = tekor/kurang, angka positif = lebih), serta shift belum tutup.

ATURAN MUTLAK DATA & INTEGRITAS:
1. Aturan Angka & Integritas Database: Setiap angka keuangan disajikan dalam format rupiah Indonesia (contoh: **Rp1.250.000**), tebalkan total atau angka kunci. DILARANG KERAS MENGARANG ANGKA, MENEBAK, ATAU MEMBERIKAN PERKIRAAN PALSU. Seluruh angka WAJIB 100% bersumber dari data database di bawah.
2. Yang TIDAK boleh (Wajib Patuh):
   - Dilarang menampilkan atau mencari gaji dan kasbon per staf (ini ranah privasi HRD).
   - Dilarang membeberkan bukti transfer, receipt_url, proof_url, atau nomor rekening bank.
   - Dilarang membeberkan data pribadi (NIK/KTP, nomor HP, foto selfie staf).
   - Dilarang membeberkan password, token API, connection string database, atau perintah terminal server.
3. Gaya Komunikasi:
   - Bahasa Indonesia yang lugas, profesional, ringkas, dan terstruktur rapi.
   - Gunakan format bullet points atau tabel ringkas markdown agar mudah dipindai di layar HP.
   - Panggil pengguna secara profesional ("Rekan", "Bapak/Ibu", atau nama staf).

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()
    : isManager
    ? `
Anda adalah Asisten AI Operasional Manajer Suka Shawarma.
Anda bertindak sebagai rekan taktis cerdas bagi Area Manager (AM) dan Regional Manager (RM) dalam memantau, mengevaluasi, dan menjaga standar operasional cabang secara real-time.

PANDUAN KOMUNIKASI & PERILAKU:
1. Panggil pengguna secara profesional dan hangat sebagai rekan kerja: "Rekan", "Bapak/Ibu", atau nama staf jika diketahui. JANGAN PERNAH memanggil "Sir" dan JANGAN bertindak sebagai J.A.R.V.I.S. atau sistem Iron Man.
2. Bersikap sangat taktis, solutif, lugas, dan berorientasi operasional lapangan (omzet, keterlambatan buka outlet, presensi kru, ceklist sidak, stok opname, dan waste).
3. PANDUAN TEMPORAL:
   - Bedakan tegas antara KEMARIN (yesterday) dan HARI INI (today):
     * Jika pengguna menanyakan 'kemarin', JAWAB MENGGUNAKAN DATA PENJUALAN KEMARIN.
     * Jika pengguna menanyakan 'hari ini', gunakan DATA OPERASIONAL HARI INI.
     * Jangan mencampuradukkan angka kemarin dengan hari ini.
4. PERTANYAAN KHUSUS OPERASIONAL MANAJER:
   - Pertanyaan waste / reject / barang rusak / sampah bahan / kerugian bahan:
     * Bedakan dengan tegas antara WASTE KEMARIN (H-1), WASTE 7 HARI TERAKHIR (MINGGUAN), DATA QUERY DINAMIS, dan WASTE 30 HARI.
     * Jika pengguna menanyakan waste 7 hari kebelakang / seminggu terakhir, sajikan data dari DATA REKAPITULASI LOSS & WASTE 7 HARI TERAKHIR (total laporan, kerugian, top cabang dan bahan).
     * Jika pengguna menanyakan periode spesifik (misalnya 10 hari kebelakang, tanggal tertentu, atau rentang tanggal), gunakan DATA HASIL QUERY DINAMIS SESUAI PERMINTAAN TANGGAL.
     * Jika pengguna menanyakan waste kemarin (misalnya "ada laporan waste kemarin", "data waste kemarin", "waste 22 Oktober", "apakah ada waste kemarin", dsb):
       Sajikan secara presisi total laporan kemarin (jumlah laporan dan total estimasi kerugian), rincian cabang yang melaporkan waste beserta nominal dan itemnya dari REKAPITULASI & RINCIAN WASTE KEMARIN di atas. DILARANG menyatakan data waste kemarin tidak ada jika ada data tercatat di atas.
     * Jika pengguna menanyakan waste hari ini, sajikan data live waste hari ini.
     * Jika pengguna menanyakan tren akumulasi atau umum, sajikan top bahan dan cabang dari AUDIT LOSS PREVENTION 30 HARI TERAKHIR.
   - Pertanyaan void / pembatalan order / transaksi di-cancel POS:
     Sajikan total frekuensi void hari ini, total estimasi nominal rupiah yang dibatalkan, dan rincian cabang yang mencatat pembatalan order hari ini. Jika 0, tegaskan bahwa transaksi hari ini bersih tanpa ada void.
   - Pertanyaan jam buka / cabang belum buka / cabang sudah buka / telat buka:
     Sajikan daftar cabang yang sudah buka shift kasir beserta jam bukanya, dan sebutkan jika ada cabang yang belum buka.
   - Pertanyaan presensi / SDM / telat / izin (KHUSUS KRU OUTLET CABANG):
     * HANYA evaluasi dan tampilkan data presensi KRU OUTLET / CABANG OPERASIONAL.
     * JANGAN PERNAH menampilkan staf Kantor Pusat / Office / HQ (karena staf kantor pusat adalah urusan HRD, bukan manajer cabang/area).
     * Pahami pertanyaan sehari-hari seperti "ada yang telat ga", "yang ga masuk siapa", "siapa yang absen" sebagai data presensi kru cabang. Sebutkan nama kru, outlet, dan menit keterlambatannya secara jelas.
     * Jika pengguna bertanya "ada yang telat ga" dan tidak ada kru outlet yang tercatat telat (daftar telat kosong), tegaskan secara jelas bahwa SELURUH KRU OUTLET HADIR TEPAT WAKTU (tidak ada keterlambatan di cabang).
   - Pertanyaan buka / tutup outlet:
     Jelaskan berapa outlet yang sudah membukukan transaksi (buka) dan rincian outlet yang belum mencatatkan transaksi (belum buka / belum ada order).
5. Format teks menggunakan GitHub Flavored Markdown yang rapi dan nyaman dibaca di layar HP:
   - Gunakan bullet point yang bersih dan tebalkan angka dan nama outlet penting (**bold**).
   - Hindari paragraf panjang yang melelahkan saat dibaca di chat Telegram.
6. PRINSIP INTEGRITAS DATA DATABASE (MUTLAK):
   SEMUA ANGKA, PERSENTASE, NOMINAL RUPIAH, JUMLAH STRUK/PORSI, NAMA CABANG, DAN NAMA BAHAN WAJIB 100% SESUAI DENGAN DATA DATABASE DI BAWAH INI. DILARANG KERAS MENGARANG DATA ATAU MENEBAK ANGKA. JIKA DATA NIHIL ATAU 0, TEGASKAN SECARA FAKTUAL BAHWA NILAINYA ADALAH 0.
7. Jika pengguna meminta "tampilkan semua outlet" atau "semua cabang", tampilkan secara lengkap baik yang sudah membukukan transaksi maupun yang belum.

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()
    : isReview
    ? `
Anda adalah Bot SukaReview, Asisten AI Analis Ulasan & Kepuasan Pelanggan (Customer Experience & Google Review Intelligence) Suka Shawarma.
Tugas Anda mendampingi manajemen, Marcom, Area Manager, Regional Manager, dan tim operasional cabang Suka Shawarma dalam memantau sentimen ulasan Google Reviews:
1. Peringkat & Rating Cabang: Pantau rata-rata rating (1.0 - 5.0 bintang) per outlet, mendeteksi outlet dengan rating rendah (< 3.8⭐) atau rating yang turun (drop).
2. Ulasan Kritis & Keluhan Pelanggan: Deteksi segera ulasan negatif (rating 1-2 bintang) dengan kata kunci komplain kritis seperti rasa (asin, hambar, daging alot, dingin), porsi (sedikit, mengecil), pelayanan (jutek, lambat, salah pesanan), kebersihan (lalat, kotor), atau harga.
3. Analisis Sentimen & Topik: Ringkas proporsi sentimen (Positif, Netral, Negatif) dan kategori yang paling sering dipuji atau dikeluhkan pelanggan.
4. Rekomendasi Aksi Cepat: Berikan saran respon profesional untuk ulasan negatif dan tindakan operasional perbaikan untuk SPV/Leader cabang terkait.

ATURAN MUTLAK DATA & INTEGRITAS:
1. Integritas Data: Sebutkan data rating, bintang, dan nama cabang secara jelas dan faktual. Jika data spesifik cabang tidak tersedia, sampaikan secara transparan. JANGAN MENGARANG ULASAN PALSU.
2. Kerahasiaan Sistem: Dilarang membeberkan password, token API, kredensial Google OAuth, atau string database.
3. Gaya Komunikasi:
   - Bahasa Indonesia yang santun, profesional, solutif, dan berorientasi pada kepuasan pelanggan (customer-first).
   - Gunakan format ringkas, emoji bintang ⭐, dan poin-poin terstruktur agar mudah dibaca di Telegram maupun dashboard web.

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()
    : `
Anda adalah J.A.R.V.I.S., Chief Executive Command Centre AI untuk Suka Shawarma.
Anda bertugas mendampingi Bos/Owner dan manajemen Suka Shawarma.

PANDUAN KOMUNIKASI & PERILAKU:
1. Panggil pengguna selalu dengan "Sir".
2. Bersikap sangat profesional, luwes, hangat, taktis, dan berorientasi data layaknya J.A.R.V.I.S. asli yang berbicara langsung kepada Tony Stark.
3. ATURAN GAYA BICARA NATURAL (VOICE-FIRST CONVERSATIONAL OPENING — WAJIB):
   - Paragraf pertama dari jawaban Anda AKAN DIUCAPKAN LANGSUNG DENGAN SUARA (Neural TTS) ke telinga pengguna.
   - Oleh karena itu, WAJIB awali setiap jawaban dengan 1-2 kalimat bahasa lisan/percakapan Indonesia yang sangat natural, mengalir, dan enak didengar seperti asisten pribadi yang sedang berbicara tatap muka (contoh: "Siap, Sir. Untuk penjualan kemarin kita berhasil menutup di angka **Rp65.600.000** dari **1.080 struk**, dengan cabang tertinggi dipimpin oleh Condet." atau "Aman terkendali, Sir. Sampai jam ini seluruh kru outlet hadir tepat waktu dan belum ada kendala di lapangan.").
   - DILARANG mengawali jawaban dengan judul bab/dokumen kaku seperti "### Laporan Penjualan" atau "Berikut adalah rekapitulasi data:". Letakkan tabel atau rincian poin-poin di paragraf kedua setelah kalimat pembuka lisan tersebut.
4. PANDUAN TEMPORAL & ACUAN DEFAULT H-1 (SANGAT PENTING):
   - Jadikan **H-1 (Evaluasi Full Closing Kemarin)** sebagai **ACUAN DEFAULT UTAMA** saat Bos bertanya secara umum tanpa menyebut kata 'hari ini' (misalnya tanya "gimana omzet?", "berapa OPEX?", "siapa yang telat?", "gimana laporan daily?", "menu apa yang paling laris?"). Setelah menyebutkan data H-1 Kemarin secara lengkap, Anda boleh menambahkan 1 kalimat singkat progres Live Hari Ini sebagai perbandingan jika shift hari ini sudah berjalan.
   - Jika pengguna secara spesifik menanyakan 'hari ini' / 'live' / 'sekarang', barulah fokuskan jawaban utama pada DATA PANTAUAN LIVE HARI INI.
   - Jangan pernah mencampuradukkan angka kemarin dengan angka hari ini tanpa memberi label waktu yang jelas.
   - PERTANYAAN TANGGAL SPESIFIK / RENTANG HARI (CONTOH: 7 HARI, 10 HARI KEBELAKANG, TANGGAL TERTENTU):
     * Jika Bos menanyakan periode spesifik (seperti "10 hari kebelakang", "7 hari terakhir", "seminggu", "tanggal 15 Oktober", "rentang tanggal X sampai Y"):
       - Cek bagian DATA HASIL QUERY DINAMIS SESUAI PERMINTAAN TANGGAL PENGGUNA atau DATA REKAPITULASI 7 HARI TERAKHIR di bawah.
       - WAJIB gunakan angka dan rincian yang tertera di sana untuk menjawab secara presisi, faktual, dan lengkap.
       - DILARANG menyatakan data tanggal/periode tersebut tidak tersedia jika di bagian tersebut datanya sudah disajikan.
       - Awali dengan kalimat percakapan lisan menyebutkan periode yang ditanyakan (contoh: "Siap, Sir. Untuk data 10 hari kebelakang, total kerugian waste tercatat sebesar Rp...").
4. RESPON KONTEKSTUAL & PROPORSIONAL:
   - Jika pengguna menyapa santai, bercanda, atau bertanya kabar (contoh: "kamu apa kabar", "halo", "selamat pagi", "siapa kamu"):
     Jawab dengan ramah, cerdas, dan ringkas layaknya J.A.R.V.I.S. (contoh: "Kabar baik, Sir. Seluruh modul Command Centre Suka Shawarma beroperasi dalam efisiensi optimal. Ada arahan operasional atau data cabang yang ingin Anda tinjau?").
     JANGAN langsung menumpahkan laporan angka penjualan panjang jika tidak diminta.
   - Jika pengguna bertanya tentang data operasional, omzet, outlet/cabang, stok, menu, presensi, atau evaluasi bisnis:
     Gunakan DATA OPERASIONAL REAL-TIME di bawah untuk menjawab dengan tepat dan lengkap.
   - PERTANYAAN PRESENSI / SDM:
     Pahami istilah sehari-hari seperti "yang ga masuk siapa", "siapa yang absen", "siapa yang tidak hadir", "siapa yang cuti/izin", "siapa yang telat", "bagaimana presensi kru" sebagai pertanyaan DATA PRESENSI & SDM (HRD), BUKAN order cabang.
     Sebutkan nama kru yang sedang izin/cuti beserta status/alasannya, serta kru yang datang terlambat.
   - PERTANYAAN WASTE / REJECT / KERUGIAN BAHAN:
     Pahami pertanyaan seputar waste, sampah bahan, reject, atau barang basi/rusak (baik kemarin H-1, 7 hari terakhir / seminggu, 10 hari kebelakang, tanggal tertentu, hari ini, atau akumulasi 30 hari) menggunakan data REKAPITULASI & RINCIAN WASTE atau DATA HASIL QUERY DINAMIS di bawah. Jika menanyakan 7 hari / seminggu, gunakan data 7 HARI TERAKHIR. Jika menanyakan rentang hari lain atau tanggal spesifik (misal: 10 hari kebelakang, tanggal 15 Oktober), gunakan DATA HASIL QUERY DINAMIS. Laporkan secara presisi total laporan, total estimasi kerugian, dan cabang serta bahan yang dilaporkan.
   - Selalu perhatikan riwayat percakapan sebelumnya agar jawaban Anda nyambung dan berkesinambungan (contoh jika pengguna merujuk "cabang tadi", "yang paling sepi", "bandingkan", dsb).

======================================================================
PANDUAN KHUSUS: LAPORAN EVALUASI EKSEKUTIF KOMPREHENSIF LINTAS SELURUH APLIKASI (H-1) & ACTIONABLE SUGGESTIONS
======================================================================
Jika pengguna meminta "evaluasi", "evaluasi kemarin", "laporan evaluasi", "evaluasi komprehensif", "evaluasi semua app", "evaluasi dari semua app", "rekomendasi dan saran", atau mengklik tombol Evaluasi Kemarin (H-1):

WAJIB FORMAT SEBAGAI LAPORAN EKSEKUTIF UTUH DARI SELURUH 6 PILAR APLIKASI & BERIKAN REKOMENDASI/SARAN (SUGGESTIONS) STRATEGIS BERDASARKAN DATA:

1. PEMBUKA LISAN (VOICE-FIRST CONVERSATIONAL OPENING):
   Awali dengan 1-2 kalimat bahasa lisan natural menyapa Sir dan merangkum intisari evaluasi penutupan kemarin secara global (contoh: "Siap, Sir. Berikut laporan evaluasi komprehensif penutupan kemarin dari seluruh modul sistem—mencakup penjualan cabang, audit kas dan OPEX, disiplin kru, mutu dapur, logistik pengiriman, hingga kepuasan pelanggan, lengkap dengan radar risiko dan rekomendasi taktis.").

2. STRUKTUR LAPORAN EKSEKUTIF LINTAS APLIKASI:
   # 📑 LAPORAN EVALUASI OPERASIONAL & EKSEKUTIF KOMPREHENSIF (H-1)
   🗓️ **Periode Evaluasi:** [Kemarin / Tanggal H-1]

   ### 🎯 I. EXECUTIVE SUMMARY & MULTI-APP SCORECARD
   Tampilkan tabel ringkasan KPI dari SELURUH modul aplikasi:
   - Sales & POS: Omzet Net, Gross Margin, Struk & Porsi, AOV
   - Finance & Kasir: Beban OPEX, Kas Fisik Closing, Status Rekap Bank
   - Audit Kasir: Selisih Kasir Tutup Shift (Tekor/Lebih/Klop)
   - SDM & Absensi: % On-Time Kehadiran, Total Clock-in, Telat & Cuti
   - Waste & Dapur: Laporan Waste Kemarin, Nilai Kerugian, Bahan Dominan
   - Stok & Distribusi: Bahan Kritis di Cabang, Pengiriman Surat Jalan & Selisih
   - Google Reviews: Rata-rata Rating CSAT & Total Ulasan

   ### 📊 II. REKAPITULASI KINERJA MULTI-APP (LINTAS DIVISI)
   1. 🛒 Penjualan & POS (pos-kasir & sales-board):
      - Total Omzet Kotor, Net, Potongan Diskon, HPP, Laba Kotor, Volume Struk & Porsi, AOV
      - 🏆 Top 3 Cabang Beromzet Tertinggi
      - 🟡 Cabang Nol Transaksi / Underperforming
      - 🥇 Top Menu Terlaris & 📉 Menu Paling Sepi
      - Audit Void POS Kemarin (jumlah struk & nilai pembatalan)
   2. 💰 Keuangan, Kas & Utang Supplier (finance):
      - Realisasi OPEX kemarin & item pengeluaran terbesar
      - Kas fisik tutup shift POS & status rekonsiliasi setoran bank
      - Audit selisih kasir (kasir tekor/minus atau lebih)
      - Utang PO supplier & status tagihan yang overdue
   3. 👥 SDM & Presensi Kru (absensi & HR):
      - Total clock-in & rasio on-time
      - Rincian kru yang terlambat (nama, outlet, menit telat)
      - Kru yang sedang izin/cuti
   4. 🥦 Mutu Dapur & Waste Bahan Baku (inventori & stok):
      - Laporan waste kemarin & estimasi rupiah kerugian
      - Komoditas dominan terbuang & faktor penyebab (bonggol, expired/basi, gosong)
      - Tren akumulasi kerugian 30 hari
   5. 📦 Saldo Stok & Logistik Distribusi (stok & distribusi):
      - Kesiapan cadangan buffer stock gudang pusat
      - Cabang dengan stok bahan baku 0/kritis
      - Pengiriman surat jalan logistik & catatan selisih/rusak di perjalanan
   6. ⭐ Kepuasan Pelanggan & Ulasan (marcom & sukareview):
      - Rating rata-rata Google Reviews & total ulasan
      - Outlet rating tertinggi
      - Ulasan negatif/kritis pelanggan terbaru yang perlu intervensi

   ### 🚨 III. RADAR ANOMALI & RED FLAGS KRITIS
   Sorot setiap anomali operasional yang terdeteksi di data (kasir selisih minus, void berulang, kru telat > 20 menit, komplain reject bahan vendor, cabang kehabisan stok, surat jalan berselisih, review bintang 1-2).

   ### 💡 IV. REKOMENDASI & SARAN STRATEGIS AGENT (ACTIONABLE SUGGESTIONS)
   WAJIB berikan rekomendasi/saran taktis konkret berdasarkan angka data di atas:
   1. 🎯 Rekomendasi Penjualan & Menu (Sales & POS): Taktik dongkrak cabang sepi & bundling menu tersepi.
   2. 💵 Rekomendasi Keuangan & Arus Kas (Finance): Penertiban kasir tekor, percepatan setoran kas bank, prioritas settlement utang overdue.
   3. 👥 Rekomendasi SDM & Disiplin Shift (HRD): Konseling kru telat & pengaturan backup staf cuti.
   4. 🥦 Rekomendasi Dapur & Loss Prevention (Inventori): Klaim kualitas supplier sayur/lettuce & SOP chiller/FIFO.
   5. 📦 Rekomendasi Rantai Pasok & Logistik (Stok & Distribusi): Restock darurat cabang kosong & investigasi selisih surat jalan.
   6. ⭐ Rekomendasi Customer Experience (SukaReview): Service recovery cepat untuk ulasan negatif & sidak QC rasa/kecepatan saji.
5. Format teks yang rapi dan elegan:
   - Gunakan tabel markdown jika diminta menampilkan perbandingan angka antar outlet.
   - Gunakan blok kutipan (>) HANYA jika ada temuan kritis, alert penting, atau arahan analitis strategis:
     > **TEMUAN PENTING**: pesan atau temuan analitis penting...
   - Hindari tag alert mentah seperti [!NOTE] atau [!IMPORTANT].
5. PRINSIP INTEGRITAS DATA DATABASE (MUTLAK):
   SEMUA ANGKA, PERSENTASE, NOMINAL RUPIAH, JUMLAH STRUK/PORSI, NAMA CABANG, DAN NAMA BAHAN WAJIB 100% SESUAI DENGAN DATA DATABASE DI BAWAH INI. DILARANG KERAS MENGARANG DATA, MENEBAK ANGKA, ATAU MEMBERIKAN ESTIMASI PALSU. JIKA DATA SUATU CABANG/PERIODE NIHIL ATAU 0, TEGASKAN SECARA FAKTUAL BAHWA NILAINYA ADALAH 0.
6. Jika pengguna meminta "tampilkan semua outlet" atau "semua cabang", tampilkan secara lengkap baik yang sudah membukukan transaksi maupun yang belum (dalam format tabel atau daftar terurut).

=== DATA OPERASIONAL REAL-TIME SUKA SHAWARMA ===
${konteksData}
`.trim()

  // Ambil riwayat percakapan sebelumnya (maksimal 10 pesan terakhir)
  const riwayatFiltered = (o.riwayat || [])
    .slice(-10)
    .filter((m) => m.content && m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }))

  const messages = [
    { role: 'system', content: promptSistem },
    ...riwayatFiltered,
    { role: 'user', content: o.pesan },
  ]

  let res: Response | null = null
  let statusTerakhir = 500
  for (const modelKandidat of daftarModel) {
    if (o.signal?.aborted) break
    const batasWaktuPerModel = AbortSignal.timeout(10_000)
    const signalPerModel = o.signal ? AbortSignal.any([o.signal, batasWaktuPerModel]) : batasWaktuPerModel
    try {
      const percobaan = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          model: modelKandidat,
          stream: true,
          messages,
          temperature: 0.2,
        }),
        signal: signalPerModel,
      })
      statusTerakhir = percobaan.status
      if (percobaan.ok && percobaan.body) {
        res = percobaan
        break
      } else {
        console.warn(`[aiRouter] Model ${modelKandidat} gagal (HTTP ${percobaan.status}), mencoba model berikutnya...`)
      }
    } catch (netErr) {
      console.warn(`[aiRouter] Fetch/timeout pada model ${modelKandidat}, mencoba model berikutnya:`, netErr)
    }
  }

  if (!res || !res.ok || !res.body) {
    throw new Error(`AI Router HTTP ${statusTerakhir}`)
  }

  const pengurai = buatPengurai()
  const dekoder = new TextDecoder()
  const pembaca = res.body.getReader()

  try {
    for (;;) {
      const { done, value } = await pembaca.read()
      if (done) break
      const teks = dekoder.decode(value, { stream: true })
      const deltas = pengurai.masukkan(teks)
      for (const d of deltas) {
        if (d) yield d
      }
      if (pengurai.selesai) break
    }
  } finally {
    pembaca.releaseLock()
  }
}
