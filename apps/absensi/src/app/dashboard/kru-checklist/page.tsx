"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Spinner, EmptyState } from "@suka/design-system";
import { ListChecks, CheckCircle2, Circle, ChevronDown, ChevronUp, User, Lock, Sunrise, Sunset, Store } from "lucide-react";
import { useAuth } from '@suka/auth';
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";
import { OutletSwitcher } from "@/components/OutletSwitcher";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

type TickRow = {
  id: string;
  item_id: string;
  ticked_by: string;
  ticked_at: string;
  outlet_staff?: { name: string } | null;
};

type ChecklistItem = {
  id: string;
  task_name: string;
  is_required: boolean;
};

type ChecklistCategory = {
  id: string;
  name: string;
  phase?: "buka" | "tutup" | null;
  checklist_items: ChecklistItem[];
};

// --- Subcomponents for Performance ---

const ChecklistItemRow = React.memo(({ 
  item, 
  tick, 
  hasClockedIn, 
  outletStaff, 
  recordId, 
  qc 
}: { 
  item: ChecklistItem; 
  tick?: TickRow; 
  hasClockedIn: boolean; 
  outletStaff: any; 
  recordId: string;
  qc: any;
}) => {
  const toast = useToast();

  const isTicked = !!tick;
  const isMe = tick?.ticked_by === outletStaff?.id;
  const tickerName = tick ? (tick.outlet_staff?.name ?? "Staf") : null;
  const locked = !hasClockedIn;

  const toggleTick = async () => {
    if (!recordId || !outletStaff) return;
    if (!hasClockedIn) {
      toast.show("err", "Absen hadir dulu sebelum mengisi checklist");
      return;
    }

    if (tick && tick.ticked_by !== outletStaff.id) {
      toast.show("err", `Hanya ${tick.outlet_staff?.name || "yang bersangkutan"} yang bisa membatalkan ini`);
      return;
    }

    const previousTicks = qc.getQueryData(["checklist-ticks", recordId]);
    
    // Optimistic Update
    qc.setQueryData(["checklist-ticks", recordId], (old: TickRow[] = []) => {
      if (isTicked) {
        return old.filter(t => t.item_id !== item.id);
      } else {
        const newTick: TickRow = {
          id: "temp-" + Date.now(),
          item_id: item.id,
          ticked_by: outletStaff.id,
          ticked_at: new Date().toISOString(),
          outlet_staff: { name: outletStaff.name }
        };
        return [...old, newTick];
      }
    });

    try {
      const res = await fetch('/api/checklist/toggle', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: isTicked ? 'delete' : 'insert',
          item_id: item.id,
          record_id: recordId,
          staff_id: isTicked ? null : outletStaff.id,
        })
      });
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      const json = await res.json();
      if (json.error) throw new Error(json.error);
    } catch (err: any) {
      const errMsg = err?.message || "Gagal menyimpan progress";
      toast.show("err", errMsg);
      console.error("[toggleTick]", err);
      // Revert optimistic update
      qc.setQueryData(["checklist-ticks", recordId], previousTicks);
    }
  };

  return (
    <button
      disabled={locked}
      onClick={toggleTick}
      className={`w-full flex items-center gap-4 px-3 py-4 rounded-xl my-0.5 text-left transition-all duration-200 ${
        isTicked
          ? "bg-green-50 hover:bg-green-100"
          : "hover:bg-slate-50"
      } ${locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <div className={`flex-shrink-0 transition-all duration-200 ${isTicked ? "text-suka-green" : "text-gray-300 hover:text-suka-orange"}`}>
        {isTicked ? (
          <CheckCircle2 size={24} />
        ) : (
          <Circle size={24} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isTicked ? "line-through text-gray-400" : "text-gray-800"}`}>
          {item.task_name}
        </p>
        {isTicked && tick && (
          <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
            <User size={11} />
            <span className={isMe ? "text-suka-orange font-medium" : ""}>{isMe ? "Kamu" : tickerName}</span>
            · {dayjs(tick.ticked_at).format("HH:mm")}
          </p>
        )}
      </div>
      {item.is_required && !isTicked && (
        <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded border border-red-100 font-medium flex-shrink-0">
          Wajib
        </span>
      )}
    </button>
  );
});
ChecklistItemRow.displayName = "ChecklistItemRow";

const ChecklistCategoryCard = React.memo(({ 
  cat, 
  ticksMap, 
  hasClockedIn, 
  outletStaff, 
  recordId, 
  qc 
}: { 
  cat: ChecklistCategory; 
  ticksMap: Map<string, TickRow>; 
  hasClockedIn: boolean; 
  outletStaff: any; 
  recordId: string;
  qc: any;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const catItems = cat.checklist_items || [];
  const catTickedCount = useMemo(() => {
    return catItems.reduce((acc, item) => acc + (ticksMap.has(item.id) ? 1 : 0), 0);
  }, [catItems, ticksMap]);

  const catDone = catTickedCount === catItems.length && catItems.length > 0;
  const isOpen = !isCollapsed;

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${catDone ? "border-suka-green/40" : "border-suka-gray-200"}`}>
      {/* Category Header */}
      <button
        className={`w-full flex items-center justify-between px-4 sm:px-5 py-4 text-left transition-colors ${catDone ? "bg-green-50" : "bg-suka-gray-50/60 hover:bg-suka-gray-50"}`}
        onClick={() => setIsCollapsed(prev => !prev)}
      >
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full flex-shrink-0 ${catDone ? "bg-suka-green" : "bg-suka-orange"}`} />
          <h2 className={`font-bold text-base ${catDone ? "text-suka-green" : "text-suka-ink"}`}>{cat.name}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catDone ? "bg-green-100 text-suka-green" : "bg-orange-100 text-suka-orange"}`}>
            {catTickedCount}/{catItems.length}
          </span>
        </div>
        {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
      </button>

      {/* Items */}
      {isOpen && (
        <div className="divide-y divide-gray-50 px-2 py-1">
          {catItems.map(item => (
            <ChecklistItemRow
              key={item.id}
              item={item}
              tick={ticksMap.get(item.id)}
              hasClockedIn={hasClockedIn}
              outletStaff={outletStaff}
              recordId={recordId}
              qc={qc}
            />
          ))}
        </div>
      )}
    </div>
  );
});
ChecklistCategoryCard.displayName = "ChecklistCategoryCard";

// --- Main Page Component ---

export default function KruChecklistPage() {
  const { outletStaff } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<"buka" | "tutup">("buka");
  const hasSetInitialTab = useRef(false);

  const [selectedOutletId, setSelectedOutletId] = useState<string>("");

  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff]);

  const today = dayjs().format("YYYY-MM-DD");

  const { data: hasClockedIn = false, isLoading: loadingClockIn } = useQuery({
    queryKey: ["checklist-clockin", outletStaff?.id, today],
    enabled: !!outletStaff?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("attendance")
        .select("type")
        .eq("outlet_staff_id", outletStaff!.id)
        .eq("type", "in")
        .gte("ts_server", `${today}T00:00:00+07:00`)
        .lte("ts_server", `${today}T23:59:59+07:00`)
        .limit(1);
      return (data?.length ?? 0) > 0;
    }
  });

  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ["checklist-categories", selectedOutletId],
    enabled: !!selectedOutletId,
    queryFn: async () => {
      const res = await fetch('/api/checklist/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: selectedOutletId })
      });
      if (!res.ok) throw new Error("Failed to load categories");
      const json = await res.json();
      return (json.data || []) as ChecklistCategory[];
    }
  });

  const { data: recordId, isLoading: loadingRecord } = useQuery({
    queryKey: ["checklist-record", selectedOutletId, today],
    enabled: !!selectedOutletId,
    queryFn: async () => {
      const res = await fetch('/api/checklist/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outlet_id: selectedOutletId, date: today })
      });
      if (!res.ok) throw new Error("Failed to load session");
      const data = await res.json();
      return data.id as string;
    }
  });

  const { data: ticks = [], isLoading: loadingTicks } = useQuery({
    queryKey: ["checklist-ticks", recordId],
    enabled: !!recordId,
    queryFn: async () => {
      const res = await fetch('/api/checklist/ticks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ record_id: recordId })
      });
      if (!res.ok) throw new Error("Failed to load ticks");
      const json = await res.json();
      return (json.data || []) as TickRow[];
    }
  });

  const loading = loadingCategories || loadingClockIn || loadingRecord || loadingTicks;

  // Real-time updates for ticks
  useEffect(() => {
    if (!recordId) return;
    const channelName = `absensi-checklist-ticks-${recordId}-${Math.random().toString(36).substring(2)}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "daily_checklist_ticks", filter: `record_id=eq.${recordId}` },
        async (payload) => {
          let staffName = null;
          if (outletStaff && payload.new.ticked_by === outletStaff.id) {
            staffName = outletStaff.name;
          } else {
            const { data: staffData } = await supabase
              .from("outlet_staff")
              .select("name")
              .eq("id", payload.new.ticked_by)
              .single();
            staffName = staffData?.name;
          }
          qc.setQueryData(["checklist-ticks", recordId], (old: TickRow[] = []) => {
            return [
              ...old.filter(t => t.item_id !== payload.new.item_id),
              { ...payload.new as TickRow, outlet_staff: { name: staffName } }
            ];
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "daily_checklist_ticks", filter: `record_id=eq.${recordId}` },
        (payload) => {
          qc.setQueryData(["checklist-ticks", recordId], (old: TickRow[] = []) => {
            return old.filter(t => t.id !== payload.old.id);
          });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [recordId, qc, supabase, outletStaff?.id, outletStaff?.name]);

  // Memoized data structures for O(1) lookups and derived state
  const ticksMap = useMemo(() => {
    const map = new Map<string, TickRow>();
    for (const t of ticks) {
      map.set(t.item_id, t);
    }
    return map;
  }, [ticks]);

  const { bukaCats, tutupCats, bukaTotalItems, tutupTotalItems } = useMemo(() => {
    const buka = categories.filter(c => c.phase !== "tutup");
    const tutup = categories.filter(c => c.phase === "tutup");
    const bTotal = buka.reduce((acc, c) => acc + (c.checklist_items?.length || 0), 0);
    const tTotal = tutup.reduce((acc, c) => acc + (c.checklist_items?.length || 0), 0);
    return { bukaCats: buka, tutupCats: tutup, bukaTotalItems: bTotal, tutupTotalItems: tTotal };
  }, [categories]);

  const { bukaTickedItems, tutupTickedItems } = useMemo(() => {
    let bTicked = 0;
    for (const c of bukaCats) {
      for (const item of (c.checklist_items || [])) {
        if (ticksMap.has(item.id)) bTicked++;
      }
    }
    let tTicked = 0;
    for (const c of tutupCats) {
      for (const item of (c.checklist_items || [])) {
        if (ticksMap.has(item.id)) tTicked++;
      }
    }
    return { bukaTickedItems: bTicked, tutupTickedItems: tTicked };
  }, [bukaCats, tutupCats, ticksMap]);

  useEffect(() => {
    if (!loading && categories.length > 0 && !hasSetInitialTab.current) {
      const bukaIsComplete = bukaTotalItems > 0 && bukaTickedItems === bukaTotalItems;
      const currentHour = dayjs().hour();
      if (bukaIsComplete || currentHour >= 15) {
        setActiveTab("tutup");
      }
      hasSetInitialTab.current = true;
    }
  }, [loading, categories.length, bukaTotalItems, bukaTickedItems]);

  const activeTotalItems = activeTab === "buka" ? bukaTotalItems : tutupTotalItems;
  const activeTickedItems = activeTab === "buka" ? bukaTickedItems : tutupTickedItems;
  const activeProgress = activeTotalItems > 0 ? Math.round((activeTickedItems / activeTotalItems) * 100) : 0;

  async function handleBulkTick(phase: "buka" | "tutup") {
    if (!recordId || !outletStaff) return;
    if (!hasClockedIn) {
      toast.show("err", "Absen hadir dulu sebelum menggunakan alat testing");
      return;
    }
    if (!confirm(`Centang semua tugas ${phase} toko (hanya untuk testing)?`)) return;

    try {
      const cats = phase === "buka" ? bukaCats : tutupCats;
      const items = cats.flatMap(c => c.checklist_items || []);
      const untickedItems = items.filter(item => !ticksMap.has(item.id));

      await Promise.all(untickedItems.map(item => fetch('/api/checklist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'insert',
          item_id: item.id,
          record_id: recordId!,
          staff_id: outletStaff.id,
        })
      })));

      qc.invalidateQueries({ queryKey: ["checklist-ticks", recordId] });
      toast.show("ok", `Semua tugas ${phase} berhasil dicentang`);
    } catch (e: any) {
      toast.show("err", "Gagal bulk tick: " + e.message);
    }
  }

  async function handleBulkUntick(phase: "buka" | "tutup") {
    if (!recordId || !outletStaff) return;
    if (!confirm(`Hapus centang semua tugas ${phase} toko (hanya untuk testing)?`)) return;

    try {
      const cats = phase === "buka" ? bukaCats : tutupCats;
      const items = cats.flatMap(c => c.checklist_items || []);
      const tickedItems = items.filter(item => ticksMap.has(item.id));

      await Promise.all(tickedItems.map(item => fetch('/api/checklist/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          item_id: item.id,
          record_id: recordId!,
          staff_id: null,
        })
      })));

      qc.invalidateQueries({ queryKey: ["checklist-ticks", recordId] });
      toast.show("ok", `Semua centang ${phase} berhasil dihapus`);
    } catch (e: any) {
      toast.show("err", "Gagal bulk untick: " + e.message);
    }
  }

  if (!selectedOutletId) {
    return (
      <div className="space-y-5 max-w-2xl mx-auto">
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 sm:p-5">
          <div className="mb-4 flex items-center gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-suka-cream text-suka-brown">
              <ListChecks size={20} />
            </span>
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-suka-ink leading-tight">Checklist Operasional</h1>
              <p className="text-sm text-gray-500">{dayjs().format("dddd, D MMMM YYYY")}</p>
            </div>
          </div>
        </div>
        <OutletSwitcher currentOutletId={selectedOutletId} onChange={setSelectedOutletId} />
        <div className="p-6 mt-10">
          <EmptyState 
            icon={<Store size={48} className="text-gray-400" />} 
            title="Cabang Belum Ditentukan" 
            description="Akun Anda belum terhubung dengan cabang manapun. Silakan hubungi admin untuk pengaturan penempatan." 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header + Progress */}
      <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-suka-cream text-suka-brown">
            <ListChecks size={20} />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-suka-ink leading-tight">Checklist Operasional</h1>
            <p className="text-sm text-gray-500">{dayjs().format("dddd, D MMMM YYYY")}</p>
          </div>
        </div>

        <div className="mb-2 flex items-baseline justify-between">
          <span className="text-sm text-gray-500">Progress {activeTab === "buka" ? "Buka Toko" : "Tutup Toko"}</span>
          <span className="text-sm font-semibold text-suka-ink">
            {activeTickedItems}/{activeTotalItems} tugas
            <span className="ml-2 text-2xl font-bold">{activeProgress}<span className="text-sm font-medium text-gray-400">%</span></span>
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-suka-gray-50">
          <div
            className={`h-full rounded-full transition-all duration-700 ease-out ${activeProgress === 100 ? "bg-suka-green" : "bg-suka-orange"}`}
            style={{ width: `${activeProgress}%` }}
          />
        </div>
      </div>
      <OutletSwitcher currentOutletId={selectedOutletId} onChange={setSelectedOutletId} />

      {/* Tabs */}
      {categories.length > 0 && (
        <div className="flex p-1 space-x-1 bg-gray-100/80 rounded-xl border border-gray-200">
          <button
            onClick={() => setActiveTab("buka")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "buka" 
                ? "bg-white text-suka-orange shadow-sm ring-1 ring-black/5" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            }`}
          >
            <Sunrise size={18} />
            Buka Toko
          </button>
          <button
            onClick={() => setActiveTab("tutup")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg transition-all ${
              activeTab === "tutup" 
                ? "bg-white text-indigo-500 shadow-sm ring-1 ring-black/5" 
                : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
            }`}
          >
            <Sunset size={18} />
            Tutup Toko
          </button>
        </div>
      )}

      {/* Gating: belum absen hadir → checklist terkunci */}
      {!hasClockedIn && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <Lock size={20} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Checklist terkunci</p>
            <p className="text-sm text-amber-700">Anda belum absen hadir hari ini. Silakan absen masuk dulu untuk bisa mencentang checklist.</p>
          </div>
        </div>
      )}

      {loadingCategories ? (
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-12 text-center flex flex-col items-center">
          <Spinner size={32} />
          <p className="text-gray-500 font-medium mt-4">Memuat checklist...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-12 text-center">
          <ListChecks size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Belum ada checklist untuk outlet ini</p>
          <p className="text-sm text-gray-400 mt-1">SPV dapat menambahkan daftar tugas dari menu Manajemen Checklist.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === "buka" && (
            <section className="space-y-3 animate-fade-in">
              {bukaCats.length > 0 ? bukaCats.map(cat => (
                <ChecklistCategoryCard 
                  key={cat.id} 
                  cat={cat} 
                  ticksMap={ticksMap} 
                  hasClockedIn={hasClockedIn} 
                  outletStaff={outletStaff} 
                  recordId={recordId!} 
                  qc={qc} 
                />
              )) : (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-500 text-sm">Tidak ada tugas buka toko.</p>
                </div>
              )}
            </section>
          )}

          {activeTab === "tutup" && (
            <section className="space-y-3 animate-fade-in">
              {tutupCats.length > 0 ? tutupCats.map(cat => (
                <ChecklistCategoryCard 
                  key={cat.id} 
                  cat={cat} 
                  ticksMap={ticksMap} 
                  hasClockedIn={hasClockedIn} 
                  outletStaff={outletStaff} 
                  recordId={recordId!} 
                  qc={qc} 
                />
              )) : (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-500 text-sm">Tidak ada tugas tutup toko.</p>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Completion Banner */}
      {activeTotalItems > 0 && activeProgress === 100 && (
        <div className="bg-suka-green text-white rounded-2xl p-6 text-center animate-fade-in">
          <CheckCircle2 size={48} className="mx-auto mb-2" />
          <h2 className="text-xl font-bold">Tugas {activeTab === "buka" ? "Buka Toko" : "Tutup Toko"} Selesai!</h2>
          <p className="opacity-80 mt-1">Tim hebat! Terus pertahankan kinerjamu.</p>
        </div>
      )}

      {/* Alat testing (developer) */}
      <details className="group rounded-2xl border border-suka-gray-200 bg-white">
        <summary className="flex cursor-pointer select-none items-center gap-2 px-4 py-3 text-sm font-medium text-gray-500 [&::-webkit-details-marker]:hidden">
          Alat testing (developer)
          <span className="ml-auto text-gray-400 transition-transform group-open:rotate-180">▾</span>
        </summary>
        <div className="border-t border-suka-gray-200 px-4 py-4 space-y-4">
          <div>
            <p className="mb-2 text-xs font-semibold text-gray-700">Manajemen Checklist</p>
            <p className="mb-2 text-xs text-gray-500">Mengubah progress tab yang sedang aktif.</p>
            <div className="flex flex-col gap-2 sm:flex-row flex-wrap">
              <button onClick={() => handleBulkTick(activeTab)} className="inline-flex items-center justify-center rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-700 hover:bg-green-100 transition-colors">
                Centang Semua ({activeTab === "buka" ? "Buka" : "Tutup"})
              </button>
              <button onClick={() => handleBulkUntick(activeTab)} className="inline-flex items-center justify-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 transition-colors">
                Hapus Centang Semua ({activeTab === "buka" ? "Buka" : "Tutup"})
              </button>
            </div>
          </div>
          
          <div className="pt-2 border-t border-gray-100">
            <p className="mb-2 text-xs font-semibold text-gray-700">Manajemen Absensi & Wajah</p>
            <p className="mb-2 text-xs text-red-600">Awas! Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex flex-col gap-2 sm:flex-row flex-wrap">
              <button onClick={async () => {
                if (!outletStaff || !confirm("Yakin mereset semua wajah staff?")) return;
                const { error } = await supabase.from("outlet_staff")
                  .update({ face_descriptor: null, ref_photo_url: null, enrolled_at: null })
                  .eq("outlet_id", selectedOutletId);
                if (error) toast.show("err", "Gagal reset wajah");
                else toast.show("ok", "Semua wajah berhasil direset (belum terdaftar)");
              }} className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
                Reset Wajah (Un-enroll)
              </button>
              <button onClick={async () => {
                if (!outletStaff || !confirm("Yakin menghapus SEMUA log absensi hari ini?")) return;
                const todayStr = new Date().toISOString().slice(0, 10);
                const { error } = await supabase.from("attendance")
                  .delete()
                  .eq("outlet_id", selectedOutletId)
                  .gte("ts_server", `${todayStr}T00:00:00+07:00`)
                  .lte("ts_server", `${todayStr}T23:59:59+07:00`);
                if (error) toast.show("err", "Gagal reset log absensi. " + error.message);
                else {
                  toast.show("ok", "Log absensi hari ini dihapus. Silakan refresh halaman.");
                  setTimeout(() => window.location.reload(), 1500);
                }
              }} className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors">
                Reset Log Hari Ini
              </button>
            </div>
          </div>
        </div>
      </details>
    </div>
  );
}
