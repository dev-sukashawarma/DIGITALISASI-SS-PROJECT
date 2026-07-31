'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MenuItem, CartItem } from '@/types'

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: MenuItem, quantity?: number, note?: string, parentId?: string, package_choices?: Record<string, string>) => string
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  closeCart: () => void
  totalItems: () => number
  totalPrice: () => number
}

function arePackageChoicesEqual(a?: Record<string, string>, b?: Record<string, string>): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item, quantity = 1, note = '', parentId = undefined, package_choices = undefined) => {
        let newCartItemId = ''
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => i.item.id === item.id && (i.note || '') === note && i.parentId === parentId && arePackageChoicesEqual(i.package_choices, package_choices)
          )
          if (existingIndex >= 0) {
            newCartItemId = state.items[existingIndex].cartItemId
            const newItems = [...state.items];
            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: newItems[existingIndex].quantity + quantity,
            };
            return { items: newItems }
          }
          newCartItemId = crypto.randomUUID()
          return {
            items: [
              ...state.items,
              { cartItemId: newCartItemId, item, quantity, note, parentId, package_choices },
            ],
          }
        })
        return newCartItemId
      },

      removeItem: (cartItemId) =>
        set((state) => {
          const childrenToRemove = state.items.filter((i) => i.parentId === cartItemId).map(i => i.cartItemId);
          const toRemove = new Set([cartItemId, ...childrenToRemove]);
          return {
            items: state.items.filter((i) => !toRemove.has(i.cartItemId)),
          }
        }),

      updateQuantity: (cartItemId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            const childrenToRemove = state.items.filter((i) => i.parentId === cartItemId).map(i => i.cartItemId);
            const toRemove = new Set([cartItemId, ...childrenToRemove]);
            return { items: state.items.filter((i) => !toRemove.has(i.cartItemId)) }
          }
          const newQty = Math.max(1, quantity);
          return {
            items: state.items.map((i) => {
              if (i.cartItemId === cartItemId) {
                return { ...i, quantity: newQty }
              }
              if (i.parentId === cartItemId) {
                // Jangan biarkan quantity extra melebihi quantity parentnya saat dikurangi
                return { ...i, quantity: Math.min(i.quantity, newQty) }
              }
              return i
            }),
          }
        }),

      clearCart: () => set({ items: [] }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),
      closeCart: () => set({ isOpen: false }),

      totalItems: () =>
        get().items.reduce((sum, i) => sum + i.quantity, 0),

      totalPrice: () =>
        get().items.reduce((sum, i) => sum + i.item.price * i.quantity, 0),
    }),
    {
      name: 'shawarma-cart',
      partialize: (state) => ({ items: state.items }),
    }
  )
)

export const selectCartTotalItems = (state: CartStore) =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);

export const selectCartTotalPrice = (state: CartStore) =>
  state.items.reduce((sum, i) => sum + i.item.price * i.quantity, 0);
