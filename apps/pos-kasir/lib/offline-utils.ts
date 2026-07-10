export async function fetchWithTimeout<T>(promise: Promise<T> | PromiseLike<T>, timeoutMs: number = 4000): Promise<T> {
  // If we are definitely offline, fail fast immediately
  if (typeof window !== 'undefined' && !navigator.onLine) {
    throw new Error('Offline mode: skipping Supabase fetch')
  }

  let timeoutId: ReturnType<typeof setTimeout>
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Timeout: Request took longer than ${timeoutMs}ms`))
    }, timeoutMs)
  })

  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => {
    clearTimeout(timeoutId)
  })
}
