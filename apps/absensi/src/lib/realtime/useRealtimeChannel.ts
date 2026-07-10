"use client";

import { useEffect, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase";
import { subsSignature } from "./signature";

export type RealtimeSub = {
  table: string;
  event?: "INSERT" | "UPDATE" | "DELETE" | "*";
  filter?: string;
  handler: (payload: any) => void;
};

export function useRealtimeChannel(opts: {
  channelName: string;
  enabled?: boolean;
  subs: RealtimeSub[];
}) {
  const { channelName, enabled = true, subs } = opts;
  const supabase = useMemo(() => createClient(), []);

  // Simpan subs terbaru di ref supaya handler selalu fresh tanpa re-subscribe tiap render.
  const subsRef = useRef(subs);
  subsRef.current = subs;

  // Re-subscribe hanya saat channelName/enabled/bentuk-subs (tabel|event|filter) berubah.
  const signature = subsSignature(subs);

  useEffect(() => {
    if (!enabled) return;

    const channel = supabase.channel(channelName);
    subsRef.current.forEach((sub, idx) => {
      channel.on(
        "postgres_changes" as any,
        {
          event: sub.event ?? "*",
          schema: "public",
          table: sub.table,
          ...(sub.filter ? { filter: sub.filter } : {}),
        },
        (payload: any) => {
          // Pakai handler terbaru dari ref (indeks stabil karena signature memicu re-subscribe).
          subsRef.current[idx]?.handler(payload);
        }
      );
    });
    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, channelName, enabled, signature]);
}
