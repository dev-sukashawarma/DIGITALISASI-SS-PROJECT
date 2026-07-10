/**
 * Calculates the total preparation time for an order based on its items.
 *
 * Base formula: 
 * Total Prep Time = Max(prep_time) of all items + (1 minute * (Total quantity - 1))
 * 
 * Example: 
 * - 1 Shawarma (10 min) + 1 Es Teh (5 min) = Max(10, 5) + (2 - 1)*1 = 10 + 1 = 11 mins
 * - 5 Shawarma (10 min) = Max(10) + (5 - 1)*1 = 10 + 4 = 14 mins
 */

export function calculateTotalPrepTime(items: { quantity: number; prep_time?: number }[]): number {
  if (!items || items.length === 0) return 0;

  let maxPrepTime = 0;
  let totalQuantity = 0;

  for (const item of items) {
    const itemPrepTime = item.prep_time || 10; // Default 10 if not specified
    if (itemPrepTime > maxPrepTime) {
      maxPrepTime = itemPrepTime;
    }
    totalQuantity += item.quantity;
  }

  // If no items, return 0
  if (totalQuantity === 0) return 0;

  return maxPrepTime + (totalQuantity - 1);
}

/**
 * Calculates the release time (when the kitchen should start cooking)
 * based on the requested pickup time and the total prep time.
 */
export function calculateReleaseTime(pickupTime: Date, totalPrepTimeMinutes: number): Date {
  // Always release at least 20 minutes before pickup time to give enough warning
  const leadTimeMinutes = Math.max(20, totalPrepTimeMinutes);
  return new Date(pickupTime.getTime() - leadTimeMinutes * 60000);
}

/**
 * Parses a pickup time string (e.g. "15:30", or an ISO string) into a Date object.
 * If it's a HH:MM string, it will be mapped to today's date.
 */
export function parsePickupTime(pickupTimeStr: string | null | undefined): Date | null {
  if (!pickupTimeStr || pickupTimeStr === "-") return null;

  // Check if it's "HH:MM"
  if (/^\d{1,2}:\d{2}$/.test(pickupTimeStr)) {
    const [hours, minutes] = pickupTimeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  // Fallback to standard Date parsing (e.g. ISO string)
  const parsed = new Date(pickupTimeStr);
  if (isNaN(parsed.getTime())) return null;
  return parsed;
}

