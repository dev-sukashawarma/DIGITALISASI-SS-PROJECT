export function isMarketplaceOutlet(outlet: { type?: string }): boolean {
  return outlet.type === 'marketplace'
}

export function splitOutletsByType<T extends { type?: string }>(
  outlets: T[]
): { physical: T[]; marketplace: T[] } {
  const physical: T[] = []
  const marketplace: T[] = []
  for (const outlet of outlets) {
    if (isMarketplaceOutlet(outlet)) {
      marketplace.push(outlet)
    } else {
      physical.push(outlet)
    }
  }
  return { physical, marketplace }
}
