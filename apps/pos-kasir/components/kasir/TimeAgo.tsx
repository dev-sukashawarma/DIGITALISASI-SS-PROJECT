"use client";

import React, { useState, useEffect } from 'react';

// Waktu relatif yang mudah dibaca kasir: "Baru saja", "3 menit yang lalu", dst.
function timeAgo(iso: string, now: number): string {
  const diff = Math.max(0, now - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return 'Baru saja'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} menit yang lalu`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} jam yang lalu`
  const day = Math.floor(hr / 24)
  return `${day} hari yang lalu`
}

interface TimeAgoProps {
  date: string | Date;
  refreshInterval?: number; // in milliseconds
  className?: string;
}

export const TimeAgo: React.FC<TimeAgoProps> = ({ date, refreshInterval = 60000, className }) => {
  const [timeStr, setTimeStr] = useState<string>('');

  useEffect(() => {
    if (!date) return;
    
    const parsedDate = new Date(date);
    
    const updateTime = () => {
      setTimeStr(timeAgo(parsedDate.toISOString(), Date.now()));
    };

    // Initial update
    updateTime();

    // Setup interval
    const intervalId = setInterval(updateTime, refreshInterval);

    return () => clearInterval(intervalId);
  }, [date, refreshInterval]);

  return <span className={className}>{timeStr}</span>;
};
