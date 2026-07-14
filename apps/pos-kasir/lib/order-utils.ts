import type { OrderWithItems } from '@/types'

export interface ParsedOrderItem {
  id: string
  quantity: number
  menu_item_name: string
  parsedName: string
  parsedNote: string
  parsedId: string
  parsedParentId: string | null
  [key: string]: any
}

export interface ParsedOrder extends OrderWithItems {
  _effectiveReleaseTime: number;
  _estimatedCookingTime: number;
  _parsedItems: {
    rootItems: ParsedOrderItem[];
    childrenMap: Record<string, ParsedOrderItem[]>;
  };
}

export function parseOrderData(order: OrderWithItems): ParsedOrder {
  // 1. Calculate effective release time
  let effectiveReleaseTime = 0;
  if (order.release_time) {
    effectiveReleaseTime = new Date(order.release_time).getTime();
  } else {
    let timeStr = (order as any).pickup_time;
    if (!timeStr && order.notes && order.notes.toUpperCase().includes('AMBIL')) {
      const match = order.notes.match(/AMBIL\s*[:\n]\s*(\d{2}:\d{2})/i);
      if (match) timeStr = match[1];
    }

    if (timeStr && typeof timeStr === 'string') {
      const timeMatch = timeStr.match(/(\d{2}):(\d{2})/);
      if (timeMatch) {
        const [_, h, m] = timeMatch;
        const d = new Date(order.created_at);
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        
        if (d.getTime() < new Date(order.created_at).getTime()) {
          d.setDate(d.getDate() + 1);
        }
        
        effectiveReleaseTime = d.getTime() - (20 * 60 * 1000);
      }
    }
  }

  // 2. Calculate estimated cooking time
  let estimatedCookingTime = 7;
  if (order.order_items && order.order_items.length > 0) {
    const totalQty = order.order_items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    estimatedCookingTime = 7 + (totalQty > 1 ? totalQty - 1 : 0);
  }

  // 3. Parse items
  const parsedItems = (order.order_items || []).map(oi => {
    let name = oi.menu_item_name || '';
    let note = '';
    let id = oi.id;
    let parentId = null;
    
    const noteSplit = name.split('|NOTE|');
    if (noteSplit.length > 1) { note = noteSplit[1]; name = noteSplit[0]; }
    
    const parentSplit = name.split('|PARENT|');
    if (parentSplit.length > 1) { parentId = parentSplit[1]; name = parentSplit[0]; }
    
    const idSplit = name.split('|ID|');
    if (idSplit.length > 1) { id = idSplit[1]; name = idSplit[0]; }
    
    return { ...oi, parsedName: name, parsedNote: note, parsedId: id, parsedParentId: parentId };
  });
  
  const rootItems: ParsedOrderItem[] = [];
  const childrenMap: Record<string, ParsedOrderItem[]> = {};
  
  let lastRootId: string | null = null;

  parsedItems.forEach(i => {
    const isImplicitExtra = !i.parsedParentId && (i.parsedName.toLowerCase().startsWith('extra ') || i.parsedName.toLowerCase().startsWith('toping '));

    if (i.parsedParentId) {
      // Explicit parent
      if (!childrenMap[i.parsedParentId]) childrenMap[i.parsedParentId] = [];
      childrenMap[i.parsedParentId].push(i);
    } else if (isImplicitExtra && lastRootId) {
      // Implicit parent fallback for legacy orders
      i.parsedParentId = lastRootId;
      if (!childrenMap[lastRootId]) childrenMap[lastRootId] = [];
      childrenMap[lastRootId].push(i);
    } else {
      // Root item
      rootItems.push(i);
      lastRootId = i.parsedId;
    }
  });

  // Verify explicit parents exist, otherwise hoist to root
  const validRootIds = new Set(rootItems.map(r => r.parsedId));
  Object.keys(childrenMap).forEach(parentId => {
    if (!validRootIds.has(parentId)) {
      rootItems.push(...childrenMap[parentId]);
      delete childrenMap[parentId];
    }
  });

  return {
    ...order,
    _effectiveReleaseTime: effectiveReleaseTime,
    _estimatedCookingTime: estimatedCookingTime,
    _parsedItems: {
      rootItems,
      childrenMap
    }
  };
}
