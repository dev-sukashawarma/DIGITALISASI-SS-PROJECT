"""Bangkitkan data closing Oktober 2026 dari sheet OKTOBER 2026 laporan final owner.

Menulis dua berkas:
  1. src/lib/closing/closingOktober2026.ts — laba kotor outlet internal (B–L) dan
     pendapatan pusat dari mitra (baris 53–54, M–Y) untuk Laba Rugi Internal.
  2. src/app/actions/mitraPnlClosingDataOktober2026.ts — laba rugi per outlet mitra
     (M–Y) untuk Dashboard Mitra dan Dashboard Kemitraan.

Setiap angka dicocokkan ulang dengan rumus Excel (baris 28/33/51/55) sebelum ditulis.

Pakai: python -I bangkitkan_closing_oktober2026.py <xlsx> <out_internal.ts> <out_mitra.ts>
"""
import sys
import openpyxl

SHEET = 'OKTOBER 2026'
SUMBER = 'bismillah fixed oktober SS LAP. LABA RUGI 2026 (1).xlsx — OKTOBER 2026'

INTERNAL = [  # kolom, header baris 2, kunci outlet
    ('B', 'SS ONLINE', 'ss-online'),
    ('C', 'SS KITCHEN', '550e8400-e29b-41d4-a716-446655440001'),   # BNR
    ('D', 'SS EMPANG', '550e8400-e29b-41d4-a716-446655440002'),
    ('E', 'SS BCC', '550e8400-e29b-41d4-a716-446655440004'),       # CIMANGGU
    ('F', 'SS SUKMAJAYA', '550e8400-e29b-41d4-a716-446655440005'),
    ('G', 'SS JAGAKARSA', '550e8400-e29b-41d4-a716-446655440006'),
    ('H', 'SS BEJI', '550e8400-e29b-41d4-a716-446655440007'),
    ('I', 'SS PAJAJARAN', '550e8400-e29b-41d4-a716-446655440009'),
    ('J', 'SS JATIWARINGIN', '550e8400-e29b-41d4-a716-446655440010'),
    ('K', 'SS CIRENDEU', '550e8400-e29b-41d4-a716-446655440011'),
    ('L', 'SS DRAMAGA', '550e8400-e29b-41d4-a716-446655440013'),
]

MITRA = [  # kolom, header baris 2, id outlet, nama di sistem
    ('M', 'SS CIBINONG', '550e8400-e29b-41d4-a716-446655440014', 'MITRA CIBINONG'),
    ('N', 'SS CISEENG', '550e8400-e29b-41d4-a716-446655440017', 'MITRA CISEENG'),
    ('O', 'SS PEKAYON', '550e8400-e29b-41d4-a716-446655440018', 'MITRA PEKAYON'),
    ('P', 'SS KALISARI', '550e8400-e29b-41d4-a716-446655440019', 'MITRA KALISARI'),
    ('Q', 'SS SAWANGAN', '5a4df577-5237-476e-b54c-9eb642a5a516', 'MITRA SAWANGAN DTC'),
    ('R', 'SS SENTUL', '43b7bbd1-1fd4-44b5-87ca-b07a271151af', 'MITRA SENTUL'),
    ('S', 'SS KOTWIS', '3f38c41d-11e3-49ce-a189-d7303e45f9ad', 'MITRA CIBUBUR'),
    ('T', 'SS CICURUG', 'd9a2ef93-c298-4501-a471-1c5e2b3dff08', 'MITRA CICURUG'),
    ('U', 'SS PALEDANG', '550e8400-e29b-41d4-a716-446655440003', 'MITRA PALEDANG'),
    ('V', 'SS PAMULANG', 'bba67dba-2dca-4e98-bdb2-6a9e265e288c', 'MITRA PAMULANG'),
    ('W', 'SS CILEUNGSI', '62a56103-2085-4dd5-9d25-a3c0cffc88ff', 'MITRA CILEUNGSI'),
    ('X', 'SS CILEDUG', '3d8cc715-3f2d-43c6-a7b0-1841d60de8f7', 'MITRA CILEUDUG'),
    ('Y', 'SS PONDOK AREN', '48b980da-5a42-4a9b-a952-86ab5db6666a', 'MITRA PONDOK AREN'),
]

LABEL_A = {
    3: 'REVENUE', 4: 'TOTAL COGS (HPP)', 9: 'REVENUE', 10: 'ADMIN FEE', 11: 'TOTAL COGS (HPP)',
    16: 'REVENUE', 17: 'TOTAL COGS (HPP)', 18: 'ADMIN FEE (COM & CREATORS)', 24: 'REVENUE',
    25: 'TOTAL COGS (HPP)', 28: 'TOTAL REVENUE', 29: 'TOTAL COGS (HPP)', 30: 'TOTAL WASTE',
    31: 'TOTAL ADMIN FEE', 32: 'MANAGEMENT FEE', 33: 'TOTAL GROSS PROFIT', 50: 'TOTAL OPEX',
    51: 'TOTAL NET PROFIT', 52: 'NET PROFIT MITRA', 53: 'NET PROFIT SS', 54: 'NET PROFIT HPP',
    55: 'TOTAL PROFIT SS', 73: 'TOTAL OPEX HQ',
}

OPEX = [  # baris, label laporan mitra, sumber
    (37, 'Pengeluaran Outlet', 'petty_cash'),
    (38, 'Gaji Crew Outlet', 'monthly'),
    (39, 'Bonus Crew', 'monthly'),
    (40, 'Bonus Area Manager', 'monthly'),
    (41, 'Bonus Regional Manager', 'monthly'),
    (42, 'Lembur', 'petty_cash'),
    (43, 'Ads', 'monthly'),
    (44, 'Endorsement', 'monthly'),
    (45, 'Promo', 'monthly'),
    (46, 'PDAM', 'monthly'),
    (47, 'PLN', 'monthly'),
    (48, 'Internet', 'monthly'),
    (49, 'Biaya Sewa Outlet', 'monthly'),
]


def gagal(msg):
    sys.exit(f'GAGAL: {msg}')


def main(xlsx, out_internal, out_mitra):
    ws = openpyxl.load_workbook(xlsx, data_only=True)[SHEET]
    v = lambda c: float(ws[c].value or 0)

    for r, label in LABEL_A.items():
        if str(ws[f'A{r}'].value).strip() != label:
            gagal(f'A{r} bukan {label!r}: {ws[f"A{r}"].value!r}')
    for col, header, *_ in INTERNAL + MITRA:
        if str(ws[f'{col}2'].value).strip() != header:
            gagal(f'{col}2 bukan {header!r}: {ws[f"{col}2"].value!r}')

    # ---- laba kotor internal (konvensi layar: omzet kotor, TikTok GO kotor) ----
    baris_int = []
    tot = dict(omzet=0.0, potongan=0.0, komisiTiktokKedua=0.0, hpp=0.0, waste=0.0)
    laba_internal = 0.0
    for col, _, kunci in INTERNAL:
        k = dict(
            omzet=v(f'{col}3') + v(f'{col}9') + v(f'{col}16') + v(f'{col}24'),
            potongan=v(f'{col}31'),
            komisiTiktokKedua=v(f'{col}18'),
            hpp=v(f'{col}29'),
            waste=v(f'{col}30'),
        )
        laba_kotor = k['omzet'] - k['potongan'] - k['komisiTiktokKedua'] - k['hpp'] - k['waste']
        if v(f'{col}32') != 0:
            gagal(f'{col}32 (fee manajemen outlet internal) harus 0')
        if abs(laba_kotor - v(f'{col}33')) > 0.01:
            gagal(f'{col}: laba kotor {laba_kotor} != {col}33 {v(f"{col}33")}')
        for x in tot:
            tot[x] += k[x]
        laba_internal += v(f'{col}51')
        baris_int.append(
            f"    '{kunci}': {{ kolomExcel: '{col}', omzet: {k['omzet']!r}, potongan: {k['potongan']!r}, "
            f"komisiTiktokKedua: {k['komisiTiktokKedua']!r}, hpp: {k['hpp']!r}, waste: {k['waste']!r} }},")

    # ---- pendapatan pusat dari mitra (baris 53–54) ----
    baris_pend = []
    total_pend = 0.0
    for col, _, oid, nama in MITRA:
        ss, hpp = v(f'{col}53'), v(f'{col}54')
        if abs(ss + hpp - v(f'{col}55')) > 0.01:
            gagal(f'{col}53+{col}54 != {col}55')
        total_pend += ss + hpp
        baris_pend.append(f"    '{oid}': {{ nama: '{nama}', kolomExcel: '{col}', bagiHasilSs: {ss!r}, marginHpp: {hpp!r} }},")

    net_internal = laba_internal + total_pend - v('B73')

    # ---- laba rugi per outlet mitra ----
    baris_mitra = []
    for col, _, oid, nama in MITRA:
        pos_rev, pos_cogs = v(f'{col}3') + v(f'{col}24'), v(f'{col}4') + v(f'{col}25')
        fa_rev, fa_cogs, fa_ded = v(f'{col}9'), v(f'{col}11'), v(f'{col}10')
        tk_rev, tk_cogs, tk_ded = v(f'{col}16'), v(f'{col}17'), v(f'{col}18')
        gross = pos_rev + fa_rev + tk_rev
        ded = fa_ded + tk_ded
        net_rev = gross - ded
        if abs(net_rev - (v(f'{col}28') - v(f'{col}31'))) > 0.01:
            gagal(f'{col}: pendapatan bersih {net_rev} != {col}28-{col}31')
        if abs(pos_cogs + fa_cogs + tk_cogs - v(f'{col}29')) > 0.01:
            gagal(f'{col}: HPP kanal != {col}29')
        cogs, waste, opex, fee = v(f'{col}29'), v(f'{col}30'), v(f'{col}50'), v(f'{col}32')
        net = v(f'{col}51')
        if abs(net_rev - cogs - waste - opex - fee - net) > 0.01:
            gagal(f'{col}: laba bersih tidak cocok dengan {col}51')
        mitra_share = v(f'{col}52')
        pct = round(mitra_share / net * 100) if net else 100
        if abs(net * pct / 100 - mitra_share) > 0.01:
            gagal(f'{col}: {col}52 bukan {pct}% dari {col}51')
        fee_pct = 3 if fee else 0
        if fee and abs(v(f'{col}28') * 0.03 - fee) > 0.01:
            gagal(f'{col}: fee manajemen bukan 3% {col}28')
        lines = []
        total_lines = 0.0
        for r, label, src in OPEX:
            amt = v(f'{col}{r}')
            if amt:
                total_lines += amt
                lines.append(f"      {{ label: '{label}', amount: {amt!r}, source: '{src}' }},")
        if abs(total_lines - opex) > 0.01:
            gagal(f'{col}: rincian OPEX {total_lines} != {col}50 {opex}')
        baris_mitra.append(f"""  '{oid}': {{
    name: '{nama}',
    pos: {{ revenue: {pos_rev!r}, cogs: {pos_cogs!r}, deductions: 0 }},
    foodApps: {{ revenue: {fa_rev!r}, cogs: {fa_cogs!r}, deductions: {fa_ded!r} }},
    tiktok: {{ revenue: {tk_rev!r}, cogs: {tk_cogs!r}, deductions: {tk_ded!r} }},
    totals: {{
      grossRevenue: {gross!r},
      totalDeductions: {ded!r},
      netRevenue: {net_rev!r},
      totalCogs: {cogs!r},
      grossProfit: {net_rev - cogs!r},
      totalWaste: {waste!r},
      totalOpex: {opex!r},
      managementFeePct: {fee_pct},
      managementFeeAmount: {fee!r},
      netProfit: {net!r},
      mitraShare: {mitra_share!r},
      profitSharingPct: {pct}
    }},
    opexLines: [
{chr(10).join(lines)}
    ]
  }},""")

    ts_internal = f"""// DIBANGKITKAN oleh scripts/closing/bangkitkan_closing_oktober2026.py — jangan diedit tangan.
// Sumber: {SUMBER}.

import type {{ KomponenLabaKotor }} from './labaKotorInternalClosingSeptember2026'
import type {{ PendapatanMitraClosing }} from './pendapatanMitraClosingSeptember2026'

/* Closing Oktober 2026 untuk Laba Rugi Internal (semua outlet).
 * Laba kotor kolom B–L dalam konvensi layar (omzet kotor, TikTok GO kotor), termasuk
 * komisi TikTok GO yang di laporan terpotong dua kali. Pendapatan pusat dari mitra =
 * baris NET PROFIT SS + NET PROFIT HPP kolom M–Y. Pendapatan lain-lain tidak dihitung. */

export const LABA_KOTOR_INTERNAL_CLOSING_OKT_2026 = {{
  label: 'Oktober 2026',
  from: '2026-10-01',
  to: '2026-10-31',
  sumber: '{SUMBER} B3:L33',
  /** Pendapatan lain-lain (Income Lainnya) yang dipakai closing. */
  pendapatanLain: 0,
  outlets: {{
{chr(10).join(baris_int)}
  }} as Record<string, KomponenLabaKotor & {{ kolomExcel: string }}>,
  total: {{ omzet: {tot['omzet']!r}, potongan: {tot['potongan']!r}, komisiTiktokKedua: {tot['komisiTiktokKedua']!r}, hpp: {tot['hpp']!r}, waste: {tot['waste']!r} }} as KomponenLabaKotor,
}}

export const PENDAPATAN_MITRA_CLOSING_OKT_2026 = {{
  label: 'Oktober 2026',
  from: '2026-10-01',
  to: '2026-10-31',
  sumber: '{SUMBER} M53:Y54',
  outlets: {{
{chr(10).join(baris_pend)}
  }} as Record<string, PendapatanMitraClosing>,
}}

/** Total Net Profit Internal laporan (B77), untuk tes. */
export const NET_PROFIT_INTERNAL_OKT_2026 = {net_internal!r}
"""
    ts_mitra = f"""// DIBANGKITKAN oleh scripts/closing/bangkitkan_closing_oktober2026.py — jangan diedit tangan.
// Sumber: {SUMBER}, kolom M–Y.

import type {{ MitraMonthlyClosingOutlet }} from './mitraPnlClosingData'

export const MITRA_CLOSING_DATA_OKTOBER_2026: Record<string, MitraMonthlyClosingOutlet> = {{
{chr(10).join(baris_mitra)}
}}
"""
    open(out_internal, 'w', encoding='utf-8', newline='\n').write(ts_internal)
    open(out_mitra, 'w', encoding='utf-8', newline='\n').write(ts_mitra)
    print(f"OK internal: omzet {tot['omzet']:,.0f} potongan {tot['potongan']:,.0f} komisi2 {tot['komisiTiktokKedua']:,.0f} "
          f"hpp {tot['hpp']:,.0f} waste {tot['waste']:,.0f} | laba outlet {laba_internal:,.2f}")
    print(f"OK pendapatan mitra: {total_pend:,.2f} | OPEX HQ {v('B73'):,.0f} | NET INTERNAL {net_internal:,.2f}")
    print(f"OK mitra: {len(MITRA)} outlet, total bagi hasil mitra {sum(v(c+'52') for c,*_ in MITRA):,.2f}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3])
