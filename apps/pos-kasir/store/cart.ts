'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MenuItem, CartItem } from '@/types'

interface CartStore {
  items: CartItem[]
  isOpen: boolean
  addItem: (item: MenuItem, quantity?: number, note?: string, parentId?: string) => string
  removeItem: (cartItemId: string) => void
  updateQuantity: (cartItemId: string, quantity: number) => void
  clearCart: () => void
  toggleCart: () => void
  closeCart: () => void
  totalItems: () => number
  totalPrice: () => number
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      isOpen: false,

      addItem: (item, quantity = 1, note = '', parentId = undefined) => {
        let newCartItemId = ''
        set((state) => {
          const existingIndex = state.items.findIndex(
            (i) => i.item.id === item.id && (i.note || '') === note && i.parentId === parentId
          )
          if (existingIndex >= 0) {
            newCartItemId = state.items[existingIndex].cartItemId
            const newItems = [...state.items]
            newItems[existingIndex] = {
              ...newItems[existingIndex],
              quantity: Math.min(newItems[existingIndex].quantity + quantity, 10),
            }
            return { items: newItems }
          }
          newCartItemId = crypto.randomUUID()
          return {
            items: [
              ...state.items,
              { cartItemId: newCartItemId, item, quantity, note, parentId },
            ],
          }
        })
        return newCartItemId
      },

      removeItem: (cartItemId) =>
        set((state) => ({
          items: state.items.filter((i) => i.cartItemId !== cartItemId),
        })),

      updateQuantity: (cartItemId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { items: state.items.filter((i) => i.cartItemId !== cartItemId) }
          }
          return {
            items: state.items.map((i) =>
              i.cartItemId === cartItemId ? { ...i, quantity: Math.min(quantity, 10) } : i
            ),
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
