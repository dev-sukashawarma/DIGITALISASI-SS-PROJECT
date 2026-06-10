import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SPVMonitoringData, CrewMonitoringData } from '@/lib/types/monitoring';
import { fetchSPVMonitoringData, fetchCrewMonitoringData } from '@/lib/queries/monitoring';
import { useAutoRefresh } from './useAutoRefresh';

export function useSPVMonitoringData() {
  const queryClient = useQueryClient();
  const [isError, setIsError] = useState(false);
  const [cachedData, setCachedData] = useState<SPVMonitoringData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitoring', 'spv'],
    queryFn: async () => {
      try {
        const result = await fetchSPVMonitoringData();
        setCachedData(result);
        setIsError(false);
        return result;
      } catch (err) {
        setIsError(true);
        // Return cached data on error
        if (cachedData) {
          return cachedData;
        }
        throw err;
      }
    },
    staleTime: 25000, // Consider stale after 25s (refresh at 30s)
    gcTime: 60000, // Keep in cache for 1 min
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const autoRefresh = useAutoRefresh({
    interval: 30000,
    onRefresh: handleRefresh,
  });

  return {
    data,
    isLoading,
    error,
    isError,
    refetch: handleRefresh,
    autoRefresh,
    lastFetched: data?.lastFetched || cachedData?.lastFetched,
  };
}

export function useCrewMonitoringData() {
  const queryClient = useQueryClient();
  const [isError, setIsError] = useState(false);
  const [cachedData, setCachedData] = useState<CrewMonitoringData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitoring', 'crew'],
    queryFn: async () => {
      try {
        const result = await fetchCrewMonitoringData();
        setCachedData(result);
        setIsError(false);
        return result;
      } catch (err) {
        setIsError(true);
        if (cachedData) {
          return cachedData;
        }
        throw err;
      }
    },
    staleTime: 25000,
    gcTime: 60000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const handleRefresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  const autoRefresh = useAutoRefresh({
    interval: 30000,
    onRefresh: handleRefresh,
  });

  return {
    data,
    isLoading,
    error,
    isError,
    refetch: handleRefresh,
    autoRefresh,
    lastFetched: data?.lastFetched || cachedData?.lastFetched,
  };
}
