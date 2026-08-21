export interface CategoryGroupMeta {
  id: string
  name: string
  shortName: string
  order: number
  icon: string
  color: string
  badgeBg: string
  borderAccent: string
}

export const CATEGORY_GROUPS: CategoryGroupMeta[] = [
  {
    id: 'sapi',
    name: 'Original Shawarma Sapi',
    shortName: 'Shawarma Sapi',
    order: 10,
    icon: '🥩',
    color: 'from-amber-600 to-orange-700',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    borderAccent: 'border-l-amber-500',
  },
  {
    id: 'ayam',
    name: 'Original Shawarma Ayam',
    shortName: 'Shawarma Ayam',
    order: 20,
    icon: '🍗',
    color: 'from-orange-500 to-amber-600',
    badgeBg: 'bg-orange-50 text-orange-800 border-orange-200',
    borderAccent: 'border-l-orange-500',
  },
  {
    id: 'mix',
    name: 'Shawarma Mix (Sapi + Ayam)',
    shortName: 'Shawarma Mix',
    order: 30,
    icon: '🌯',
    color: 'from-emerald-600 to-teal-600',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    borderAccent: 'border-l-emerald-500',
  },
  {
    id: 'suka_suka',
    name: 'Suka Suka Series',
    shortName: 'Suka Suka',
    order: 40,
    icon: '🌶️',
    color: 'from-red-500 to-orange-500',
    badgeBg: 'bg-red-50 text-red-800 border-red-200',
    borderAccent: 'border-l-red-500',
  },
  {
    id: 'shawarmie',
    name: 'Shawarmie (Shawarma Mie)',
    shortName: 'Shawarmie',
    order: 50,
    icon: '🍜',
    color: 'from-yellow-500 to-amber-600',
    badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    borderAccent: 'border-l-yellow-500',
  },
  {
    id: 'combo_reguler',
    name: 'Combo Reguler (Kasir / Dine-In)',
    shortName: 'Combo Reguler',
    order: 60,
    icon: '📦',
    color: 'from-purple-500 to-indigo-600',
    badgeBg: 'bg-purple-50 text-purple-800 border-purple-200',
    borderAccent: 'border-l-purple-500',
  },
  {
    id: 'topping',
    name: 'Topping & Add-ons',
    shortName: 'Topping',
    order: 70,
    icon: '🍟',
    color: 'from-blue-500 to-cyan-600',
    badgeBg: 'bg-blue-50 text-blue-800 border-blue-200',
    borderAccent: 'border-l-blue-500',
  },
  {
    id: 'drink',
    name: 'Minuman / Suka Drink',
    shortName: 'Minuman',
    order: 80,
    icon: '🥤',
    color: 'from-cyan-500 to-blue-600',
    badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200',
    borderAccent: 'border-l-cyan-500',
  },
  {
    id: 'tiktok',
    name: 'TikTok Series (TikTok Go)',
    shortName: 'TikTok Series',
    order: 90,
    icon: '📱',
    color: 'from-pink-500 to-rose-600',
    badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    borderAccent: 'border-l-rose-500',
  },
]

export function getMenuCategoryGroup(menu: {
  name: string
  category?: string
  is_package?: boolean
  isPackage?: boolean
  available_online_channels?: string[] | null
  availableOnlineChannels?: string[] | null
  channel_prices?: Record<string, number>
  channelPrices?: Record<string, number>
}): CategoryGroupMeta {
  const channels = menu.availableOnlineChannels || menu.available_online_channels || []
  const catName = (menu.category || '').trim()
  const isPkg = !!(menu.isPackage || menu.is_package)
  const nameLower = (menu.name || '').toLowerCase()

  // 1. TikTok Series check (dedicated live promo & tiktokgo menus)
  const isTiktokExclusive = channels.length === 1 && (channels[0] === 'tiktokgo' || channels[0] === 'tiktok')
  const isTiktokBestSeller = nameLower.startsWith('best seller') && channels.includes('tiktokgo')
  const isTiktokCombo =
    (isPkg || nameLower.includes('paket') || nameLower.includes('triple') || nameLower.includes('duo') || nameLower.includes('megabite')) &&
    channels.includes('tiktokgo') &&
    !channels.includes('gofood') &&
    !channels.includes('grabfood')

  if (
    isTiktokExclusive ||
    isTiktokBestSeller ||
    isTiktokCombo ||
    (channels.includes('tiktokgo') && !channels.includes('gofood') && !channels.includes('grabfood') && !channels.includes('pos_kasir'))
  ) {
    return CATEGORY_GROUPS.find((c) => c.id === 'tiktok')!
  }

  // 2. Original Shawarma Sapi
  if (
    catName.toLowerCase().includes('sapi') &&
    !catName.toLowerCase().includes('shawarmie') &&
    !catName.toLowerCase().includes('mix') &&
    !catName.toLowerCase().includes('suka suka')
  ) {
    return CATEGORY_GROUPS.find((c) => c.id === 'sapi')!
  }

  // 3. Original Shawarma Ayam
  if (
    catName.toLowerCase().includes('ayam') &&
    !catName.toLowerCase().includes('shawarmie') &&
    !catName.toLowerCase().includes('mix') &&
    !catName.toLowerCase().includes('suka suka')
  ) {
    return CATEGORY_GROUPS.find((c) => c.id === 'ayam')!
  }

  // 4. Shawarma Mix (Sapi + Ayam)
  if (catName.toLowerCase().includes('mix') || nameLower.includes('mix')) {
    return CATEGORY_GROUPS.find((c) => c.id === 'mix')!
  }

  // 5. Suka Suka Series (Ala Carte flavors)
  if (
    catName.toLowerCase().includes('suka suka') ||
    (nameLower.startsWith('suka ') && !isPkg && !nameLower.includes('merdeka'))
  ) {
    return CATEGORY_GROUPS.find((c) => c.id === 'suka_suka')!
  }

  // 6. Shawarmie
  if (catName.toLowerCase().includes('shawarmie') || nameLower.startsWith('shawarmie')) {
    return CATEGORY_GROUPS.find((c) => c.id === 'shawarmie')!
  }

  // 7. Combo Reguler (Dine-in / Kasir)
  if (catName.toLowerCase().includes('combo') || isPkg) {
    return CATEGORY_GROUPS.find((c) => c.id === 'combo_reguler')!
  }

  // 8. Topping & Add-ons
  if (catName.toLowerCase().includes('topping') || nameLower.startsWith('extra ')) {
    return CATEGORY_GROUPS.find((c) => c.id === 'topping')!
  }

  // 9. Minuman / Suka Drink
  if (
    catName.toLowerCase().includes('drink') ||
    catName.toLowerCase().includes('minuman') ||
    nameLower.includes('tea') ||
    nameLower.includes('juice')
  ) {
    return CATEGORY_GROUPS.find((c) => c.id === 'drink')!
  }

  return {
    id: 'other',
    name: catName || 'Lainnya',
    shortName: catName || 'Lainnya',
    order: 85,
    icon: '🍴',
    color: 'from-gray-500 to-slate-600',
    badgeBg: 'bg-gray-50 text-gray-800 border-gray-200',
    borderAccent: 'border-l-gray-400',
  }
}
