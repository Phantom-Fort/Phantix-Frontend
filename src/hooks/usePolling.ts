import { useQuery, UseQueryOptions } from '@tanstack/react-query'

export function usePolling<TData = unknown>(
  queryKey: string[],
  queryFn: () => Promise<TData>,
  options?: {
    interval?: number
    enabled?: boolean
    stopCondition?: (data: TData) => boolean
  } & Partial<UseQueryOptions<TData>>,
) {
  const { interval = 3000, stopCondition, enabled = true, ...queryOptions } = options ?? {}

  return useQuery<TData>({
    queryKey,
    queryFn,
    ...queryOptions,
    refetchInterval: (query) => {
      if (stopCondition && query.state.data) {
        return stopCondition(query.state.data) ? false : interval
      }
      return interval
    },
    enabled,
  })
}
