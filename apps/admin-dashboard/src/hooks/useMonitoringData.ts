'use client';

import { useState, useCallback, useRef, useId } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SPVMonitoringData } from '@/lib/types/monitoring';
import {
  fetchSPVMonitoringData,
  fetchLeaderMonitoringData,
  fetchRecentLedger,
  fetchWasteToday
} from '@/lib/queries/monitoring';
import { useRealtimeInvalidate } from '@suka/realtime';

/**
 * Live activity feed for cross-outlet stock movements.
 */
export function useRecentLedger(limit = 50) {
  return useQuery({
    queryKey: ['monitoring', 'recentLedger', limit],
    queryFn: () => fetchRecentLedger(limit),
    refetchInterval: 15000,
    staleTime: 10000,
    gcTime: 60000,
    retry: 2,
  });
}

/**
 * Today's loss events (waste / rejected / shrinkage) across all outlets.
 */
export function useWasteToday() {
  return useQuery({
    queryKey: ['monitoring', 'wasteToday'],
    queryFn: fetchWasteToday,
    refetchInterval: 30000,
    staleTime: 20000,
    gcTime: 60000,
    retry: 2,
  });
}

export function useSPVMonitoringData(enabled = true) {
  const [isError, setIsError] = useState(false);
  const cachedDataRef = useRef<SPVMonitoringData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitoring', 'spv'],
    queryFn: async () => {
      try {
        const result = await fetchSPVMonitoringData();
        cachedDataRef.current = result;
        setIsError(false);
        return result;
      } catch (err) {
        setIsError(true);
        if (cachedDataRef.current) {
          return cachedDataRef.current;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 25000,
    gcTime: 60000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const handleRefresh = useCallback(async () => {
    setIsError(false);
    await refetch();
  }, [refetch]);

  return {
    data,
    isLoading,
    error,
    isError,
    refetch: handleRefresh,
    lastFetched: data?.lastFetched || cachedDataRef.current?.lastFetched,
  };
}

export function useLeaderMonitoringData(enabled = true) {
  const [isError, setIsError] = useState(false);
  const cachedDataRef = useRef<SPVMonitoringData | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['monitoring', 'leader'],
    queryFn: async () => {
      try {
        const result = await fetchLeaderMonitoringData();
        cachedDataRef.current = result;
        setIsError(false);
        return result;
      } catch (err) {
        setIsError(true);
        if (cachedDataRef.current) {
          return cachedDataRef.current;
        }
        throw err;
      }
    },
    enabled,
    staleTime: 25000,
    gcTime: 60000,
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });

  const handleRefresh = useCallback(async () => {
    setIsError(false);
    await refetch();
  }, [refetch]);

  return {
    data,
    isLoading,
    error,
    isError,
    refetch: handleRefresh,
    lastFetched: data?.lastFetched || cachedDataRef.current?.lastFetched,
  };
}

/**
 * Realtime invalidation for query keys under ['monitoring'].
 */
export function useMonitoringRealtime() {
  const instanceId = useId();
  useRealtimeInvalidate({
    channelName: `monitoring_realtime_${instanceId}`,
    subs: [
      { table: 'stok_balance', queryKeys: [['monitoring']] },
      { table: 'ledger_stok', queryKeys: [['monitoring']] },
    ],
  });
}
