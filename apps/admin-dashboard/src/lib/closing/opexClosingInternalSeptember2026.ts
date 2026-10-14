// File ini DIBANGKITKAN oleh scripts/closing/bangkitkan_opex_internal_sept2026.py.
// Jangan diedit tangan. Salinan identik ada di apps/finance/src/lib/closing/.

export type BarisOpexOutlet = 'pengeluaran_outlet' | 'gaji_crew_outlet' | 'bonus_crew' | 'bonus_area_manager' | 'bonus_regional_manager' | 'lembur' | 'ads' | 'endorsement' | 'promo' | 'pdam' | 'pln' | 'internet' | 'sewa_outlet'
export type BarisOpexPusat = 'pdam' | 'pln' | 'internet' | 'pengeluaran_global' | 'gaji_staff_kantor' | 'crew_backup' | 'transport' | 'bahan_baku' | 'ads'

export interface ClosingOpexOutlet {
  nama: string
  kolomExcel: string
  target: Record<BarisOpexOutlet, number>
  totalExcel: number
  alasan: Partial<Record<BarisOpexOutlet, string>>
}
export interface ClosingOpexPusat {
  target: Record<BarisOpexPusat, number>
  totalExcel: number
  alasan: Partial<Record<BarisOpexPusat, string>>
}
export interface ClosingOpexBulan {
  from: string
  to: string
  sumber: string
  outlets: Record<string, ClosingOpexOutlet>
  pusat: ClosingOpexPusat
}

export const BARIS_OPEX_OUTLET: BarisOpexOutlet[] = ["pengeluaran_outlet", "gaji_crew_outlet", "bonus_crew", "bonus_area_manager", "bonus_regional_manager", "lembur", "ads", "endorsement", "promo", "pdam", "pln", "internet", "sewa_outlet"]
export const BARIS_OPEX_PUSAT: BarisOpexPusat[] = ["pdam", "pln", "internet", "pengeluaran_global", "gaji_staff_kantor", "crew_backup", "transport", "bahan_baku", "ads"]

export const CLOSING_OPEX_INTERNAL_SEPT_2026: ClosingOpexBulan = {
  "from": "2026-09-01",
  "to": "2026-09-30",
  "sumber": "SS LAP. LABA RUGI 2026 fixxxxx.xlsx — sheet FIXED SEPTEMBER 2026",
  "outlets": {
    "ss-online": {
      "nama": "SS Online",
      "kolomExcel": "B",
      "target": {
        "pengeluaran_outlet": 0,
        "gaji_crew_outlet": 6630000,
        "bonus_crew": 0,
        "bonus_area_manager": 0,
        "bonus_regional_manager": 0,
        "lembur": 0,
        "ads": 0,
        "endorsement": 0,
        "promo": 0,
        "pdam": 0,
        "pln": 0,
        "internet": 260850,
        "sewa_outlet": 0
      },
      "totalExcel": 6890850,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Slip Gilang, Ismansyah & Abdul Hanan dibebankan ke SS Online",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440001": {
      "nama": "SUKA SHAWARMA BNR",
      "kolomExcel": "C",
      "target": {
        "pengeluaran_outlet": 7900,
        "gaji_crew_outlet": 11202714,
        "bonus_crew": 148801,
        "bonus_area_manager": 0,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 0,
        "promo": 0,
        "pdam": 0,
        "pln": 0,
        "internet": 0,
        "sewa_outlet": 0
      },
      "totalExcel": 11487639,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Slip Gilang & Ismansyah dibebankan ke SS Online",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lemburan a.n Gilang tidak dihitung; lembur Aby pindah ke pusat",
        "internet": "Pulsa HP Kitchen tidak dihitung"
      }
    },
    "550e8400-e29b-41d4-a716-446655440002": {
      "nama": "SUKA SHAWARMA EMPANG",
      "kolomExcel": "D",
      "target": {
        "pengeluaran_outlet": 3629500,
        "gaji_crew_outlet": 10369638,
        "bonus_crew": 457199,
        "bonus_area_manager": 175680,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 498000,
        "endorsement": 580000,
        "promo": 248500,
        "pdam": 107750,
        "pln": 395000,
        "internet": 218290,
        "sewa_outlet": 6250000
      },
      "totalExcel": 23057781,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440004": {
      "nama": "SUKA SHAWARMA CIMANGGU",
      "kolomExcel": "E",
      "target": {
        "pengeluaran_outlet": 3561000,
        "gaji_crew_outlet": 8602714,
        "bonus_crew": 368138,
        "bonus_area_manager": 175680,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 450000,
        "promo": 152000,
        "pdam": 375300,
        "pln": 0,
        "internet": 194250,
        "sewa_outlet": 5417000
      },
      "totalExcel": 19424306,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440005": {
      "nama": "SUKA SHAWARMA DEPOK SUKMAJAYA",
      "kolomExcel": "F",
      "target": {
        "pengeluaran_outlet": 3884000,
        "gaji_crew_outlet": 6327714,
        "bonus_crew": 278434,
        "bonus_area_manager": 124988,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 370000,
        "promo": 115667,
        "pdam": 0,
        "pln": 407000,
        "internet": 316350,
        "sewa_outlet": 6167000
      },
      "totalExcel": 18119377,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Bongkaran Sawangan tidak dihitung; lembur kas kecil di Pengeluaran Outlet"
      }
    },
    "550e8400-e29b-41d4-a716-446655440006": {
      "nama": "SUKA SHAWARMA JAGAKARSA",
      "kolomExcel": "G",
      "target": {
        "pengeluaran_outlet": 2257368,
        "gaji_crew_outlet": 6502715,
        "bonus_crew": 212650,
        "bonus_area_manager": 70550,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 650000,
        "promo": 155334,
        "pdam": 0,
        "pln": 403650,
        "internet": 316350,
        "sewa_outlet": 4375000
      },
      "totalExcel": 15071841,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440007": {
      "nama": "SUKA SHAWARMA BEJI",
      "kolomExcel": "H",
      "target": {
        "pengeluaran_outlet": 1976000,
        "gaji_crew_outlet": 6327714,
        "bonus_crew": 209316,
        "bonus_area_manager": 151850,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 0,
        "promo": 39667,
        "pdam": 0,
        "pln": 404500,
        "internet": 333000,
        "sewa_outlet": 3000000
      },
      "totalExcel": 12570271,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440008": {
      "nama": "SUKA SHAWARMA SAWANGAN (INTERNAL)",
      "kolomExcel": "I",
      "target": {
        "pengeluaran_outlet": 2476313,
        "gaji_crew_outlet": 0,
        "bonus_crew": 0,
        "bonus_area_manager": 0,
        "bonus_regional_manager": 0,
        "lembur": 0,
        "ads": 1332000,
        "endorsement": 2220000,
        "promo": 436340,
        "pdam": 0,
        "pln": 0,
        "internet": 316350,
        "sewa_outlet": 3333333
      },
      "totalExcel": 10114336,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440009": {
      "nama": "SUKA SHAWARMA PAJAJARAN",
      "kolomExcel": "J",
      "target": {
        "pengeluaran_outlet": 1996500,
        "gaji_crew_outlet": 6023713,
        "bonus_crew": 70350,
        "bonus_area_manager": 107500,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 250000,
        "promo": 153667,
        "pdam": 79200,
        "pln": 0,
        "internet": 260850,
        "sewa_outlet": 2000000
      },
      "totalExcel": 11070004,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440010": {
      "nama": "SUKA SHAWARMA JATIWARINGIN",
      "kolomExcel": "K",
      "target": {
        "pengeluaran_outlet": 2598500,
        "gaji_crew_outlet": 4612713,
        "bonus_crew": 130800,
        "bonus_area_manager": 70550,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 700000,
        "promo": 117334,
        "pdam": 0,
        "pln": 464365,
        "internet": 392940,
        "sewa_outlet": 2084000
      },
      "totalExcel": 11299426,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440011": {
      "nama": "SUKA SHAWARMA CIRENDEU",
      "kolomExcel": "L",
      "target": {
        "pengeluaran_outlet": 2125000,
        "gaji_crew_outlet": 6081943,
        "bonus_crew": 215100,
        "bonus_area_manager": 151850,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 0,
        "endorsement": 400000,
        "promo": 77667,
        "pdam": 0,
        "pln": 225000,
        "internet": 260850,
        "sewa_outlet": 2166667
      },
      "totalExcel": 11832301,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    },
    "550e8400-e29b-41d4-a716-446655440013": {
      "nama": "SUKA SHAWARMA DRAMAGA",
      "kolomExcel": "M",
      "target": {
        "pengeluaran_outlet": 2541525,
        "gaji_crew_outlet": 6212714,
        "bonus_crew": 248050,
        "bonus_area_manager": 175680,
        "bonus_regional_manager": 128224,
        "lembur": 0,
        "ads": 6274581,
        "endorsement": 275000,
        "promo": 153667,
        "pdam": 0,
        "pln": 0,
        "internet": 194250,
        "sewa_outlet": 2292000
      },
      "totalExcel": 18495691,
      "alasan": {
        "pengeluaran_outlet": "Kas kecil dikelompokkan ulang ke Pengeluaran Outlet sesuai closing",
        "gaji_crew_outlet": "Kru cadangan dibebankan ke pusat; alokasi gaji AM versi closing",
        "bonus_crew": "Bonus mengikuti slip payroll",
        "bonus_area_manager": "Bonus AM & RM mengikuti closing (RM dibagi rata 1/21)",
        "bonus_regional_manager": "Bonus RM dibagi rata 1/21 sesuai closing",
        "lembur": "Lembur kas kecil dihitung di Pengeluaran Outlet sesuai closing"
      }
    }
  },
  "pusat": {
    "target": {
      "pdam": 972800,
      "pln": 4502475,
      "internet": 2014650,
      "pengeluaran_global": 126079883,
      "gaji_staff_kantor": 71705768,
      "crew_backup": 8694636,
      "transport": 6368669,
      "bahan_baku": 1504609,
      "ads": 996780
    },
    "totalExcel": 222840270,
    "alasan": {
      "gaji_staff_kantor": "Slip Abdul Hanan dibebankan ke SS Online",
      "crew_backup": "Gaji & bonus kru SS BACKUP dibebankan ke pusat",
      "internet": "Pulsa KOL & Pulsa Markom tidak dihitung"
    }
  }
}
