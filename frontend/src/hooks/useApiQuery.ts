import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '@/lib/api'

interface ApiQuery<T> {
  data: T | null
  error: string | null
  isLoading: boolean
  reload: () => Promise<void>
}

/** Loads `path` (re-fetching when it changes). Pass null to skip. */
export function useApiQuery<T>(path: string | null): ApiQuery<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(path !== null)

  const load = useCallback(async () => {
    if (path === null) return
    setIsLoading(true)
    try {
      setData(await api<T>(path))
      setError(null)
    } catch (e) {
      setError(errorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [path])

  useEffect(() => {
    void load()
  }, [load])

  return { data, error, isLoading, reload: load }
}
