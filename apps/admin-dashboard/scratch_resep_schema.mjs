// Scratch schema tool
export {}


export function getMenuCategoryGroup(menu) {
  const channels = menu.available_online_channels || []
  const catName = menu.category || ''

  // 1. Check if TikTok Series
  // Criteria:
  // - available_online_channels has only tiktokgo / tiktok
  // - or name starts with 'Best Seller' and has tiktokgo
  // - or is a tiktok special package (PAKET, DUO, TRIPLE, MEGABITE, SPESIAL SUKA LOVERS, SUKA PREMIUM CRISPY, MIX CHEESE COMBO) with tiktokgo channel
  const isTiktokExclusive = channels.length === 1 && (channels[0] === 'tiktokgo' || channels[0] === 'tiktok')
  const isTiktokBestSeller = menu.name.startsWith('Best Seller') && channels.includes('tiktokgo')
  const isTiktokCombo = (menu.is_package || menu.name.includes('PAKET') || menu.name.includes('TRIPLE') || menu.name.includes('DUO') || menu.name.includes('MEGABITE')) && 
                        channels.includes('tiktokgo') && !channels.includes('gofood') && !channels.includes('grabfood')

  if (isTiktokExclusive || isTiktokBestSeller || isTiktokCombo || (channels.includes('tiktokgo') && !channels.includes('gofood') && !channels.includes('grabfood') && !channels.includes('pos_kasir'))) {
    return {
      id: 'tiktok',
      name: 'TikTok Series',
      shortName: 'TikTok Series',
      order: 90,
      icon: '📱',
      color: 'from-pink-500 to-rose-600',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200'
    }
  }

  // 2. Original Shawarma Sapi
  if (catName.toLowerCase().includes('sapi') && !catName.toLowerCase().includes('shawarmie') && !catName.toLowerCase().includes('mix') && !catName.toLowerCase().includes('suka suka')) {
    return {
      id: 'sapi',
      name: 'Original Shawarma Sapi',
      shortName: 'Shawarma Sapi',
      order: 10,
      icon: '🥩',
      color: 'from-amber-600 to-orange-700',
      badgeBg: 'bg-amber-50 text-amber-800 border-amber-200'
    }
  }

  // 3. Original Shawarma Ayam
  if (catName.toLowerCase().includes('ayam') && !catName.toLowerCase().includes('shawarmie') && !catName.toLowerCase().includes('mix') && !catName.toLowerCase().includes('suka suka')) {
    return {
      id: 'ayam',
      name: 'Original Shawarma Ayam',
      shortName: 'Shawarma Ayam',
      order: 20,
      icon: '🍗',
      color: 'from-orange-500 to-amber-600',
      badgeBg: 'bg-orange-50 text-orange-800 border-orange-200'
    }
  }

  // 4. Shawarma Mix
  if (catName.toLowerCase().includes('mix') || menu.name.toLowerCase().includes('mix')) {
    return {
      id: 'mix',
      name: 'Shawarma Mix (Sapi + Ayam)',
      shortName: 'Shawarma Mix',
      order: 30,
      icon: '🌯',
      color: 'from-emerald-500 to-teal-600',
      badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200'
    }
  }

  // 5. Suka Suka Series (Ala Carte)
  if (catName.toLowerCase().includes('suka suka') || (menu.name.toLowerCase().startsWith('suka ') && !menu.is_package)) {
    return {
      id: 'suka_suka',
      name: 'Suka Suka Series',
      shortName: 'Suka Suka',
      order: 40,
      icon: '🌶️',
      color: 'from-red-500 to-orange-500',
      badgeBg: 'bg-red-50 text-red-800 border-red-200'
    }
  }

  // 6. Shawarmie
  if (catName.toLowerCase().includes('shawarmie') || menu.name.toLowerCase().startsWith('shawarmie')) {
    return {
      id: 'shawarmie',
      name: 'Shawarmie (Shawarma Mie)',
      shortName: 'Shawarmie',
      order: 50,
      icon: '🍜',
      color: 'from-yellow-500 to-amber-600',
      badgeBg: 'bg-yellow-50 text-yellow-800 border-yellow-200'
    }
  }

  // 7. Combo Reguler
  if (catName.toLowerCase().includes('combo') || menu.is_package) {
    return {
      id: 'combo_reguler',
      name: 'Combo Reguler (Kasir / Dine-In)',
      shortName: 'Combo Reguler',
      order: 60,
      icon: '📦',
      color: 'from-purple-500 to-indigo-600',
      badgeBg: 'bg-purple-50 text-purple-800 border-purple-200'
    }
  }

  // 8. Topping
  if (catName.toLowerCase().includes('topping') || menu.name.toLowerCase().startsWith('extra ')) {
    return {
      id: 'topping',
      name: 'Topping & Add-ons',
      shortName: 'Topping',
      order: 70,
      icon: '🍟',
      color: 'from-blue-500 to-cyan-600',
      badgeBg: 'bg-blue-50 text-blue-800 border-blue-200'
    }
  }

  // 9. Minuman / Suka Drink
  if (catName.toLowerCase().includes('drink') || catName.toLowerCase().includes('minuman') || menu.name.toLowerCase().includes('tea') || menu.name.toLowerCase().includes('juice')) {
    return {
      id: 'drink',
      name: 'Minuman / Suka Drink',
      shortName: 'Minuman',
      order: 80,
      icon: '🥤',
      color: 'from-cyan-500 to-blue-600',
      badgeBg: 'bg-cyan-50 text-cyan-800 border-cyan-200'
    }
  }

  return {
    id: 'other',
    name: catName || 'Lainnya',
    shortName: catName || 'Lainnya',
    order: 85,
    icon: '🍴',
    color: 'from-gray-500 to-slate-600',
    badgeBg: 'bg-gray-50 text-gray-800 border-gray-200'
  }
}

async function test() {
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, name, category_id, is_package, price, sort_order, channel_prices, is_available_online, available_online_channels, categories(id, name)')
    .order('name')

  const groups = {}

  menuItems?.forEach((m) => {
    const group = getMenuCategoryGroup({
      name: m.name,
      category: m.categories?.name,
      is_package: m.is_package,
      available_online_channels: m.available_online_channels,
      channel_prices: m.channel_prices
    })

    if (!groups[group.id]) {
      groups[group.id] = { meta: group, items: [] }
    }
    groups[group.id].items.push(m)
  })

  const sortedGroupKeys = Object.keys(groups).sort((a, b) => groups[a].meta.order - groups[b].meta.order)

  sortedGroupKeys.forEach(k => {
    const g = groups[k]
    console.log(`\n=== ${g.meta.icon} ${g.meta.name} (Total: ${g.items.length}) [Order: ${g.meta.order}] ===`)
    g.items.forEach(i => console.log(`  - ${i.name} (Rp ${i.price})`))
  })
}
test()
