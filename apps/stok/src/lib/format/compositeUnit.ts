/**
 * Format saldo (running balance) sebagai "N {satuan} + M {satuan_kecil}".
 * Kalau satuanKecil/faktorTampilan tidak ada, fallback ke "{qty} {satuan}".
 *
 * Untuk nilai negatif (defisit stok), gunakan Math.trunc agar whole dan
 * remainder konsisten bertanda negatif — mis. -33.1 pcs → "-33 pcs - 0.3 kg"
 * (bukan "-34 pcs + 2.7 kg" dari Math.floor yang membingungkan secara visual).
 */
export function formatCompositeSaldo(
  qty: number,
  satuan: string,
  satuanKecil: string | null,
  faktorTampilan: number | null,
  multiline: boolean = false
): string {
  if (!satuanKecil || !faktorTampilan) {
    // Fallback tanpa tanda '+': saldo = total absolut, beda dari delta (pergerakan bertanda).
    return `${qty} ${satuan}`
  }

  // Gunakan Math.trunc (bukan Math.floor) agar whole selalu bertanda sama dengan qty.
  // Math.floor(-33.1) = -34 (berbeda arah), Math.trunc(-33.1) = -33 (sama arah).
  let whole = Math.trunc(qty)
  const remainderRaw = (qty - whole) * faktorTampilan
  let remainder = Math.round(remainderRaw * 100) / 100

  // Floating-point drift: mis. qty = 2.9999999999 → remainder bisa jadi persis faktorTampilan.
  // Carry ke whole, bukan negatif ke bawah.
  if (Math.abs(remainder) >= faktorTampilan) {
    whole += Math.sign(remainder)
    remainder = 0
  }

  const absRemainder = Math.abs(remainder)
  if (absRemainder === 0) {
    return `${whole} ${satuan}`
  }
  
  const separator = remainder < 0 ? '-' : '+'
  const joiner = multiline ? `\n${separator} ` : ` ${separator} `
  return `${whole} ${satuan}${joiner}${absRemainder} ${satuanKecil}`
}

export function formatTriUnitSaldo(
  qty: number,
  satuanBesar: string,
  satuanTengah?: string | null,
  faktorTengah?: number | null,
  satuanKecil?: string | null,
  faktorTampilan?: number | null,
  multiline: boolean = false
): string {
  const joiner = multiline ? '\n' : ' '

  if (!satuanKecil || !faktorTampilan) {
    if (satuanTengah && faktorTengah) {
      let whole = Math.trunc(qty)
      const remainderRaw = (qty - whole) * faktorTengah
      let remainder = Math.round(remainderRaw * 100) / 100
      
      if (Math.abs(remainder) >= faktorTengah) {
        whole += Math.sign(remainder)
        remainder = 0
      }
      
      const parts = []
      if (whole !== 0 || remainder === 0) parts.push(`${whole} ${satuanBesar}`)
      if (remainder !== 0) parts.push(`${Math.abs(remainder)} ${satuanTengah}`)
      return (qty < 0 ? "-" : "") + parts.join(joiner)
    }
    return `${qty} ${satuanBesar}`
  }

  if (satuanTengah && faktorTengah) {
    let sisaBesar = Math.abs(qty)
    let besar = Math.trunc(sisaBesar)
    
    const sisaTengahRaw = (sisaBesar - besar) * faktorTengah
    let tengah = Math.trunc(sisaTengahRaw)
    
    const faktorKecilPerTengah = faktorTampilan / faktorTengah
    const sisaKecilRaw = (sisaTengahRaw - tengah) * faktorKecilPerTengah
    let kecil = Math.round(sisaKecilRaw * 100) / 100

    if (Math.abs(kecil) >= faktorKecilPerTengah) {
      tengah += Math.sign(kecil)
      kecil = 0
    }
    if (Math.abs(tengah) >= faktorTengah) {
      besar += Math.sign(tengah)
      tengah = 0
    }

    const parts = []
    const sign = qty < 0 ? '-' : ''
    if (multiline) {
      if (besar !== 0 || (tengah === 0 && kecil === 0)) parts.push(`${sign}${besar} ${satuanBesar}`)
      if (tengah !== 0) parts.push(`${sign}${tengah} ${satuanTengah}`)
      if (kecil !== 0) parts.push(`${sign}${kecil} ${satuanKecil}`)
      return parts.join(joiner)
    } else {
      if (besar !== 0 || (tengah === 0 && kecil === 0)) parts.push(`${besar} ${satuanBesar}`)
      if (tengah !== 0) parts.push(`${tengah} ${satuanTengah}`)
      if (kecil !== 0) parts.push(`${kecil} ${satuanKecil}`)
      return (qty < 0 ? '-' : '') + parts.join(joiner)
    }
  }

  return formatCompositeSaldo(qty, satuanBesar, satuanKecil, faktorTampilan, multiline)
}

/**
 * Format qty pergerakan (delta) langsung dalam satuan kecil, karena angkanya
 * biasanya kecil (hasil BOM automation) dan lebih masuk akal drpd pecahan
 * satuan besar (mis. "-0.03 kompan" -> "-480 ml").
 */
export function formatCompositeDelta(
  qty: number,
  satuan: string,
  satuanKecil: string | null,
  faktorTampilan: number | null
): string {
  if (!satuanKecil || !faktorTampilan) {
    return `${qty > 0 ? '+' : ''}${qty} ${satuan}`
  }
  const converted = Math.round(qty * faktorTampilan * 100) / 100
  return `${converted > 0 ? '+' : ''}${converted} ${satuanKecil}`
}

/**
 * Gabung input 2-field opname (kontainer utuh + sisa dalam satuan kecil)
 * jadi satu qty_fisik desimal dalam satuan besar.
 *
 * Asumsi: faktorTampilan > 0 (dijamin `CHECK (faktor_tampilan > 0)` di DB).
 */
export function combineOpnameInput(
  containers: number,
  remainder: number,
  faktorTampilan: number
): number {
  return containers + remainder / faktorTampilan
}

export function getDistribusiFactor(b: { satuan: string; satuan_tengah?: string | null; faktor_tengah?: number | null; satuan_kecil?: string | null; faktor_tampilan?: number | null; satuan_distribusi?: string | null }): number {
  if (!b.satuan_distribusi || b.satuan_distribusi === b.satuan) return 1;
  const dist = b.satuan_distribusi.toLowerCase();
  if (dist === b.satuan_tengah?.toLowerCase() && b.faktor_tengah) return b.faktor_tengah;
  if (dist === b.satuan_kecil?.toLowerCase() && b.faktor_tampilan) return b.faktor_tampilan;
  
  // Implicit mapping: if dist is 'kg' and satuan_kecil is 'gram'
  if (dist === 'kg' && b.satuan_kecil?.toLowerCase() === 'gram' && b.faktor_tampilan) {
    return b.faktor_tampilan / 1000;
  }
  
  return 1;
}

export function convertToBaseUnit(qtyDistribusi: number, b: { satuan: string; satuan_tengah?: string | null; faktor_tengah?: number | null; satuan_kecil?: string | null; faktor_tampilan?: number | null; satuan_distribusi?: string | null }): number {
  const factor = getDistribusiFactor(b);
  return qtyDistribusi / factor;
}

export function convertToDistribusiUnit(qtyBase: number, b: { satuan: string; satuan_tengah?: string | null; faktor_tengah?: number | null; satuan_kecil?: string | null; faktor_tampilan?: number | null; satuan_distribusi?: string | null }): number {
  const factor = getDistribusiFactor(b);
  return qtyBase * factor;
}
