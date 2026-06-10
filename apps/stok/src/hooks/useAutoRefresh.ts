import { useEffect, useRef } from 'react';

interface UseAutoRefreshOptions {
  interval?: number; // ms, default 30000
  onRefresh: () => Promise<void>;
  enabled?: boolean;
}

export function useAutoRefresh({
  interval = 30000,
  onRefresh,
  enabled = true,
}: UseAutoRefreshOptions) {
  const intervalRef = useRef<NodeJS.Timeout>();
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    // Initial refresh
    if (!pausedRef.current) {
      onRefresh().catch(console.error);
    }

    // Set up interval
    intervalRef.current = setInterval(() => {
      if (!pausedRef.current) {
        onRefresh().catch(console.error);
      }
    }, interval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [interval, onRefresh, enabled]);

  const pause = () => {
    pausedRef.current = true;
  };

  const resume = () => {
    pausedRef.current = false;
    onRefresh().catch(console.error);
  };

  const isPaused = () => pausedRef.current;

  return { pause, resume, isPaused };
}
