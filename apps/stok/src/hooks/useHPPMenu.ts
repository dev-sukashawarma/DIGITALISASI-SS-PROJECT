import { useQuery } from '@tanstack/react-query'
import { fetchHPPMenuList, type HPPMenuItem } from '@/app/actions/hppMenu'

export function useHPPMenuList() {
  return useQuery<HPPMenuItem[]>({
    queryKey: ['hpp-menu-list'],
    queryFn: async () => {
      return await fetchHPPMenuList()
    },
    staleTime: 60000, // 1 menit cache
    refetchOnWindowFocus: false,
  })
}

export type { HPPMenuItem, HPPMenuIngredient } from '@/app/actions/hppMenu'
