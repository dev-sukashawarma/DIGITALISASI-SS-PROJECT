import { describe, it, expect } from 'vitest'
import { parseBalanceHistory } from './balanceHistory'

// Baris diambil dari BALANCE_HISTORY_REPORT Oktober 2026 (nomor rekening dikosongkan).
const HEADER =
  'Product ID,Transaction ID,Transaction Type,Line Type,Payment Channel,Reference,Currency,Amount,Balance,Debit or Credit,Created Date ISO,Time Zone,Created Date,Payment Date,Settlement Date,Completed Date,Bank Code,Account Number,Channel Reference,Name,Description,Invoice ID,Ledger Sequence'
const CSV = [
  HEADER,
  `72f67a14-8e64-4de7-9f56-2f5321206931,b76e4bb5-e144-452e-acc8-237a2c04f9da,PROCESSING_FEE_DEDUCTION,TRANSACTION,,72f67a14-8e64-4de7-9f56-2f5321206931,IDR,16000,2416930,DEBIT,2026-10-30T17:18:22.086Z,'+0700 UTC,"31 Oct 2026, 00:18:22","30 Oct 2026, 09:40:44",,"31 Oct 2026, 00:18:22",,,,,"Processing Fee Deduction - 2026-10-30T02:40:44.604Z",,9586098823`,
  `97250920-c913-453b-abee-0cbe4c28e45a,e15637e3-6cc0-4fce-b647-4ab429c338bf,QR_CODE_PAYMENT,TRANSACTION,QRIS,e7059325-5f4f-4a91-a343-dec9cea0aab6,IDR,78468,2432930,CREDIT,2026-10-28T11:26:09.945Z,'+0700 UTC,"28 Oct 2026, 18:26:09","28 Oct 2026, 18:26:08","30 Oct 2026, 18:23:54","30 Oct 2026, 18:23:54",,,240591728427,,,,9584725869`,
  `97250920-c913-453b-abee-0cbe4c28e45a,e15637e3-6cc0-4fce-b647-4ab429c338bf,QR_CODE_PAYMENT Fee,FEE,QRIS,e7059325-5f4f-4a91-a343-dec9cea0aab6,IDR,549,2432381,DEBIT,2026-10-30T11:23:54.000Z,'+0700 UTC,"30 Oct 2026, 18:23:54",,,"30 Oct 2026, 18:23:54",,,,,,,9584725870`,
  `84fcbe1e-4b7b-44f1-9c61-a627b9624ff2,c6430372-2f31-40b1-bf49-3f3e7f8d7981,QR_CODE_PAYMENT,TRANSACTION,QRIS,PR-fcd387d5-1793182282429,IDR,1,2354462,CREDIT,2026-10-28T10:12:07.227Z,'+0700 UTC,"28 Oct 2026, 17:12:07","28 Oct 2026, 17:12:06","30 Oct 2026, 17:18:11","30 Oct 2026, 17:18:11",,,1tmoz5901264,,,,9584376357`,
  `6c821b05-0d06-4013-9c44-b50eb51f0801,e30ff4a5-7c99-4f36-baca-3493adab354b,VA_PAYMENT,TRANSACTION,BRI,5a5b112b-edb2-4fcf-bd58-6ce5d44ee34d,IDR,154924,2330247,CREDIT,2026-10-17T11:34:23.166Z,'+0700 UTC,"17 Oct 2026, 18:34:23","17 Oct 2026, 18:34:22","17 Oct 2026, 18:34:23","17 Oct 2026, 18:34:23",BRI,,,Sukashawarma,"Order X, Mitra Y",,9582107546`,
  `wid-1,b524d262-9560-4882-af5c-1d6a3ff9061e,WITHDRAWAL,TRANSACTION,,wid-1,IDR,251258,2000000,DEBIT,2026-10-29T17:02:50.000Z,'+0700 UTC,"30 Oct 2026, 00:02:50",,,"30 Oct 2026, 00:02:50",,,,,,,9586000000`,
  `11111111-0000-0000-0000-000000000000,da2dbdb4-0000-0000-0000-000000000002,QR_CODE_PAYMENT,TRANSACTION,QRIS,da2dbdb4-e03a-4536-9f42-992cb2e86a3a,IDR,2,1,CREDIT,2026-10-16T07:50:01.000Z,'+0700 UTC,"16 Oct 2026, 14:50:01","16 Oct 2026, 14:50:01","18 Oct 2026, 14:50:01","18 Oct 2026, 14:50:01",,,abc,,,,1`,
].join('\n')

describe('parseBalanceHistory', () => {
  it('hanya mengambil baris pembayaran masuk (TRANSACTION + CREDIT)', () => {
    const rows = parseBalanceHistory(CSV)
    expect(rows.map(r => r.xenditId)).toEqual([
      'e15637e3-6cc0-4fce-b647-4ab429c338bf',
      'c6430372-2f31-40b1-bf49-3f3e7f8d7981',
      'e30ff4a5-7c99-4f36-baca-3493adab354b',
      'da2dbdb4-0000-0000-0000-000000000002',
    ])
  })

  it('membaca Payment Date WIB menjadi ISO UTC', () => {
    const qris = parseBalanceHistory(CSV)[0]
    expect(qris.dibayarAt).toBe('2026-10-28T11:26:08.000Z')
    expect(qris.nominal).toBe(78468)
    expect(qris.xenditRef).toBe('e7059325-5f4f-4a91-a343-dec9cea0aab6')
    expect(qris.refQris).toBe('240591728427')
    expect(qris.channel).toBe('QRIS')
    expect(qris.bukanPenjualan).toBe(false)
  })

  it('Reference PR- dan nominal < 1000 ditandai bukan penjualan', () => {
    const rows = parseBalanceHistory(CSV)
    expect(rows[1].bukanPenjualan).toBe(true) // PR-
    expect(rows[3].bukanPenjualan).toBe(true) // Rp 2
  })

  it('VA tanpa Channel Reference → refQris null, kolom berkoma tetap terbaca', () => {
    const va = parseBalanceHistory(CSV)[2]
    expect(va.refQris).toBeNull()
    expect(va.channel).toBe('BRI')
    expect(va.nominal).toBe(154924)
  })

  it('header tidak dikenal → error yang jelas', () => {
    expect(() => parseBalanceHistory('a,b,c\n1,2,3')).toThrow(/Balance History/)
  })
})
