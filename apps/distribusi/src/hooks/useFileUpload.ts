'use client'
import { useCallback } from 'react'
import { createSupabaseBrowserClient } from '@suka/auth'

export function useFileUpload() {
  const supabase = createSupabaseBrowserClient()

  const uploadFoto = useCallback(async (
    file: File,
    surat_jalan_id: string,
    item_id: string
  ): Promise<string> => {
    const filename = `${surat_jalan_id}/${item_id}/${Date.now()}-${file.name}`
    const path = `surat-jalan/${filename}`

    const { error } = await supabase.storage.from('distribusi').upload(path, file, {
      cacheControl: '3600',
      upsert: false,
    })

    if (error) throw error
    return path
  }, [])

  const deleteFoto = useCallback(async (path: string) => {
    const { error } = await supabase.storage.from('distribusi').remove([path])
    if (error) throw error
  }, [])

  return { uploadFoto, deleteFoto }
}
