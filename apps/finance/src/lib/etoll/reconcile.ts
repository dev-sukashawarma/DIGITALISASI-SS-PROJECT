import type {
  EtollCategory,
  EtollIssuer,
  EtollTerminalEntry,
  EtollTxType,
  IncomingChipTransaction,
} from './types'

const VALID_ISSUERS = new Set<EtollIssuer>([
  'mandiri_emoney',
  'bca_flazz',
  'bni_tapcash',
  'bri_brizzi',
])

export function isValidIssuer(v: unknown): v is EtollIssuer {
  return typeof v === 'string' && VALID_ISSUERS.has(v as EtollIssuer)
}

/**
 * Normalisasi nomor kartu: buang spasi/dash/karakter non-alfanumerik, huruf kapital.
 */
export function normalizeCardNumber(raw: string): string {
  return raw.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
}

export function isValidCardNumber(raw: string): boolean {
  const norm = normalizeCardNumber(raw)
  return norm.length >= 8 && norm.length <= 24
}

export function formatCardNumber(raw: string): string {
  const norm = normalizeCardNumber(raw)
  return norm.replace(/(.{4})/g, '$1 ').trim()
}

export function normalizeTerminalCode(raw: string | null | undefined): string | null {
  if (!raw) return null
  const clean = raw.replace(/\s+/g, '').toUpperCase()
  return clean.length > 0 ? clean : null
}

/**
 * Kunci deduplikasi deterministik agar scan ulang buffer ~10 transaksi chip
 * tidak pernah menciptakan baris ganda.
 */
export function buildChipTxDedupKey(tx: {
  tx_type: EtollTxType
  occurred_at: string
  amount: number
  balance_after?: number | null
  terminal_code?: string | null
}): string {
  const d = new Date(tx.occurred_at)
  // Bulatkan ke detik ISO UTC agar format offset (+07:00 vs Z) menghasilkan kunci identik.
  const isoSec = Number.isNaN(d.getTime())
    ? tx.occurred_at.trim()
    : d.toISOString().slice(0, 19)
  const bal = tx.balance_after != null && Number.isFinite(tx.balance_after)
    ? Math.round(tx.balance_after)
    : 'na'
  const term = normalizeTerminalCode(tx.terminal_code) ?? 'na'
  return `chip:${tx.tx_type}:${isoSec}:${Math.round(tx.amount)}:${bal}:${term}`
}

export function resolveTerminalDictionary(
  issuer: EtollIssuer,
  terminalCode: string | null,
  dictionary: Pick<EtollTerminalEntry, 'issuer' | 'terminal_code' | 'merchant_name' | 'default_category'>[],
): { merchant_label: string; category: EtollCategory; matched: boolean } | null {
  const norm = normalizeTerminalCode(terminalCode)
  if (!norm) return null

  const exact = dictionary.find(
    (entry) => entry.issuer === issuer && normalizeTerminalCode(entry.terminal_code) === norm,
  )
  if (exact) {
    return {
      merchant_label: exact.merchant_name,
      category: exact.default_category,
      matched: true,
    }
  }

  const fallbackAll = dictionary.find(
    (entry) => entry.issuer === 'all' && normalizeTerminalCode(entry.terminal_code) === norm,
  )
  if (fallbackAll) {
    return {
      merchant_label: fallbackAll.merchant_name,
      category: fallbackAll.default_category,
      matched: true,
    }
  }

  return null
}

export interface PreparedChipTransaction {
  tx_type: EtollTxType
  dedup_key: string
  occurred_at: string
  amount: number
  balance_after: number | null
  terminal_code: string | null
  merchant_label: string
  category: EtollCategory
  raw_hex: string | null
}

/**
 * Filter & persiapkan transaksi chip baru yang belum ada di database.
 * Juga melakukan deduplikasi internal jika chip mengirim entri identik dalam satu batch.
 */
export function prepareNewChipTransactions(params: {
  issuer: EtollIssuer
  incoming: IncomingChipTransaction[]
  existingDedupKeys: Set<string>
  dictionary: Pick<EtollTerminalEntry, 'issuer' | 'terminal_code' | 'merchant_name' | 'default_category'>[]
}): PreparedChipTransaction[] {
  const seen = new Set<string>(params.existingDedupKeys)
  const result: PreparedChipTransaction[] = []

  for (const raw of params.incoming) {
    if (raw.tx_type !== 'debit' && raw.tx_type !== 'topup') continue
    const amount = Math.round(Number(raw.amount))
    if (!Number.isFinite(amount) || amount <= 0) continue

    const parsedDate = new Date(raw.occurred_at)
    if (Number.isNaN(parsedDate.getTime())) continue
    const occurredAtIso = parsedDate.toISOString()

    const terminalCode = normalizeTerminalCode(raw.terminal_code)
    const balanceAfter =
      raw.balance_after != null && Number.isFinite(Number(raw.balance_after))
        ? Math.round(Number(raw.balance_after))
        : null

    const dedupKey = buildChipTxDedupKey({
      tx_type: raw.tx_type,
      occurred_at: occurredAtIso,
      amount,
      balance_after: balanceAfter,
      terminal_code: terminalCode,
    })

    if (seen.has(dedupKey)) continue
    seen.add(dedupKey)

    const dictHit = resolveTerminalDictionary(params.issuer, terminalCode, params.dictionary)

    let merchantLabel: string
    let category: EtollCategory
    if (dictHit) {
      merchantLabel = dictHit.merchant_label
      category = raw.tx_type === 'topup' ? 'topup' : dictHit.category
    } else if (raw.tx_type === 'topup') {
      merchantLabel = terminalCode ? `Top-Up (${terminalCode})` : 'Top-Up Saldo'
      category = 'topup'
    } else {
      merchantLabel = terminalCode ? `Terminal ${terminalCode}` : 'Transaksi e-Toll'
      category = 'belum_dikategorikan'
    }

    result.push({
      tx_type: raw.tx_type,
      dedup_key: dedupKey,
      occurred_at: occurredAtIso,
      amount,
      balance_after: balanceAfter,
      terminal_code: terminalCode,
      merchant_label: merchantLabel,
      category,
      raw_hex: raw.raw_hex?.trim() || null,
    })
  }

  return result
}

export interface UntrackedGapResult {
  /**
   * Nilai positif = ada pengeluaran (debit) yang tidak tercatat di log chip.
   * Nilai negatif = ada top-up yang tidak tercatat di log chip.
   * 0 = cocok 100% atau ini adalah scan pertama kartu.
   */
  gapAmount: number
  syntheticTransaction: {
    tx_type: EtollTxType
    amount: number
    category: EtollCategory
    merchant_label: string
    note: string
  } | null
}

/**
 * Deteksi selisih saldo tak terlacak antara scan sebelumnya dan scan sekarang.
 * Hanya dihitung jika kartu sudah pernah di-scan sebelumnya (`hasPriorScan === true`).
 */
export function computeUntrackedGap(params: {
  hasPriorScan: boolean
  previousBalance: number
  currentBalance: number
  newChipTransactions: Pick<PreparedChipTransaction, 'tx_type' | 'amount'>[]
}): UntrackedGapResult {
  if (!params.hasPriorScan) {
    return { gapAmount: 0, syntheticTransaction: null }
  }

  const chipTopups = params.newChipTransactions
    .filter((t) => t.tx_type === 'topup')
    .reduce((sum, t) => sum + t.amount, 0)

  const chipDebits = params.newChipTransactions
    .filter((t) => t.tx_type === 'debit')
    .reduce((sum, t) => sum + t.amount, 0)

  const expectedBalance = Math.round(params.previousBalance) + chipTopups - chipDebits
  const gapAmount = expectedBalance - Math.round(params.currentBalance)

  if (gapAmount === 0) {
    return { gapAmount: 0, syntheticTransaction: null }
  }

  if (gapAmount > 0) {
    return {
      gapAmount,
      syntheticTransaction: {
        tx_type: 'debit',
        amount: gapAmount,
        category: 'untracked_gap',
        merchant_label: 'Selisih Saldo Tak Terlacak',
        note: `Saldo turun Rp ${gapAmount.toLocaleString('id-ID')} di luar log chip (kemungkinan >10 transaksi tertimpa atau histori chip terbatas).`,
      },
    }
  }

  const untrackedInflow = Math.abs(gapAmount)
  return {
    gapAmount,
    syntheticTransaction: {
      tx_type: 'topup',
      amount: untrackedInflow,
      category: 'topup',
      merchant_label: 'Top-Up Terdeteksi dari Kenaikan Saldo',
      note: `Saldo naik Rp ${untrackedInflow.toLocaleString('id-ID')} tanpa baris log top-up terpisah di chip.`,
    },
  }
}

export interface PendingTopupCandidate {
  id: string
  topup_date: string // 'YYYY-MM-DD'
  amount: number
}

export interface TopupTransactionCandidate {
  id: string
  occurred_at: string
  amount: number
}

export interface MatchedTopupPair {
  topupId: string
  transactionId: string
}

function toWibDateMs(isoOrYmd: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrYmd)) {
    return Date.parse(`${isoOrYmd}T00:00:00+07:00`)
  }
  const d = new Date(isoOrYmd)
  const wibYmd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(d)
  return Date.parse(`${wibYmd}T00:00:00+07:00`)
}

/**
 * Cocokkan catatan top-up Finance (`waiting_scan`) dengan transaksi top-up
 * baru yang terbaca di chip (atau dari kenaikan saldo).
 * Aturan: nominal harus sama persis dan tanggal transaksi berada dalam rentang
 * -1 hari sampai +14 hari dari tanggal pemberian top-up (toleransi jeda update saldo).
 */
export function matchPendingTopups(
  pendingTopups: PendingTopupCandidate[],
  newTopupTxs: TopupTransactionCandidate[],
): MatchedTopupPair[] {
  const DAY_MS = 24 * 60 * 60 * 1000
  const usedTxIds = new Set<string>()
  const pairs: MatchedTopupPair[] = []

  const sortedPending = [...pendingTopups].sort((a, b) =>
    a.topup_date.localeCompare(b.topup_date),
  )

  for (const pending of sortedPending) {
    const pendingMs = toWibDateMs(pending.topup_date)
    let bestTx: TopupTransactionCandidate | null = null
    let bestDiffMs = Number.POSITIVE_INFINITY

    for (const tx of newTopupTxs) {
      if (usedTxIds.has(tx.id)) continue
      if (Math.round(tx.amount) !== Math.round(pending.amount)) continue

      const txMs = toWibDateMs(tx.occurred_at)
      const deltaDays = (txMs - pendingMs) / DAY_MS
      if (deltaDays < -1 || deltaDays > 14) continue

      const absDiff = Math.abs(txMs - pendingMs)
      if (absDiff < bestDiffMs) {
        bestDiffMs = absDiff
        bestTx = tx
      }
    }

    if (bestTx) {
      usedTxIds.add(bestTx.id)
      pairs.push({ topupId: pending.id, transactionId: bestTx.id })
    }
  }

  return pairs
}
