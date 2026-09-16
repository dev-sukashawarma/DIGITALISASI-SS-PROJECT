'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import * as XLSX from 'xlsx'

export interface ImportResult {
  success: boolean
  error?: string
  summary?: {
    outletsUpserted: number
    budgetsUpserted: number
    endorsementsImported: number
    postsCreated: number
    adsImported: number
    sheetsDetected: string[]
    period: string
  }
}

function parseExcelDate(val: any, defaultYear: number = 2026, defaultMonth: number = 9): Date | null {
  if (!val) return null
  if (val instanceof Date && !isNaN(val.getTime())) return val

  // Excel serial number
  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val)
    if (parsed) {
      return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d))
    }
  }

  // String format
  if (typeof val === 'string') {
    const s = val.trim()
    if (!s) return null

    // DD/MM/YYYY or DD-MM-YYYY
    const slashParts = s.split(/[\/\-]/)
    if (slashParts.length === 3) {
      const p0 = parseInt(slashParts[0], 10)
      const p1 = parseInt(slashParts[1], 10)
      const p2 = parseInt(slashParts[2], 10)

      if (p2 > 1000) {
        // DD/MM/YYYY
        return new Date(Date.UTC(p2, p1 - 1, p0))
      } else if (p0 > 1000) {
        // YYYY/MM/DD
        return new Date(Date.UTC(p0, p1 - 1, p2))
      }
    }

    const d = new Date(s)
    if (!isNaN(d.getTime())) return d
  }

  return new Date(Date.UTC(defaultYear, defaultMonth - 1, 15))
}

function parseNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  const cleaned = String(val).replace(/[^0-9.-]+/g, '')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export async function importExcelSpreadsheet(formData: FormData): Promise<ImportResult> {
  const user = await getCurrentUser()
  if (!user) {
    return { success: false, error: 'Unauthorized: Harap login terlebih dahulu' }
  }

  const file = formData.get('file') as File | null
  if (!file || !(file instanceof File) || file.size === 0) {
    return { success: false, error: 'File Excel (.xlsx) tidak ditemukan atau kosong' }
  }

  const periodMonthStr = (formData.get('periodMonth') as string) || '9'
  const periodYearStr = (formData.get('periodYear') as string) || '2026'
  const periodMonth = parseInt(periodMonthStr, 10) || 9
  const periodYear = parseInt(periodYearStr, 10) || 2026

  const importBudget = formData.get('importBudget') !== 'false'
  const importEndorsements = formData.get('importEndorsements') !== 'false'
  const importAds = formData.get('importAds') !== 'false'

  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true })

    const sheets = workbook.SheetNames
    let outletsUpserted = 0
    let budgetsUpserted = 0
    let endorsementsImported = 0
    let postsCreated = 0
    let adsImported = 0

    // Outlet Cache Map: name (lowercase) -> outletId
    const outletMap = new Map<string, bigint>()
    const existingOutlets = await prisma.outlet.findMany()
    for (const o of existingOutlets) {
      outletMap.set(o.name.toLowerCase().trim(), o.id)
    }

    // Helper to get or create outlet
    const getOrCreateOutlet = async (name: string, type: 'INTERNAL' | 'MITRA' = 'INTERNAL'): Promise<bigint> => {
      const key = name.toLowerCase().trim()
      if (outletMap.has(key)) {
        return outletMap.get(key)!
      }
      const created = await prisma.outlet.upsert({
        where: { name: name.trim() },
        update: { type },
        create: { name: name.trim(), type },
      })
      outletMap.set(key, created.id)
      outletsUpserted++
      return created.id
    }

    // 1. IMPORT BUDGET SHEET
    if (importBudget && workbook.Sheets['Budget']) {
      const ws = workbook.Sheets['Budget']
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })

      // Detect "Mitra" and "Internal" / "Non-Mitra" sections
      let currentSection: 'MITRA' | 'INTERNAL' = 'MITRA'

      for (let r = 0; r < rows.length; r++) {
        const row = rows[r]
        if (!row || row.length < 2) continue

        const colB = String(row[1] || '').trim()
        const colBLower = colB.toLowerCase()

        if (colBLower.includes('mitra') && !colBLower.includes('non')) {
          currentSection = 'MITRA'
          continue
        } else if (colBLower.includes('non-mitra') || colBLower.includes('internal') || colBLower.includes('non mitra')) {
          currentSection = 'INTERNAL'
          continue
        }

        if (colBLower === 'total' || colBLower === 'outlet' || colBLower === 'nama outlet') {
          continue
        }

        const budgetVal = parseNumber(row[3])
        const kolVal = parseNumber(row[4])

        if (colB && (budgetVal > 0 || kolVal > 0)) {
          const outletId = await getOrCreateOutlet(colB, currentSection)

          await prisma.outletBudget.upsert({
            where: {
              idx_outlet_budget_period: {
                outletId,
                periodMonth,
                periodYear,
              },
            },
            update: {
              targetBudget: budgetVal,
              targetKolCount: Math.round(kolVal),
            },
            create: {
              outletId,
              periodMonth,
              periodYear,
              targetBudget: budgetVal,
              targetKolCount: Math.round(kolVal),
              notes: `Imported Excel Budget (${currentSection})`,
            },
          })
          budgetsUpserted++
        }
      }
    }

    // 2. PARSE PAYMENT & DATA HARIAN FOR ENRICHMENT
    const paymentMap = new Map<string, any>()
    const parseEnrichmentSheet = (sheetName: string) => {
      const ws = workbook.Sheets[sheetName]
      if (!ws) return

      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r]
        if (!row || row.length < 3) continue

        // Usually Kol Name is in Col C or D (index 2 or 3)
        let kolName = ''
        let menu = ''
        let hpp = 0
        let phone = ''
        let rek = ''
        let tglPymt: any = null
        let ket = ''
        let draftVal: any = null

        if (sheetName === 'Payment') {
          draftVal = row[2]
          kolName = String(row[3] || '').trim()
          menu = String(row[6] || '').trim()
          hpp = parseNumber(row[7])
          phone = String(row[9] || '').trim()
          rek = String(row[10] || '').trim()
          tglPymt = row[11]
          ket = String(row[12] || '').trim()
        } else if (sheetName === 'Data Harian') {
          kolName = String(row[2] || '').trim()
          menu = String(row[6] || '').trim()
          hpp = parseNumber(row[7])
          ket = String(row[10] || '').trim()
          tglPymt = row[11]
        }

        if (!kolName || kolName.toLowerCase() === 'nama' || kolName.toLowerCase() === 'total') continue

        const key = kolName.toLowerCase()
        const ketLower = ket.toLowerCase()
        const pymtLower = String(tglPymt || '').toLowerCase()

        let paymentStatus = 'UNPAID'
        if (ketLower.includes('barter') || pymtLower.includes('barter')) {
          paymentStatus = 'BARTER'
        } else if (ketLower.includes('done')) {
          paymentStatus = 'PAID'
        } else if (ketLower.includes('dp') || pymtLower.includes('dp')) {
          paymentStatus = 'DOWN_PAYMENT'
        }

        const draftStatus = draftVal === true || String(draftVal).toLowerCase() === 'true' ? 'APPROVED' : 'PENDING'
        const paymentDate = parseExcelDate(tglPymt, periodYear, periodMonth)

        paymentMap.set(key, {
          menuGiven: menu || undefined,
          hppMenu: hpp || undefined,
          phoneNumber: phone || undefined,
          bankAccount: rek || undefined,
          paymentStatus,
          paymentDate,
          paymentNotes: ket || undefined,
          draftStatus,
        })
      }
    }

    parseEnrichmentSheet('Payment')
    parseEnrichmentSheet('Data Harian')

    // 3. IMPORT ENDORSEMENT OPERATIONAL SHEETS
    if (importEndorsements) {
      const operationalSheetNames = sheets.filter((s) => {
        const lower = s.toLowerCase()
        return (
          lower.startsWith('minggu') ||
          lower.includes('week') ||
          lower.includes('pamulang') ||
          lower.includes('event')
        )
      })

      for (const sName of operationalSheetNames) {
        const ws = workbook.Sheets[sName]
        if (!ws) continue

        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r]
          if (!row || row.length < 3) continue

          const kolName = String(row[2] || '').trim()
          if (!kolName || kolName.toLowerCase() === 'nama' || kolName.toLowerCase() === 'total') continue

          const tglVal = row[1]
          const outletName = String(row[3] || 'Dramaga').trim()
          const linkTt = row[4] ? String(row[4]).trim() : null
          const linkIg = row[5] ? String(row[5]).trim() : null
          const rateCard = parseNumber(row[6])
          const phone = row[7] ? String(row[7]).trim() : null
          const rek = row[8] ? String(row[8]).trim() : null
          const postTt = row[9] ? String(row[9]).trim() : null
          const postIg = row[10] ? String(row[10]).trim() : null
          const postStatusVal = row[11]
          const visitStatusVal = row[12]

          const schedDate = parseExcelDate(tglVal, periodYear, periodMonth) || new Date()
          const isVisited =
            visitStatusVal === true || ['true', '1', 'done'].includes(String(visitStatusVal).toLowerCase().trim())
          const isPosted =
            postStatusVal === true || ['true', '1', 'done'].includes(String(postStatusVal).toLowerCase().trim())

          const pInfo = paymentMap.get(kolName.toLowerCase()) || {}

          const menuGiven = pInfo.menuGiven || (isVisited ? 'Ayam Jumbo + Sapi Sedang' : null)
          const hppMenu = pInfo.hppMenu !== undefined ? pInfo.hppMenu : isVisited ? 38000 : 0
          const draftStatus = pInfo.draftStatus || (isPosted ? 'APPROVED' : 'PENDING')
          let paymentStatus = pInfo.paymentStatus
          if (!paymentStatus) {
            paymentStatus = rateCard === 0 ? 'BARTER' : isPosted ? 'PAID' : 'UNPAID'
          }

          const outletId = await getOrCreateOutlet(outletName)

          // Find or create KOL
          let kol = await prisma.kol.findFirst({
            where: { name: { equals: kolName, mode: 'insensitive' } },
          })
          if (!kol) {
            kol = await prisma.kol.create({
              data: {
                name: kolName,
                phoneNumber: phone || pInfo.phoneNumber || null,
                bankAccount: rek || pInfo.bankAccount || null,
                tiktokUrl: linkTt,
                instagramUrl: linkIg,
              },
            })
          } else {
            await prisma.kol.update({
              where: { id: kol.id },
              data: {
                phoneNumber: phone || pInfo.phoneNumber || kol.phoneNumber,
                bankAccount: rek || pInfo.bankAccount || kol.bankAccount,
                tiktokUrl: linkTt || kol.tiktokUrl,
                instagramUrl: linkIg || kol.instagramUrl,
              },
            })
          }

          // Check if endorsement already exists for this KOL and date
          let endorsement = await prisma.endorsement.findFirst({
            where: {
              kolId: kol.id,
              scheduleDate: schedDate,
            },
          })

          if (!endorsement) {
            endorsement = await prisma.endorsement.create({
              data: {
                kolId: kol.id,
                outletId,
                scheduleDate: schedDate,
                rateCard,
                menuGiven,
                hppMenu,
                visitStatus: isVisited ? 'VISITED' : 'PENDING',
                postStatus: isPosted ? 'ON' : 'OFF',
                draftStatus,
                paymentStatus,
                paymentDate: pInfo.paymentDate || null,
                paymentNotes: pInfo.paymentNotes || null,
                bankAccountCustom: rek || pInfo.bankAccount || null,
                type: 'VISIT',
              },
            })
            endorsementsImported++
          } else {
            await prisma.endorsement.update({
              where: { id: endorsement.id },
              data: {
                outletId,
                rateCard: rateCard || endorsement.rateCard,
                menuGiven: menuGiven || endorsement.menuGiven,
                hppMenu: hppMenu || endorsement.hppMenu,
                visitStatus: isVisited ? 'VISITED' : endorsement.visitStatus,
                postStatus: isPosted ? 'ON' : endorsement.postStatus,
                draftStatus: draftStatus || endorsement.draftStatus,
                paymentStatus: paymentStatus || endorsement.paymentStatus,
                paymentDate: pInfo.paymentDate || endorsement.paymentDate,
                paymentNotes: pInfo.paymentNotes || endorsement.paymentNotes,
                bankAccountCustom: rek || endorsement.bankAccountCustom,
              },
            })
          }

          // Create Posts
          if (postTt && postTt.toLowerCase() !== 'none') {
            const urls = postTt.split(/\s+/)
            for (const u of urls) {
              if (u.includes('http') || u.includes('tiktok')) {
                const cleanUrl = u.replace('Link Tiktok: ', '').trim()
                const exists = await prisma.endorsementPost.findFirst({
                  where: { endorsementId: endorsement.id, postUrl: cleanUrl },
                })
                if (!exists) {
                  await prisma.endorsementPost.create({
                    data: {
                      endorsementId: endorsement.id,
                      platform: 'TIKTOK',
                      postUrl: cleanUrl,
                      status: 'POSTED',
                      postedAt: schedDate,
                    },
                  })
                  postsCreated++
                }
              }
            }
          }

          if (postIg && postIg.toLowerCase() !== 'none' && !postIg.toLowerCase().includes('done')) {
            const urls = postIg.split(/\s+/)
            for (const u of urls) {
              if (u.includes('http') || u.includes('instagram')) {
                const cleanUrl = u.trim()
                const exists = await prisma.endorsementPost.findFirst({
                  where: { endorsementId: endorsement.id, postUrl: cleanUrl },
                })
                if (!exists) {
                  await prisma.endorsementPost.create({
                    data: {
                      endorsementId: endorsement.id,
                      platform: 'IG_REEL',
                      postUrl: cleanUrl,
                      status: 'POSTED',
                      postedAt: schedDate,
                    },
                  })
                  postsCreated++
                }
              }
            }
          }
        }
      }

      // 4. IMPORT SS ONLINE SHEET (DELIVERY ENDORSEMENT)
      if (workbook.Sheets['SS Online']) {
        const ws = workbook.Sheets['SS Online']
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })

        for (let r = 1; r < rows.length; r++) {
          const row = rows[r]
          if (!row || row.length < 3) continue

          const kolName = String(row[1] || '').trim()
          if (!kolName || kolName.toLowerCase() === 'nama' || kolName.toLowerCase() === 'total') continue

          const linkTt = row[2] ? String(row[2]).trim() : null
          const linkIg = row[3] ? String(row[3]).trim() : null
          const rateCard = parseNumber(row[4])
          const phone = row[5] ? String(row[5]).trim() : null
          const rek = row[6] ? String(row[6]).trim() : null
          const shippingAddress = row[7] ? String(row[7]).trim() : null
          const recipientName = row[8] ? String(row[8]).trim() : null
          const produk = row[9] ? String(row[9]).trim() : null
          const hppProduk = parseNumber(row[10])
          const dikirimVal = row[11]
          const noResi = row[12] ? String(row[12]).trim() : null
          const ongkir = parseNumber(row[13])
          const tglPymt = row[14]
          const tglPost = row[15]
          const postIg = row[16] ? String(row[16]).trim() : null
          const postTt = row[17] ? String(row[17]).trim() : null

          const isShipped =
            dikirimVal === true || ['true', '1', 'done', 'dikirim', 'sudah'].includes(String(dikirimVal).toLowerCase().trim())
          const schedDate = parseExcelDate(tglPost, periodYear, periodMonth) || new Date()
          const paymentDate = parseExcelDate(tglPymt, periodYear, periodMonth)

          const outletId = await getOrCreateOutlet('SS Online Center', 'INTERNAL')

          let kol = await prisma.kol.findFirst({
            where: { name: { equals: kolName, mode: 'insensitive' } },
          })
          if (!kol) {
            kol = await prisma.kol.create({
              data: {
                name: kolName,
                phoneNumber: phone,
                bankAccount: rek,
                tiktokUrl: linkTt,
                instagramUrl: linkIg,
              },
            })
          }

          const endorsement = await prisma.endorsement.create({
            data: {
              kolId: kol.id,
              outletId,
              scheduleDate: schedDate,
              rateCard,
              menuGiven: produk,
              hppMenu: hppProduk,
              type: 'DELIVERY',
              shippingAddress,
              recipientName,
              courierResi: noResi,
              shippingCost: ongkir,
              isShipped,
              shippingDate: isShipped ? schedDate : null,
              visitStatus: isShipped ? 'VISITED' : 'PENDING',
              postStatus: postIg || postTt ? 'ON' : 'OFF',
              draftStatus: postIg || postTt ? 'APPROVED' : 'PENDING',
              paymentStatus: rateCard === 0 ? 'BARTER' : paymentDate ? 'PAID' : 'UNPAID',
              paymentDate,
              bankAccountCustom: rek,
            },
          })
          endorsementsImported++

          if (postTt && postTt.toLowerCase() !== 'none') {
            await prisma.endorsementPost.create({
              data: {
                endorsementId: endorsement.id,
                platform: 'TIKTOK',
                postUrl: postTt,
                status: 'POSTED',
                postedAt: schedDate,
              },
            })
            postsCreated++
          }

          if (postIg && postIg.toLowerCase() !== 'none') {
            await prisma.endorsementPost.create({
              data: {
                endorsementId: endorsement.id,
                platform: 'IG_REEL',
                postUrl: postIg,
                status: 'POSTED',
                postedAt: schedDate,
              },
            })
            postsCreated++
          }
        }
      }
    }

    // 5. IMPORT ADS SHEETS
    if (importAds) {
      // 5a. Ads Internal
      if (workbook.Sheets['Ads Internal']) {
        const ws = workbook.Sheets['Ads Internal']
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })

        for (let r = 2; r < rows.length; r++) {
          const row = rows[r]
          if (!row || row.length < 4) continue

          const link = row[2] ? String(row[2]).trim() : null
          const tgl = row[3]
          const harga = parseNumber(row[4])
          const rateAwal = parseNumber(row[5])
          const rateAkhir = parseNumber(row[6])
          const status = row[7] ? String(row[7]).trim().toUpperCase() : 'OFF'

          if (link || harga > 0) {
            const schedDate = parseExcelDate(tgl, periodYear, periodMonth) || new Date()
            const outletId = await getOrCreateOutlet('Dramaga', 'INTERNAL')

            await prisma.ad.create({
              data: {
                category: 'INTERNAL',
                platform: 'TIKTOK',
                accountName: 'OFC TIKTOK',
                outletId,
                adUrl: link,
                scheduleDate: schedDate,
                budget: 1000000,
                spent: harga,
                initialViews: Math.round(rateAwal),
                finalViews: Math.round(rateAkhir),
                status: status || 'OFF',
              },
            })
            adsImported++
          }
        }
      }

      // 5b. Ads Mitra
      if (workbook.Sheets['Ads Mitra']) {
        const ws = workbook.Sheets['Ads Mitra']
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })

        if (rows.length >= 2) {
          const row1 = rows[0] // Header with outlet names
          // Scan for outlet blocks in row 1
          for (let c = 0; c < row1.length; c++) {
            const outletHeader = row1[c] ? String(row1[c]).trim() : null
            if (outletHeader && outletHeader.toLowerCase() !== 'no' && outletHeader.toLowerCase() !== 'budget') {
              const outletId = await getOrCreateOutlet(outletHeader, 'MITRA')

              // The columns for this outlet are c to c + 7
              for (let r = 2; r < rows.length; r++) {
                const row = rows[r]
                if (!row) continue
                const budget = parseNumber(row[c])
                const link = row[c + 1] ? String(row[c + 1]).trim() : null
                const tgl = row[c + 2]
                const harga = parseNumber(row[c + 3])
                const rateAwal = parseNumber(row[c + 4])
                const rateAkhir = parseNumber(row[c + 5])
                const status = row[c + 6] ? String(row[c + 6]).trim().toUpperCase() : 'OFF'

                if (link || harga > 0 || (budget > 0 && r === 2)) {
                  const schedDate = parseExcelDate(tgl, periodYear, periodMonth) || new Date()
                  await prisma.ad.create({
                    data: {
                      category: 'MITRA',
                      platform: 'TIKTOK',
                      accountName: outletHeader,
                      outletId,
                      adUrl: link,
                      scheduleDate: schedDate,
                      budget: budget > 0 ? budget : 1000000,
                      spent: harga,
                      initialViews: Math.round(rateAwal),
                      finalViews: Math.round(rateAkhir),
                      status: status || 'OFF',
                    },
                  })
                  adsImported++
                }
              }
            }
          }
        }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/dashboard/endorsements')
    revalidatePath('/dashboard/budget')
    revalidatePath('/dashboard/ads')

    return {
      success: true,
      summary: {
        outletsUpserted,
        budgetsUpserted,
        endorsementsImported,
        postsCreated,
        adsImported,
        sheetsDetected: sheets,
        period: `${periodMonth}/${periodYear}`,
      },
    }
  } catch (err: any) {
    console.error('Failed to import Excel:', err)
    return {
      success: false,
      error: err?.message || 'Terjadi kesalahan saat memproses spreadsheet Excel',
    }
  }
}
