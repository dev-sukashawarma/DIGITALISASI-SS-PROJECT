export interface ValidationError {
  field: string
  message: string
}

export function validateCheckoutPayload(body: unknown): ValidationError[] {
  const errors: ValidationError[] = []
  const data = body as Record<string, unknown>

  if (!data || typeof data !== 'object') {
    errors.push({ field: 'body', message: 'Request body tidak valid' })
    return errors
  }

  if (data.customer_name !== undefined && data.customer_name !== '') {
    if (typeof data.customer_name !== 'string') {
      errors.push({ field: 'customer_name', message: 'Nama harus berupa teks' })
    } else if ((data.customer_name as string).length > 100) {
      errors.push({ field: 'customer_name', message: 'Nama maksimal 100 karakter' })
    }
  }

  if (data.notes !== undefined && data.notes !== '') {
    if (typeof data.notes !== 'string') {
      errors.push({ field: 'notes', message: 'Catatan harus berupa teks' })
    } else if ((data.notes as string).length > 500) {
      errors.push({ field: 'notes', message: 'Catatan maksimal 500 karakter' })
    }
  }

  if (!Array.isArray(data.items) || data.items.length === 0) {
    errors.push({ field: 'items', message: 'Keranjang tidak boleh kosong' })
    return errors
  }

  if (data.items.length > 20) {
    errors.push({ field: 'items', message: 'Maksimal 20 item per pesanan' })
  }

  ;(data.items as unknown[]).forEach((item, idx) => {
    const i = item as Record<string, unknown>
    if (typeof i.menu_item_id !== 'string' || i.menu_item_id.trim() === '') {
      errors.push({ field: `items[${idx}].menu_item_id`, message: 'ID menu tidak valid' })
    }
    const qty = Number(i.quantity)
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      errors.push({ field: `items[${idx}].quantity`, message: 'Jumlah harus antara 1-10' })
    }
  })

  return errors
}

export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount)
}
