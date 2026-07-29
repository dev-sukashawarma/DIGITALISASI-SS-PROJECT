const channels = [
  { id: '1284ac2a-e753-4380-9f32-59219a322459', name: 'GoFood', is_active: true },
  { id: '6802a8b5-8fe3-4ddb-b552-ee87ee7d7f6a', name: 'GrabFood', is_active: true },
  { id: '0eaf2746-da9f-492c-a9b4-f091307c98c2', name: 'ShopeeFood', is_active: true },
  { id: 'c9b01c9f-0e5b-462f-bba8-9a9b6525c5c8', name: 'TikTok Go', is_active: true }
];

const row = {
  isAvailableOnline: true,
  availableOnlineChannels: [ 'shopeefood', 'gofood', 'grabfood', 'pos_kasir' ],
  channelPrices: {
    gofood: 17000,
    online: 17000,
    grabfood: 17000,
    tiktok_go: 17000,
    shopeefood: 17000
  },
  price: 15000
};

const activeChannels = (channels || []).filter(ch => {
  const slug = ch.name.toLowerCase().replace(/\s+/g, '');
  if (row.availableOnlineChannels === null || row.availableOnlineChannels === undefined) return true; // All channels
  return row.availableOnlineChannels.some(
    c => {
      const cleanC = c.toLowerCase().replace(/\s+/g, '');
      return cleanC === slug || (slug === 'tiktokgo' && (cleanC === 'tiktokgo' || cleanC === 'tiktok_go' || cleanC === 'tiktok'));
    }
  );
});

console.log("activeChannels:", activeChannels);

activeChannels.map(ch => {
  const slug = ch.name.toLowerCase().replace(/\s+/g, '');
  const explicitPrice = row.channelPrices[slug] || (slug === 'tiktokgo' ? row.channelPrices['tiktok_go'] : undefined);
  const displayPrice = (explicitPrice !== undefined && explicitPrice !== null && Number(explicitPrice) > 0) ? explicitPrice : row.price;
  console.log(`${ch.name}: ${displayPrice}`);
});
