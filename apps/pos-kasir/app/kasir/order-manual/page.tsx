'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Search, Plus, Minus, Trash2, ShoppingBag, Loader2,
  CheckCircle2, X, StickyNote, Banknote, QrCode, Sandwich, Store, Globe, Printer, CreditCard, Camera,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useMyOutlet } from '@/lib/useMyOutlet'
import { formatRupiah } from '@/lib/validations'
import { CHANNELS, getChannel } from '@/lib/channels'
import { usePromos } from '@/lib/usePromos'
import type { MenuItem, Category } from '@/types'
import { postToNative } from '@suka/design-system'
import { WalkInCartPanel, type Payment as WalkInPayment } from '@/components/kasir/WalkInCartPanel'
import { QrisPaymentModal } from '@/components/kasir/QrisPaymentModal'
import { printReceipt, type ReceiptData } from '@/lib/printReceipt'
import { useQueryClient } from '@tanstack/react-query'
import { db } from '@/lib/db'
import { fetchWithTimeout } from '@/lib/offline-utils'
import { createLocalOrder } from '@/lib/offline'
import { QRCodeSVG } from 'qrcode.react'

type Mode = 'walkin' | 'online'

interface Line {
  item: MenuItem
  quantity: number
  note: string
  cartItemId: string
  parentId?: string
}

type Payment = 'cash' | 'qris' | 'card'

export default function OrderManualPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const { outletId, outletName, loaded } = useMyOutlet()
  const { calculateItemPrice, calculateGlobalDiscount, globalPromo } = usePromos(outletId || undefined)

  // Mode halaman: "walkin" (pelanggan datang langsung ke kasir) atau
  // "online" (input pesanan dari channel eksternal). Default walk-in.
  const [mode, setMode] = useState<Mode>('walkin')

  const [items, setItems] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [unavailableIds, setUnavailableIds] = useState<Set<string>>(new Set())
  const [autoUnavailableIds, setAutoUnavailableIds] = useState<Set<string>>(new Set())
  const [forceAvailableIds, setForceAvailableIds] = useState<Set<string>>(new Set())
  const [upsellIds, setUpsellIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState<string>('all')

  // Keranjang lokal (terisolasi dari cart kiosk pelanggan)
  const [lines, setLines] = useState<Line[]>([])
  const [channel, setChannel] = useState<string | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [customerName, setCustomerName] = useState('')
  const [promoSubsidy, setPromoSubsidy] = useState<string>('')

  const [cartOpen, setCartOpen] = useState(false) // bottom sheet di mobile
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [showInfo, setShowInfo] = useState(true)
  const [success, setSuccess] = useState<{ orderNumber: number; method: Payment | null; change: number | null } | null>(null)
  const [onlineQrisOpen, setOnlineQrisOpen] = useState(false)
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | null>(null)

  // ── Modal State ─────────────────────────────────────────────────────────
  const [selectedMenu, setSelectedMenu] = useState<MenuItem | null>(null)
  const [selectedMenuQty, setSelectedMenuQty] = useState(1)
  const [selectedMenuNote, setSelectedMenuNote] = useState('')
  const [selectedExtras, setSelectedExtras] = useState<Record<string, number>>({})

  // ── State khusus jalur walk-in (kasir langsung) ───────────────────────────
  const [walkInSubmitting, setWalkInSubmitting] = useState(false)
  const [walkInError, setWalkInError] = useState<string | null>(null)
  const [walkInSuccess, setWalkInSuccess] = useState<
    { orderNumber: number; method: WalkInPayment; change: number | null; receipt: ReceiptData } | null
  >(null)
  // Bumped setelah transaksi sukses untuk me-remount panel (reset input tunai).
  const [walkInPanelKey, setWalkInPanelKey] = useState(0)

  useEffect(() => {
    supabase.from('global_settings').select('value').eq('key', 'enable_ai_receipt_parser').maybeSingle().then(({ data }) => {
      if (data?.value === 'true') setAiEnabled(true)
    })
  }, [supabase])

  const handleScanImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsScanning(true)
    
    try {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1]
        const menuText = items.map(i => `${i.id} - ${i.name} - Rp${i.price}`).join('\n')
        
        const res = await fetch('/api/parse-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, menuText })
        })
        const data = await res.json()
        if (data.error) throw new Error(data.error)
        
        const newLines = data.items.map((i: any) => {
          const matchedMenu = items.find(m => m.name.toLowerCase() === i.name.toLowerCase())
          return {
            item: matchedMenu || { id: 'unmatched', name: i.name, price: i.price || 0, is_available: true, category_id: '' },
            quantity: i.qty,
            note: i.matched ? '' : 'UNMATCHED: PILIH MANUAL',
            cartItemId: Math.random().toString(36).substring(2, 9)
          }
        })
        
        if (data.subsidies) {
          data.subsidies.forEach((s: any) => {
            newLines.push({
              item: { id: 'subsidy', name: s.name, price: s.amount, is_available: true, category_id: '' },
              quantity: 1,
              note: '',
              cartItemId: Math.random().toString(36).substring(2, 9)
            })
          })
        }
        
        setLines(prev => [...prev, ...newLines])
      }
    } catch (err) {
      alert('Gagal scan gambar')
    } finally {
      setIsScanning(false)
    }
  }

  const handleSwitchMode = (newMode: Mode) => {
    if (newMode !== mode) {
      setMode(newMode)
      setLines([])
      setChannel(null)
      setPayment(null)
      setCustomerName('')
      setPromoSubsidy('')
      setSearch('')
      setActiveCat('all')
      setSuccess(null)
      setWalkInSuccess(null)
      setError(null)
      setWalkInError(null)
      setWalkInPanelKey((k) => k + 1)
    }
  }

  // ── Ambil menu sesuai outlet ──────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return
    if (!outletId) { setLoading(false); return }

    async function syncFromSupabase() {
      try {
        const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'
        const [menuRes, catRes, unavRes] = await fetchWithTimeout(
          Promise.all([
            supabase.from('menu_items')
              .select('*, categories(id,name,sort_order)')
              .or(`outlet_id.is.null,outlet_id.eq.${PUSAT_OUTLET_ID},outlet_id.eq.${outletId}`)
              .order('sort_order'),
            supabase.from('categories').select('*').order('sort_order'),
            supabase.from('kiosk_settings').select('key, value, outlet_id')
              .or(`outlet_id.is.null,outlet_id.eq.${PUSAT_OUTLET_ID},outlet_id.eq.${outletId}`)
              .in('key', ['unavailable_menu_ids', 'auto_unavailable_menu_ids', 'force_available_menu_ids', 'upsell_ids']),
          ])
        )

        if (menuRes.error) throw menuRes.error
        if (catRes.error) throw catRes.error
        if (unavRes.error && unavRes.error.code !== 'PGRST116') throw unavRes.error

        const fetchedItems = menuRes.data ?? []
        const fetchedCategories = catRes.data ?? []
        const settings = unavRes.data
        const parseIds = (raw: string | null | undefined) => {
          try { return raw ? JSON.parse(raw) : [] } catch { return [] }
        }

        const getSetting = (key: string, preferGlobal: boolean = false) => {
          const rows = settings?.filter(s => s.key === key) || []
          const sortedRows = [...rows].sort((a, b) => {
            const getWeight = (id: string | null) => {
              if (preferGlobal) {
                if (id === null) return 3
                if (id === PUSAT_OUTLET_ID) return 2
                if (id === outletId) return 1
                return 0
              } else {
                if (id === outletId) return 3
                if (id === PUSAT_OUTLET_ID) return 2
                if (id === null) return 1
                return 0
              }
            }
            return getWeight(a.outlet_id) - getWeight(b.outlet_id)
          })
          const best = sortedRows.pop()
          return parseIds(best?.value)
        }

        let fetchedUnav = getSetting('unavailable_menu_ids', false)
        let fetchedAutoUnav = getSetting('auto_unavailable_menu_ids', false)
        let fetchedForceAvail = getSetting('force_available_menu_ids', false)
        let fetchedUpsell = getSetting('upsell_ids', false)

        setItems(fetchedItems)
        setCategories(fetchedCategories)
        setUnavailableIds(new Set(fetchedUnav))
        setAutoUnavailableIds(new Set(fetchedAutoUnav))
        setForceAvailableIds(new Set(fetchedForceAvail))
        setUpsellIds(fetchedUpsell)

        // Save to Dexie in background
        const now = Date.now()
        db.menu_items.bulkPut(fetchedItems.map((it: any) => ({
          ...it,
          synced_at: now
        }))).catch(console.error)
        db.categories.bulkPut(fetchedCategories.map((cat: any) => ({
          ...cat,
          synced_at: now
        }))).catch(console.error)
        db.kiosk_settings.put({
          id: 'unavailable_menu_ids',
          settings_data: fetchedUnav,
          synced_at: now
        }).catch(console.error)
        db.kiosk_settings.put({
          id: 'auto_unavailable_menu_ids',
          settings_data: fetchedAutoUnav,
          synced_at: now
        }).catch(console.error)
        db.kiosk_settings.put({
          id: 'force_available_menu_ids',
          settings_data: fetchedForceAvail,
          synced_at: now
        }).catch(console.error)
        db.kiosk_settings.put({
          id: 'upsell_ids',
          settings_data: fetchedUpsell,
          synced_at: now
        }).catch(console.error)
      } catch (err) {
        console.warn('Network error or fetch failed during background sync', err)
      } finally {
        setLoading(false)
      }
    }

    async function fetchMenu() {
      try {
        const cachedItems = await db.menu_items.toArray()
        if (cachedItems && cachedItems.length > 0) {
          const cachedCategories = await db.categories.toArray()
          const cachedUnav = await db.kiosk_settings.get('unavailable_menu_ids')
          const cachedAutoUnav = await db.kiosk_settings.get('auto_unavailable_menu_ids')
          const cachedForceAvail = await db.kiosk_settings.get('force_available_menu_ids')
          const cachedUpsell = await db.kiosk_settings.get('upsell_ids')

          setItems(cachedItems as any)
          setCategories(cachedCategories as any)
          setUnavailableIds(new Set(cachedUnav?.settings_data || []))
          setAutoUnavailableIds(new Set(cachedAutoUnav?.settings_data || []))
          setForceAvailableIds(new Set(cachedForceAvail?.settings_data || []))
          setUpsellIds(cachedUpsell?.settings_data || [])
          
          setLoading(false) // UI is ready immediately from cache
          
          // Trigger background sync without blocking UI
          syncFromSupabase()
        } else {
          // No cache available, must load from network
          setLoading(true)
          await syncFromSupabase()
        }
      } catch (err) {
        console.warn('Error reading from Dexie cache, falling back to network', err)
        setLoading(true)
        await syncFromSupabase()
      }
    }

    fetchMenu()

    const channel = supabase
      .channel(`kasir-order-manual-${outletId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, () => fetchMenu())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kiosk_settings' }, (payload: any) => {
        const PUSAT_OUTLET_ID = '550e8400-e29b-41d4-a716-446655440001'
        if (payload.new && (payload.new.outlet_id === outletId || payload.new.outlet_id === null || payload.new.outlet_id === PUSAT_OUTLET_ID)) {
          fetchMenu()
        } else if (payload.old && (payload.old.outlet_id === outletId || payload.old.outlet_id === null || payload.old.outlet_id === PUSAT_OUTLET_ID)) {
          fetchMenu()
        }
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, outletId, loaded])

  // ── Menu terfilter (tersedia + kategori + pencarian) ──────────────────────
  const visibleItems = useMemo(() => {
    const isOnlineChannel = ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(channel || '')

    return items.filter((it) => {
      if (activeCat !== 'all' && it.category_id !== activeCat) return false
      if (search.trim() && !it.name.toLowerCase().includes(search.trim().toLowerCase())) return false
      if (isOnlineChannel && it.is_available_online === false) return false
      return true
    }).map(it => {
      const isManualUnav = unavailableIds.has(it.id)
      const isAutoUnav = autoUnavailableIds.has(it.id)
      const isForceAvail = forceAvailableIds.has(it.id)
      const isDisabled = isManualUnav || (isAutoUnav && !isForceAvail) || it.is_available === false
      return { ...it, isDisabled }
    })
  }, [items, unavailableIds, autoUnavailableIds, forceAvailableIds, activeCat, search, channel])

  const upsellItems = useMemo(() => {
    return items.filter(it => upsellIds.includes(it.id) && it.is_available !== false)
  }, [items, upsellIds])

  // ── Helper keranjang ──────────────────────────────────────────────────────
  const addItem = useCallback((item: MenuItem, quantity: number = 1, note: string = '', parentId?: string) => {
    const newCartItemId = Math.random().toString(36).substring(2, 9)
    setLines((prev) => {
      const newLine = { cartItemId: newCartItemId, item, quantity, note, parentId }
      return [...prev, newLine]
    })
    return newCartItemId
  }, [])

  const setQty = useCallback((cartItemId: string, qty: number) => {
    setLines((prev) => {
      if (qty <= 0) {
        // If it's a parent, also remove children
        const toRemove = new Set([cartItemId])
        prev.forEach(l => { if (l.parentId === cartItemId) toRemove.add(l.cartItemId) })
        return prev.filter(l => !toRemove.has(l.cartItemId))
      }
      const newQty = Math.min(qty, 10);
      return prev.map(l => {
        if (l.cartItemId === cartItemId) return { ...l, quantity: newQty }
        if (l.parentId === cartItemId) return { ...l, quantity: Math.min(l.quantity, newQty) }
        return l
      })
    })
  }, [])

  const setNote = useCallback((cartItemId: string, note: string) => {
    setLines((prev) => prev.map(l => l.cartItemId === cartItemId ? { ...l, note } : l))
  }, [])

  const handleMenuClick = useCallback((it: MenuItem) => {
    const cat = categories.find(c => c.id === it.category_id)
    const catName = (cat?.name || '').toLowerCase()

    if (catName.includes('drink') || catName.includes('minuman') || catName.includes('topping')) {
      addItem(it, 1, '')
      return
    }

    setSelectedMenu(it)
    setSelectedMenuQty(1)
    setSelectedMenuNote('')
    setSelectedExtras({})
  }, [categories, addItem])

  const lineList = lines
  const totalItems = lineList.reduce((s, l) => s + l.quantity, 0)
  
  const baseSubtotal = lineList.reduce((s, l) => s + l.item.price * l.quantity, 0)
  const wrappedCalculateItemPrice = (price: number, id: string, channelPrices?: Record<string, number> | null) => calculateItemPrice(price, id, baseSubtotal, channel || (mode === 'online' ? 'gofood' : undefined), channelPrices)

  const subtotalAmount = lineList.reduce((s, l) => s + wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices) * l.quantity, 0)
  const globalDiscount = calculateGlobalDiscount(subtotalAmount)
  const parsedPromoSubsidy = ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(channel || '') ? (Number(promoSubsidy) || 0) : 0
  const totalPrice = Math.max(0, subtotalAmount - globalDiscount - parsedPromoSubsidy)

  const isGlobalPromoActive = globalPromo && globalPromo.is_active && (!globalPromo.end_date || new Date(globalPromo.end_date).getTime() > Date.now());
  const needsMoreForPromo = isGlobalPromoActive && globalPromo.min_purchase && subtotalAmount > 0 && subtotalAmount < globalPromo.min_purchase;
  const missingAmount = needsMoreForPromo ? (globalPromo.min_purchase || 0) - subtotalAmount : 0;

  const canSubmit = lineList.length > 0 && !!channel && !!payment && !!customerName.trim() && !submitting

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(amountReceived: number | null, proofUrl?: string | null) {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)

    if (['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(channel || '') && promoSubsidy === '') {
      setError('Promo Apps wajib diisi untuk Food Apps (bisa isi 0)')
      setSubmitting(false)
      return
    }

    const payload = {
      channel,
      payment_method: payment,
      customer_name: customerName,
      amount_received: payment === 'cash' ? amountReceived : undefined,
      payment_proof_url: proofUrl,
      promo_subsidy: ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(channel || '') ? Number(promoSubsidy) : 0,
      items: lineList.map((l) => ({
        menu_item_id: l.item.id,
        quantity: l.quantity,
        note: l.note,
        parent_id: l.parentId,
        cartItemId: l.cartItemId
      })),
    }

    try {
      const res = await fetch('/api/orders/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status >= 500) {
          throw new Error('Server error, fallback to offline')
        }
        postToNative({ type: 'haptic', style: 'error' })
        setError(data.error ?? 'Gagal membuat pesanan')
        setSubmitting(false)
        return
      }
      postToNative({ type: 'haptic', style: 'success' })

      const receipt: ReceiptData = {
        outletName: outletName || 'SUKA SHAWARMA',
        orderNumber: data.order_number,
        dateISO: new Date().toISOString(),
        customerName: customerName.trim() || null,
        items: lineList.map((l) => {
          const unit = wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices)
          return {
            name: l.item.name,
            note: l.note?.trim() || undefined,
            quantity: l.quantity,
            unit_price: unit,
            subtotal: unit * l.quantity,
          }
        }),
        subtotal: subtotalAmount,
        discount: globalDiscount,
        total: totalPrice,
        paymentMethod: payment as 'cash' | 'qris',
        amountReceived: payment === 'cash' ? amountReceived : null,
        changeAmount: data.change_amount ?? null,
        receiptType: 'kitchen'
      }

      await printReceipt(receipt)

      setSuccess({
        orderNumber: data.order_number,
        method: payment,
        change: data.change_amount ?? null
      })
      // invalidate cache
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      // reset untuk order berikutnya
      setLines([])
      setChannel(null)
      setPayment(null)
      setCustomerName('')
      setPromoSubsidy('')
      setCartOpen(false)
    } catch (err) {
      console.warn('Network error during handleSubmit, simpan sebagai order offline (IndexedDB):', err)
      const { orderNumber } = await createLocalOrder({
        outletId: outletId as string,
        items: lineList.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          note: l.note,
          quantity: l.quantity,
          unit_price: wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices),
          subtotal: wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices) * l.quantity,
        })),
        payment_method: payment as string,
        customer_name: customerName.trim() || null,
        total_amount: totalPrice,
        discount_amount: globalDiscount > 0 ? globalDiscount : null,
        source: 'manual',
        channel,
        promo_subsidy: ['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(channel || '') ? Number(promoSubsidy) : 0,
        payment_proof_url: (typeof proofUrl === 'string' ? proofUrl : undefined) as string | undefined,
        apiUrl: '/api/orders/manual',
        apiPayload: payload,
      })

      postToNative({ type: 'haptic', style: 'success' })

      const receipt: ReceiptData = {
        outletName: outletName || 'SUKA SHAWARMA',
        orderNumber: orderNumber,
        dateISO: new Date().toISOString(),
        customerName: customerName.trim() || null,
        items: lineList.map((l) => {
          const unit = wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices)
          return {
            name: l.item.name,
            note: l.note?.trim() || undefined,
            quantity: l.quantity,
            unit_price: unit,
            subtotal: unit * l.quantity,
            isChild: !!l.parentId
          }
        }),
        subtotal: subtotalAmount,
        discount: globalDiscount,
        total: totalPrice,
        paymentMethod: payment as 'cash' | 'qris',
        amountReceived: payment === 'cash' ? amountReceived : null,
        changeAmount: payment === 'cash' ? (amountReceived !== null ? amountReceived - totalPrice : 0) : null,
        receiptType: 'kitchen'
      }

      await printReceipt(receipt)

      setSuccess({
        orderNumber,
        method: payment,
        change: payment === 'cash' ? (amountReceived !== null ? amountReceived - totalPrice : 0) : null
      })
      setLines([])
      setChannel(null)
      setPayment(null)
      setCustomerName('')
      setPromoSubsidy('')
      setCartOpen(false)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Submit walk-in (kasir langsung) ───────────────────────────────────────
  async function handleWalkInPay(method: WalkInPayment, amountReceived: number | null, proofFile?: File | null | string) {
    if (lineList.length === 0 || walkInSubmitting) return
    setWalkInSubmitting(true)
    setWalkInError(null)

    // Snapshot rincian untuk struk SEBELUM keranjang direset
    const receiptItems = lineList.map((l) => {
      const unit = wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices)
      return {
        name: l.item.name,
        note: l.note?.trim() || undefined,
        quantity: l.quantity,
        unit_price: unit,
        subtotal: unit * l.quantity,
        isChild: !!l.parentId
      }
    })
    const snapCustomer = customerName.trim() || null
    const snapSubtotal = subtotalAmount
    const snapDiscount = globalDiscount

    const payload = {
      payment_method: method,
      customer_name: customerName,
      amount_received: method === 'cash' ? amountReceived : undefined,
      payment_proof_url: typeof proofFile === 'string' ? proofFile : null,
      items: lineList.map((l) => ({
        menu_item_id: l.item.id,
        quantity: l.quantity,
        note: l.note,
        parent_id: l.parentId,
        cartItemId: l.cartItemId
      })),
    }

    try {
      const res = await fetch('/api/orders/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (res.status >= 500) {
          throw new Error('Server error, fallback to offline')
        }
        postToNative({ type: 'haptic', style: 'error' })
        setWalkInError(data.error ?? 'Gagal membuat pesanan')
        setWalkInSubmitting(false)
        return
      }
      
      // Upload QRIS proof if it's a file
      if (proofFile instanceof File && data.order_id) {
        try {
          const ext = proofFile.name.split('.').pop() || 'jpg';
          const d = new Date();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          const dateStr = `${y}-${m}-${day}`;
          
          const cleanOutlet = (outletName || 'OUTLET').replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
          const fileName = `${cleanOutlet}_${data.order_number}_${dateStr}.${ext}`;
          
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('payment_proofs')
            .upload(fileName, proofFile, { upsert: true });
            
          if (!uploadError && uploadData) {
            const { data: publicUrlData } = supabase.storage.from('payment_proofs').getPublicUrl(uploadData.path);
            await supabase.from('orders').update({ payment_proof_url: publicUrlData.publicUrl }).eq('id', data.order_id);
          } else {
            console.error('Failed to upload proof:', uploadError);
          }
        } catch (err) {
          console.error('Error uploading proof:', err);
        }
      }

      postToNative({ type: 'haptic', style: 'success' })

      const receipt: ReceiptData = {
        outletName: outletName || 'SUKA SHAWARMA',
        orderNumber: data.order_number,
        dateISO: new Date().toISOString(),
        customerName: snapCustomer,
        items: receiptItems,
        subtotal: snapSubtotal,
        discount: snapDiscount,
        total: data.total_amount,
        paymentMethod: method,
        amountReceived: data.amount_received ?? null,
        changeAmount: data.change_amount ?? null,
        receiptType: 'kitchen'
      }

      // Cetak struk otomatis (hanya dapur)
      await printReceipt(receipt)

      setWalkInSuccess({
        orderNumber: data.order_number,
        method,
        change: data.change_amount ?? null,
        receipt,
      })

      // invalidate cache
      queryClient.invalidateQueries({ queryKey: ['orders'] })

      // Reset keranjang untuk transaksi berikutnya
      setLines([])
      setCustomerName('')
      setCartOpen(false)
      setWalkInPanelKey((k) => k + 1)
    } catch (err) {
      console.warn('Network error during handleWalkInPay, simpan sebagai order offline (IndexedDB):', err)
      const totalAmount = snapSubtotal - snapDiscount
      const { orderNumber: offlineOrderNumber } = await createLocalOrder({
        outletId: outletId as string,
        items: lineList.map((l) => ({
          menu_item_id: l.item.id,
          name: l.item.name,
          note: l.note,
          quantity: l.quantity,
          unit_price: wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices),
          subtotal: wrappedCalculateItemPrice(l.item.price, l.item.id, l.item.channel_prices) * l.quantity,
          parent_id: l.parentId,
          cartItemId: l.cartItemId
        })),
        payment_method: method,
        customer_name: snapCustomer,
        total_amount: totalAmount,
        discount_amount: snapDiscount > 0 ? snapDiscount : null,
        source: 'pos',
        channel: null,
        payment_proof_url: (typeof proofFile === 'string' ? proofFile : undefined) as string | undefined,
        apiUrl: '/api/orders/walk-in',
        apiPayload: payload,
      })
      const changeAmount = method === 'cash' && amountReceived !== null ? amountReceived - totalAmount : null

      postToNative({ type: 'haptic', style: 'success' })

      const receipt: ReceiptData = {
        outletName: outletName || 'SUKA SHAWARMA',
        orderNumber: offlineOrderNumber,
        dateISO: new Date().toISOString(),
        customerName: snapCustomer,
        items: receiptItems,
        subtotal: snapSubtotal,
        discount: snapDiscount,
        total: totalAmount,
        paymentMethod: method,
        amountReceived: amountReceived ?? null,
        changeAmount: changeAmount ?? null,
        receiptType: 'kitchen'
      }

      // Cetak struk otomatis (hanya dapur)
      await printReceipt(receipt)

      setWalkInSuccess({
        orderNumber: offlineOrderNumber,
        method,
        change: changeAmount ?? null,
        receipt,
      })

      // Reset keranjang untuk transaksi berikutnya
      setLines([])
      setCustomerName('')
      setCartOpen(false)
      setWalkInPanelKey((k) => k + 1)
    } finally {
      setWalkInSubmitting(false)
    }
  }

  // ── Render: state khusus ──────────────────────────────────────────────────
  if (loaded && !outletId) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500 font-medium">Akun Anda belum terhubung ke cabang manapun.</p>
        <Link href="/kasir" className="text-amber-600 font-bold mt-3 inline-block">← Kembali</Link>
      </div>
    )
  }

  return (
    <div className="pb-28 lg:pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <Link href="/kasir" className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">
            {mode === 'walkin' ? 'Order Manual — Pesanan Baru' : 'Input Food Apps'}
          </h1>
          <p className="text-sm text-gray-500 leading-tight">
            {mode === 'walkin' ? 'Catat pesanan pelanggan secara manual' : 'Input pesanan dari aplikasi makanan'}
          </p>
        </div>
      </div>

      {/* Tab switch: Order Manual / Food Apps */}
      <div className="flex flex-col gap-3 mb-5">
        <div className="inline-flex bg-gray-100 rounded-xl p-1 self-start">
          <button
            onClick={() => handleSwitchMode('walkin')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'walkin' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Store className="w-4 h-4" /> Order Manual
          </button>
          <button
            onClick={() => handleSwitchMode('online')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${mode === 'online' ? 'bg-white text-amber-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Globe className="w-4 h-4" /> Food Apps
          </button>
        </div>
        
        {showInfo && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex items-start gap-3 relative animate-[popIn_.2s_ease-out]">
            <span className="shrink-0 bg-blue-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold mt-0.5">i</span>
            <div className="text-sm text-blue-800 pr-6">
              <b>Order Manual</b> digunakan untuk pelanggan yang datang langsung atau memesan manual tanpa perantara aplikasi. <br/>
              <b>Food Apps</b> digunakan untuk mencatat pesanan yang masuk dari aplikasi pihak ketiga seperti GrabFood, GoFood, dll.
            </div>
            <button 
              onClick={() => setShowInfo(false)}
              className="absolute top-2 right-2 p-1.5 text-blue-400 hover:text-blue-600 hover:bg-blue-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] lg:grid-cols-[1fr_320px] xl:grid-cols-[1fr_360px] gap-4 md:gap-5 xl:gap-6 items-start min-w-0">
        {/* ══ KIRI: pilih channel + menu ══ */}
        <div className="space-y-4 xl:space-y-5 min-w-0">
          {/* Channel selector (hanya mode online) */}
          {mode === 'online' && (
          <div className="bg-white rounded-xl xl:rounded-2xl border border-gray-200 p-3.5 xl:p-4 shadow-sm relative">
            {aiEnabled && (
              <label className="absolute right-3.5 top-3.5 flex items-center gap-1.5 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer hover:bg-blue-100 transition-colors border border-blue-200 shadow-sm">
                {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                {isScanning ? 'Membaca...' : 'Scan Struk AI'}
                <input type="file" accept="image/*" className="hidden" onChange={handleScanImage} disabled={isScanning} />
              </label>
            )}
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2.5">1. Pilih Channel</p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-2.5">
              {CHANNELS.map((c) => {
                const selected = channel === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => {
                      setChannel(c.id)
                      setPromoSubsidy('')
                    }}
                    className={`relative flex items-center gap-2 px-2.5 py-2 xl:py-2.5 rounded-lg xl:rounded-xl border font-bold text-xs xl:text-sm transition-all duration-200 active:scale-95 hover:shadow-sm ${
                      selected ? 'shadow-md ring-2 ring-offset-1' : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                    style={selected ? { backgroundColor: c.bg, color: c.fg, borderColor: c.bg } : undefined}
                  >
                    <span
                      className="inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-extrabold flex-shrink-0"
                      style={selected ? { backgroundColor: 'rgba(255,255,255,0.3)', color: c.fg } : { backgroundColor: c.bg, color: c.fg }}
                    >
                      {c.logoPath ? (
                        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                          <path d={c.logoPath} />
                        </svg>
                      ) : (
                        c.mark
                      )}
                    </span>
                    <span className="truncate">{c.label}</span>
                    {selected && <CheckCircle2 className="w-4 h-4 ml-auto flex-shrink-0" />}
                  </button>
                )
              })}
            </div>
          </div>
          )}

          {/* Search + kategori */}
          <div className="bg-white rounded-xl xl:rounded-2xl border border-gray-200 p-3.5 xl:p-4 shadow-sm space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">{mode === 'online' ? '2. Pilih Menu' : '1. Pilih Menu'}</p>
            <div className="flex flex-col gap-3 min-w-0">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari menu..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg bg-gray-50 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white transition-all text-sm"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-hide -mx-3.5 px-3.5 xl:mx-0 xl:px-0">
                <button
                  onClick={() => setActiveCat('all')}
                  className={`px-3.5 py-1.5 rounded-lg text-xs xl:text-sm font-bold whitespace-nowrap transition-all ${activeCat === 'all' ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  Semua
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveCat(c.id)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs xl:text-sm font-bold whitespace-nowrap transition-all ${activeCat === c.id ? 'bg-gray-900 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid menu */}
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : visibleItems.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Sandwich className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p className="font-medium">Tidak ada menu yang cocok</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
              {visibleItems.map((it) => {
                const qty = lineList.filter(l => l.item.id === it.id).reduce((sum, l) => sum + l.quantity, 0)
                const disabled = it.isDisabled
                return (
                  <div
                    key={it.id}
                    onClick={() => !disabled && handleMenuClick(it)}
                    className={`group bg-white rounded-xl border overflow-hidden transition-all duration-200 ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:scale-[0.98]'} ${qty > 0 && !disabled ? 'border-amber-400 shadow-sm ring-1 ring-amber-400' : 'border-gray-200 hover:border-amber-300'}`}
                  >
                    <div className="h-24 bg-gray-50 relative overflow-hidden">
                      {it.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={it.image_url} alt={it.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <Sandwich className="w-8 h-8" />
                        </div>
                      )}
                      {qty > 0 && !disabled && (
                        <span className="absolute top-2 right-2 bg-amber-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shadow-md ring-2 ring-white">
                          {qty}
                        </span>
                      )}
                      {disabled && (
                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                          <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-1 rounded-full border border-red-400 shadow-sm">HABIS</span>
                        </div>
                      )}
                      {!disabled && <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors duration-200" />}
                    </div>
                    <div className="p-2.5 flex flex-col justify-between">
                      <p className="font-bold text-gray-800 text-xs leading-snug line-clamp-2 min-h-[2rem]">{it.name}</p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex flex-col">
                          <span className="font-bold text-amber-600 text-xs xl:text-sm">{formatRupiah(wrappedCalculateItemPrice(it.price, it.id, it.channel_prices))}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ══ KANAN: keranjang (desktop sticky) ══ */}
        <div className="hidden md:block sticky top-6 max-h-[calc(100dvh-3rem)] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-200 pr-2 pb-20">
          {mode === 'walkin' ? (
            <WalkInCartPanel
              key={walkInPanelKey}
              lineList={lineList}
              totalItems={totalItems}
              subtotal={subtotalAmount}
              totalPrice={totalPrice}
              globalDiscount={globalDiscount}
              globalPromo={globalPromo}
              needsMoreForPromo={!!needsMoreForPromo}
              missingAmount={missingAmount}
              customerName={customerName}
              setCustomerName={setCustomerName}
              setQty={setQty}
              setNote={setNote}
              calculateItemPrice={wrappedCalculateItemPrice}
              submitting={walkInSubmitting}
              error={walkInError}
              onPay={handleWalkInPay}
            />
          ) : (
            <CartPanel
              lineList={lineList}
              totalItems={totalItems}
              totalPrice={totalPrice}
              channel={channel}
              payment={payment}
              setPayment={setPayment}
              customerName={customerName}
              setCustomerName={setCustomerName}
              promoSubsidy={promoSubsidy}
              setPromoSubsidy={setPromoSubsidy}
              setQty={setQty}
              setNote={setNote}
              canSubmit={canSubmit}
              submitting={submitting}
              error={error}
              onSubmit={handleSubmit}
              calculateItemPrice={wrappedCalculateItemPrice}
              globalDiscount={globalDiscount}
              globalPromo={globalPromo}
              needsMoreForPromo={!!needsMoreForPromo}
              missingAmount={missingAmount}
              onlineQrisOpen={onlineQrisOpen}
              setOnlineQrisOpen={setOnlineQrisOpen}
            />
          )}
        </div>
      </div>

      {/* ══ Mobile: bottom bar + sheet ══ */}
      {totalItems > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="md:hidden fixed bottom-4 left-4 right-4 z-40 bg-amber-500 text-white rounded-2xl shadow-xl shadow-amber-300/40 px-5 py-4 flex items-center justify-between font-bold active:scale-[0.98] transition-transform"
        >
          <span className="flex items-center gap-2">
            <span className="bg-white/25 rounded-lg px-2 py-0.5 text-sm">{totalItems}</span>
            Lihat Keranjang
          </span>
          <span>{formatRupiah(totalPrice)}</span>
        </button>
      )}

      {cartOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCartOpen(false)} />
          <div className="relative bg-gray-50 rounded-t-3xl max-h-[88vh] overflow-y-auto p-4 animate-[slideUp_.2s_ease-out] scrollbar-thin scrollbar-thumb-gray-200 pb-20">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-gray-900 text-lg">Keranjang</h2>
              <button onClick={() => setCartOpen(false)} className="w-9 h-9 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-gray-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            {mode === 'walkin' ? (
              <WalkInCartPanel
                key={walkInPanelKey}
                lineList={lineList}
                totalItems={totalItems}
                subtotal={subtotalAmount}
                totalPrice={totalPrice}
                globalDiscount={globalDiscount}
                globalPromo={globalPromo}
                needsMoreForPromo={!!needsMoreForPromo}
                missingAmount={missingAmount}
                customerName={customerName}
                setCustomerName={setCustomerName}
                setQty={setQty}
                setNote={setNote}
                calculateItemPrice={wrappedCalculateItemPrice}
                submitting={walkInSubmitting}
                error={walkInError}
                onPay={handleWalkInPay}
                embedded
              />
            ) : (
              <CartPanel
                lineList={lineList}
                totalItems={totalItems}
                totalPrice={totalPrice}
                channel={channel}
                payment={payment}
                setPayment={setPayment}
                customerName={customerName}
                setCustomerName={setCustomerName}
                promoSubsidy={promoSubsidy}
                setPromoSubsidy={setPromoSubsidy}
                setQty={setQty}
                setNote={setNote}
                canSubmit={canSubmit}
                submitting={submitting}
                error={error}
                onSubmit={handleSubmit}
                calculateItemPrice={wrappedCalculateItemPrice}
                globalDiscount={globalDiscount}
                globalPromo={globalPromo}
                needsMoreForPromo={!!needsMoreForPromo}
                missingAmount={missingAmount}
                embedded
                onlineQrisOpen={onlineQrisOpen}
                setOnlineQrisOpen={setOnlineQrisOpen}
              />
            )}
          </div>
        </div>
      )}

      {/* ══ Kasir Menu Modal (with Extras) ══ */}
      {selectedMenu && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-[popIn_0.2s_ease-out]">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h2 className="font-bold text-lg text-gray-800 line-clamp-1">{selectedMenu.name}</h2>
              <button onClick={() => setSelectedMenu(null)} className="p-2 bg-white hover:bg-gray-100 rounded-xl transition-colors shadow-sm border border-gray-200">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="overflow-y-auto p-5 space-y-6 flex-1 scrollbar-thin scrollbar-thumb-gray-200">
              {/* Catatan */}
              <div>
                <label className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-amber-500" /> Catatan Khusus
                </label>
                <textarea
                  value={selectedMenuNote}
                  onChange={(e) => setSelectedMenuNote(e.target.value)}
                  placeholder="Contoh: Pedas, tanpa bawang..."
                  className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors text-sm resize-none h-20"
                />
              </div>

              {/* Extras */}
              {upsellItems.length > 0 && (
                <div>
                  <label className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-amber-500" /> Menu Ekstra
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {upsellItems.map((ex) => {
                      const qty = selectedExtras[ex.id] || 0
                      return (
                        <div 
                          key={ex.id} 
                          onClick={() => {
                            setSelectedExtras(prev => {
                              const current = prev[ex.id] || 0
                              return { ...prev, [ex.id]: current > 0 ? 0 : 1 }
                            })
                          }}
                          className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${qty > 0 ? 'border-amber-400 bg-amber-50/30' : 'border-gray-200 bg-white hover:border-amber-200'}`}
                        >
                          <div className="flex items-center gap-3 flex-1 min-w-0 pr-2">
                            {ex.image_url ? (
                              <img src={ex.image_url} alt={ex.name} className="w-12 h-12 rounded-lg object-cover shadow-sm flex-shrink-0" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0 border border-gray-200/60">
                                <span className="text-gray-400 text-[10px] font-bold">No Image</span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-sm text-gray-800 line-clamp-1">{ex.name}</p>
                              <p className="text-amber-600 font-bold text-xs mt-0.5">+{formatRupiah(wrappedCalculateItemPrice(ex.price, ex.id, ex.channel_prices))}</p>
                            </div>
                          </div>
                          {qty > 0 ? (
                            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shadow-sm pointer-events-none">
                              <CheckCircle2 className="w-5 h-5" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center text-gray-600 transition-colors pointer-events-none">
                              <Plus className="w-4 h-4" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center justify-between pt-2">
                <span className="font-bold text-gray-700">Jumlah Pesanan</span>
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1.5 border border-gray-200">
                  <button onClick={() => setSelectedMenuQty(Math.max(1, selectedMenuQty - 1))} className="w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center text-gray-600 hover:bg-gray-50 active:scale-95 transition-all">
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="font-bold text-lg w-8 text-center">{selectedMenuQty}</span>
                  <button onClick={() => setSelectedMenuQty(selectedMenuQty + 1)} className="w-10 h-10 rounded-lg bg-amber-500 text-white shadow-sm flex items-center justify-center hover:bg-amber-600 active:scale-95 transition-all">
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-white">
              <button
                onClick={() => {
                  const parentId = addItem(selectedMenu, selectedMenuQty, selectedMenuNote)
                  Object.entries(selectedExtras).forEach(([extraId, extraQty]) => {
                    if (extraQty > 0) {
                      const extraItem = items.find(i => i.id === extraId)
                      if (extraItem) {
                        addItem(extraItem, extraQty * selectedMenuQty, '', parentId)
                      }
                    }
                  })
                  setSelectedMenu(null)
                }}
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-all active:scale-[0.98] shadow-lg shadow-amber-500/20"
              >
                Tambah ke Keranjang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ Success overlay ══ */}
      {success !== null && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-[popIn_.2s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Pesanan Dibuat!</h2>
            <p className="text-gray-500 mt-1">Order masuk ke papan <b>Sedang Diproses</b>.</p>
            <div className="bg-amber-50 border border-amber-100 rounded-2xl py-4 my-4">
              <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider">Nomor Antrian</p>
              <p className="text-4xl font-bold text-amber-600 leading-tight mt-1">#{success.orderNumber}</p>
            </div>
            {success.method === 'cash' && success.change !== null && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl py-3 mb-4 flex items-center justify-between px-5">
                <span className="text-sm font-bold text-emerald-700">Kembalian</span>
                <span className="text-2xl font-black text-emerald-700">{formatRupiah(success.change)}</span>
              </div>
            )}
            <div className="flex gap-2.5">
              <button onClick={() => setSuccess(null)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-colors active:scale-95">
                Buat Order Lagi
              </button>
              <Link href="/kasir" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center">
                Ke Papan Order
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ══ Success overlay walk-in (kasir langsung) ══ */}
      {walkInSuccess !== null && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl animate-[popIn_.2s_ease-out]">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-9 h-9 text-emerald-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Pembayaran Berhasil!</h2>
            <p className="text-gray-500 mt-1">Order masuk ke papan <b>Sedang Diproses</b>.</p>

            <div className="bg-amber-50 border border-amber-100 rounded-2xl py-4 my-4">
              <p className="text-xs font-bold text-amber-600/80 uppercase tracking-wider">Nomor Antrian</p>
              <p className="text-4xl font-bold text-amber-600 leading-tight mt-1">#{walkInSuccess.orderNumber}</p>
            </div>

            {walkInSuccess.method === 'cash' && walkInSuccess.change !== null && (
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl py-3 mb-4 flex items-center justify-between px-5">
                <span className="text-sm font-bold text-emerald-700">Kembalian</span>
                <span className="text-2xl font-black text-emerald-700">{formatRupiah(walkInSuccess.change)}</span>
              </div>
            )}

            <button
              onClick={() => printReceipt(walkInSuccess.receipt)}
              className="w-full mb-2.5 bg-white border-2 border-gray-200 hover:border-amber-300 text-gray-700 font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 active:scale-95"
            >
              <Printer className="w-5 h-5" /> Cetak Ulang Struk
            </button>

            <div className="flex gap-2.5">
              <button onClick={() => setWalkInSuccess(null)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-xl transition-colors active:scale-95">
                Transaksi Baru
              </button>
              <Link href="/kasir" className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center">
                Ke Papan Order
              </Link>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes popIn { from { transform: scale(.92); opacity: 0 } to { transform: scale(1); opacity: 1 } }
      `}</style>
    </div>
  )
}

// ── Panel keranjang (dipakai desktop & mobile sheet) ─────────────────────────
function CartPanel(props: {
  lineList: Line[]
  totalItems: number
  totalPrice: number
  channel: string | null
  payment: Payment | null
  setPayment: (p: Payment) => void
  customerName: string
  setCustomerName: (v: string) => void
  promoSubsidy: string
  setPromoSubsidy: (v: string) => void
  setQty: (id: string, qty: number) => void
  setNote: (id: string, note: string) => void
  canSubmit: boolean
  submitting: boolean
  error: string | null
  onSubmit: (amount: number | null, proofUrl?: string | null) => void
  calculateItemPrice: (price: number, id: string, channelPrices?: Record<string, number> | null) => number
  globalDiscount: number
  globalPromo: any
  needsMoreForPromo?: boolean
  missingAmount?: number
  embedded?: boolean
  onlineQrisOpen: boolean
  setOnlineQrisOpen: (v: boolean) => void
}) {
  const {
    lineList, totalItems, totalPrice, channel, payment, setPayment,
    customerName, setCustomerName, promoSubsidy, setPromoSubsidy, setQty, setNote, canSubmit, submitting, error, onSubmit,
    calculateItemPrice, globalDiscount, globalPromo, needsMoreForPromo, missingAmount, embedded,
    onlineQrisOpen, setOnlineQrisOpen
  } = props

  const ch = getChannel(channel)
  const [cashInput, setCashInput] = useState<string>('')
  
  const QUICK_CASH = [20000, 50000, 100000, 150000, 200000]
  const amountReceived = cashInput ? parseInt(cashInput.replace(/\D/g, ''), 10) || 0 : 0
  const change = amountReceived - totalPrice
  const cashEnough = amountReceived >= totalPrice && totalPrice > 0
  const canPayCash = canSubmit && cashEnough

  return (
    <div className={embedded ? '' : 'bg-white rounded-2xl border border-gray-200 overflow-hidden'}>
      <div className={`${embedded ? '' : 'p-4'} space-y-4`}>
        {!embedded && (
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-amber-500" />
            <h2 className="font-bold text-gray-900">Keranjang</h2>
            {totalItems > 0 && (
              <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2.5 py-1 rounded-full">{totalItems} item</span>
            )}
          </div>
        )}

{/* Items */}
        {lineList.length === 0 ? (
          <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
            <ShoppingBag className="w-10 h-10 mx-auto mb-3 text-gray-300" />
            <p className="text-sm font-medium">Belum ada menu dipilih</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[40dvh] lg:max-h-[38dvh] overflow-y-auto -mx-2 px-2 scrollbar-thin scrollbar-thumb-gray-200">
            {lineList.filter(l => !l.parentId).map((root) => {
              const children = lineList.filter(l => l.parentId === root.cartItemId)
              const discountedPrice = calculateItemPrice(root.item.price, root.item.id, root.item.channel_prices)
              return (
                <div key={root.cartItemId} className={`py-2 flex flex-col gap-2 relative ${root.item.id === 'unmatched' ? 'border-2 border-red-400 bg-red-50 p-2 rounded-lg' : ''}`}>
                  {/* Vertical Line for Cart */}
                  {children.length > 0 && (
                    <div className="absolute left-[20px] top-10 bottom-4 w-[2px] bg-gray-200 z-0" />
                  )}
                  
                  <div className="relative z-10 bg-white rounded-xl p-3 border border-gray-200 shadow-sm transition-all hover:border-amber-200">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm leading-snug">{root.item.name}</p>
                        <div className="flex items-center gap-1.5 mt-1">

                          <p className="text-amber-600 font-bold text-sm">{formatRupiah(discountedPrice * root.quantity)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 border border-gray-100 flex-shrink-0">
                        <button onClick={() => setQty(root.cartItemId, root.quantity - 1)} className="w-7 h-7 rounded-md bg-white shadow-sm text-gray-600 flex items-center justify-center hover:bg-gray-50 active:scale-95 transition-all">
                          {root.quantity === 1 ? <Trash2 className="w-3.5 h-3.5 text-red-500" /> : <Minus className="w-3.5 h-3.5" />}
                        </button>
                        <span className="font-bold text-sm w-5 text-center text-gray-800">{root.quantity}</span>
                        <button onClick={() => setQty(root.cartItemId, root.quantity + 1)} className="w-7 h-7 rounded-md bg-amber-500 text-white flex items-center justify-center shadow-sm hover:bg-amber-600 active:scale-95 transition-all">
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="relative mt-2.5">
                      <StickyNote className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        value={root.note}
                        onChange={(e) => setNote(root.cartItemId, e.target.value)}
                        placeholder="Catatan opsional..."
                        className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:bg-white transition-colors"
                      />
                    </div>
                  </div>

                  {/* Children */}
                  {children.length > 0 && (
                    <div className="mt-1 space-y-2 relative z-10">
                      {children.map(child => {
                        const childDiscountedPrice = calculateItemPrice(child.item.price, child.item.id, child.item.channel_prices)
                        return (
                          <div key={child.cartItemId} className="relative pl-[3rem]">
                            {/* L-Shape branch indicator */}
                            <div className="absolute left-[20px] top-[1.25rem] w-4 h-[2px] bg-gray-200" />
                            <div className="bg-amber-50/30 rounded-xl p-2 border border-amber-100/50 transition-all hover:border-amber-200 shadow-sm">
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-amber-900 leading-snug text-xs">
                                    <span className="font-extrabold text-amber-500 mr-1.5">↳ Extra</span>
                                    {child.item.name}
                                  </p>
                                  <div className="flex items-center gap-1.5 mt-1">

                                    <p className="text-amber-700 font-bold text-sm">{formatRupiah(childDiscountedPrice * child.quantity)}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 bg-white rounded-lg p-1 border border-gray-100 flex-shrink-0 shadow-sm">
                                  <button onClick={() => setQty(child.cartItemId, child.quantity - 1)} className="w-6 h-6 rounded-md bg-gray-50 text-gray-600 flex items-center justify-center hover:bg-gray-100 active:scale-95 transition-all">
                                    {child.quantity === 1 ? <Trash2 className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3" />}
                                  </button>
                                  <span className="font-bold text-xs w-4 text-center text-gray-800">{child.quantity}</span>
                                  <button onClick={() => setQty(child.cartItemId, child.quantity + 1)} className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center hover:bg-amber-600 active:scale-95 transition-all">
                                    <Plus className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <div className="bg-gray-50 -mx-4 p-4 border-t border-gray-200 space-y-4">
          {/* Nama customer */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Nama Customer (Wajib)</label>
            <input
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Misal: Budi"
              className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors text-sm"
            />
          </div>

          {/* Promo Apps untuk Food Apps */}
          {['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(channel || '') && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">Promo Apps (Wajib)</label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={promoSubsidy}
                onChange={(e) => setPromoSubsidy(e.target.value)}
                placeholder="Misal: 10000 (bisa 0)"
                className="w-full px-3.5 py-2.5 border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-colors text-sm"
              />
            </div>
          )}

          {/* Metode bayar */}
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1.5">3. Metode Pembayaran</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setPayment('qris')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'qris' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <QrCode className="w-4 h-4" /> QRIS
              </button>
              <button
                onClick={() => setPayment('cash')}
                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 font-bold text-sm transition-all active:scale-95 ${payment === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
              >
                <Banknote className="w-4 h-4" /> Tunai
              </button>
            </div>
          </div>
          
          {/* Input tunai + kembalian */}
          {payment === 'cash' && (
            <div className="space-y-2.5 mt-4">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">Uang Diterima</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-sm">Rp</span>
                <input
                  inputMode="numeric"
                  value={amountReceived ? amountReceived.toLocaleString('id-ID') : ''}
                  onChange={(e) => setCashInput(e.target.value.replace(/\D/g, ''))}
                  placeholder="0"
                  className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white text-right text-lg font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setCashInput(String(Math.ceil(totalPrice)))}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 text-xs font-bold hover:bg-emerald-200 active:scale-95 transition-all"
                >
                  Uang Pas
                </button>
                {(() => {
                  if (totalPrice <= 0) return [20000, 50000, 100000, 150000, 200000].slice(0, 4);
                  const options = new Set<number>();
                  [10000, 20000, 50000, 100000].forEach(step => {
                    const rounded = Math.ceil(totalPrice / step) * step;
                    if (rounded > totalPrice) options.add(rounded);
                    if (rounded + step > totalPrice) options.add(rounded + step);
                  });
                  [50000, 100000, 150000, 200000, 300000, 500000].forEach(fixed => {
                    if (fixed > totalPrice) options.add(fixed);
                  });
                  return Array.from(options).sort((a, b) => a - b).slice(0, 4);
                })().map((v) => (
                  <button
                    key={v}
                    onClick={() => setCashInput(String(v))}
                    className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 text-xs font-bold hover:bg-gray-50 active:scale-95 transition-all"
                  >
                    {formatRupiah(v)}
                  </button>
                ))}
              </div>
              {amountReceived > 0 && (
                <div className={`flex items-center justify-between rounded-xl px-3.5 py-2.5 ${cashEnough ? 'bg-emerald-50 border border-emerald-100' : 'bg-red-50 border border-red-100'}`}>
                  <span className={`text-sm font-bold ${cashEnough ? 'text-emerald-700' : 'text-red-600'}`}>
                    {cashEnough ? 'Kembalian' : 'Kurang'}
                  </span>
                  <span className={`text-lg font-black ${cashEnough ? 'text-emerald-700' : 'text-red-600'}`}>
                    {formatRupiah(Math.abs(change))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1 pt-2">
          {needsMoreForPromo && missingAmount ? (
            <div className="bg-blue-50 text-blue-700 text-xs px-3 py-2 rounded-lg font-medium border border-blue-100 flex items-center gap-2 mb-2">
              <span className="shrink-0 bg-blue-500 text-white w-4 h-4 rounded-full inline-flex items-center justify-center text-[10px] font-bold">i</span>
              <span>Tambah <b>{formatRupiah(missingAmount)}</b> lagi untuk dapat diskon promo!</span>
            </div>
          ) : null}
          {globalDiscount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 font-medium">
                Diskon {globalPromo?.name ? `(${globalPromo.name})` : ''}
              </span>
              <span className="text-red-500 font-bold">-{formatRupiah(globalDiscount)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-gray-500 font-bold">Total Pembayaran</span>
            <span className="text-2xl font-black text-gray-900">{formatRupiah(totalPrice)}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Konfirmasi / Tampilkan QRIS */}
        {payment === 'qris' ? (
          <button
            onClick={() => setOnlineQrisOpen(true)}
            disabled={!canSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <QrCode className="w-5 h-5" /> Tampilkan QRIS
          </button>
        ) : (
          <button
            onClick={() => onSubmit(amountReceived)}
            disabled={payment === 'cash' ? !canPayCash : !canSubmit}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-xl shadow-sm shadow-amber-200 flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            {submitting ? (
              <><Loader2 className="w-5 h-5 animate-spin" /> Memproses...</>
            ) : (
              <><CheckCircle2 className="w-5 h-5" /> Konfirmasi (Diproses)</>
            )}
          </button>
        )}
        {!canSubmit && !submitting && (
          <p className="text-xs text-gray-400 text-center -mt-1">
            {lineList.length === 0 ? 'Pilih minimal 1 menu' : !channel ? 'Pilih channel dulu' : !customerName.trim() ? 'Nama customer wajib diisi' : !payment ? 'Pilih metode pembayaran' : ''}
          </p>
        )}
        {ch && lineList.length > 0 && (
          <p className="text-xs text-center text-gray-400 -mt-1">
            Channel: <b style={{ color: ch.bg }}>{ch.label}</b>
          </p>
        )}
      </div>

      {/* ── Modal QRIS Online ── */}
      <QrisPaymentModal
        isOpen={onlineQrisOpen}
        onClose={() => setOnlineQrisOpen(false)}
        totalPrice={totalPrice}
        isOnline={true}
        isFoodApp={['gofood', 'grabfood', 'shopeefood', 'tiktok', 'tiktokgo'].includes(channel || '')}
        submitting={submitting}
        onSubmit={(proofUrl: any) => {
          setOnlineQrisOpen(false)
          onSubmit(null, typeof proofUrl === 'string' ? proofUrl : null)
        }}
      />

    </div>
  )
}


