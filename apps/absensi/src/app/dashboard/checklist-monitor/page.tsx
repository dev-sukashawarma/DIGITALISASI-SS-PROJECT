"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@suka/design-system";
import { ClipboardCheck, CheckCircle2, Circle, ChevronDown, ChevronUp, User, RefreshCw, AlertTriangle, Sunrise, Sunset } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { PageHeader } from "@/components/PageHeader";
import dayjs from "dayjs";
import "dayjs/locale/id";

dayjs.locale("id");

type TickRow = {
  id: string;
  item_id: string;
  ticked_by: string;
  ticked_at: string;
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

export default function ChecklistMonitorPage() {
  const { outletStaff } = useAuth();
  const supabaseRef = useRef(createClient());

  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [ticks, setTicks] = useState<TickRow[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"buka" | "tutup">("buka");
  const channelRef = useRef<any>(null);
  const hasSetInitialTab = useRef(false);

  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    if (!outletStaff?.outlet_id) return;
    init();
    return () => {
      const supabase = supabaseRef.current;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [outletStaff?.outlet_id]);

  async function init() {
    setLoading(true);
    const supabase = supabaseRef.current;
    await Promise.all([loadCategories(supabase), loadStaffMap(supabase)]);
    await loadTodayTicks(supabase);
    subscribeRealtime(supabase);
    setLastRefresh(new Date());
    setLoading(false);
  }

  async function loadCategories(supabase: ReturnType<typeof createClient>) {
    const { data } = await supabase
      .from("checklist_categories")
      .select("*, checklist_items(*)")
      .eq("outlet_id", outletStaff!.outlet_id)
      .order("created_at", { ascending: true });
    if (data) setCategories(data);
  }

  async function loadStaffMap(supabase: ReturnType<typeof createClient>) {
    const { data } = await supabase
      .from("outlet_staff")
      .select("id, name")
      .eq("outlet_id", outletStaff!.outlet_id);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s: { id: string; name: string }) => { map[s.id] = s.name; });
      setStaffMap(map);
    }
  }

  async function loadTodayTicks(supabase: ReturnType<typeof createClient>) {
    // Ambil record hari ini dulu
    const { data: record } = await supabase
      .from("daily_checklist_records")
      .select("id")
      .eq("outlet_id", outletStaff!.outlet_id)
      .eq("date", today)
      .maybeSingle();

    if (!record) { setTicks([]); return; }

    const { data } = await supabase
      .from("daily_checklist_ticks")
      .select("id, item_id, ticked_by, ticked_at")
      .eq("record_id", record.id);
    setTicks((data as TickRow[]) || []);
  }

  function subscribeRealtime(supabase: ReturnType<typeof createClient>) {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }
    const ch = supabase
      .channel(`spv-monitor-${outletStaff!.outlet_id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_checklist_ticks" },
        () => {
          // Reload ticks whenever anything changes
          loadTodayTicks(supabase);
          setLastRefresh(new Date());
        }
      )
      .subscribe();
    channelRef.current = ch;
  }

  async function handleRefresh() {
    const supabase = supabaseRef.current;
    await loadTodayTicks(supabase);
    setLastRefresh(new Date());
  }

  const bukaCats = categories.filter(c => c.phase !== "tutup");
  const tutupCats = categories.filter(c => c.phase === "tutup");

  const bukaTotalItems = bukaCats.reduce((acc, c) => acc + (c.checklist_items?.length || 0), 0);
  const bukaTotalRequired = bukaCats.reduce((acc, c) => acc + (c.checklist_items?.filter(i => i.is_required).length || 0), 0);
  const bukaTickedItems = bukaCats.reduce((acc, c) => acc + (c.checklist_items?.filter(item => ticks.some(t => t.item_id === item.id)).length || 0), 0);
  const bukaTickedRequired = bukaCats.reduce((acc, c) => acc + (c.checklist_items?.filter(i => i.is_required && ticks.some(t => t.item_id === i.id)).length || 0), 0);

  const tutupTotalItems = tutupCats.reduce((acc, c) => acc + (c.checklist_items?.length || 0), 0);
  const tutupTotalRequired = tutupCats.reduce((acc, c) => acc + (c.checklist_items?.filter(i => i.is_required).length || 0), 0);
  const tutupTickedItems = tutupCats.reduce((acc, c) => acc + (c.checklist_items?.filter(item => ticks.some(t => t.item_id === item.id)).length || 0), 0);
  const tutupTickedRequired = tutupCats.reduce((acc, c) => acc + (c.checklist_items?.filter(i => i.is_required && ticks.some(t => t.item_id === i.id)).length || 0), 0);

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

  if (loading) return <div className="p-10 flex justify-center"><Spinner /></div>;

  const activeTotalItems = activeTab === "buka" ? bukaTotalItems : tutupTotalItems;
  const activeTotalRequired = activeTab === "buka" ? bukaTotalRequired : tutupTotalRequired;
  const activeTickedItems = activeTab === "buka" ? bukaTickedItems : tutupTickedItems;
  const activeTickedRequired = activeTab === "buka" ? bukaTickedRequired : tutupTickedRequired;
  
  const activeProgress = activeTotalItems > 0 ? Math.round((activeTickedItems / activeTotalItems) * 100) : 0;
  const activeAllRequiredDone = activeTotalRequired > 0 ? activeTickedRequired === activeTotalRequired : true;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<ClipboardCheck size={20} />}
        title="Monitor Checklist"
        subtitle={dayjs().format("dddd, D MMMM YYYY")}
        action={
          <button
            onClick={handleRefresh}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 transition-colors hover:border-suka-orange hover:text-suka-orange sm:w-auto"
          >
            <RefreshCw size={15} /> Refresh
            <span className="text-xs text-gray-400">· {dayjs(lastRefresh).format("HH:mm:ss")}</span>
          </button>
        }
      />

      {/* Ringkasan: progress + angka kunci dalam satu kartu */}
      <div className="rounded-2xl border border-suka-gray-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex items-baseline justify-between">
          <span className="text-sm text-gray-500">Progress {activeTab === "buka" ? "Buka Toko" : "Tutup Toko"}</span>
          <span className="text-2xl font-bold text-suka-ink">
            {activeProgress}<span className="text-sm font-medium text-gray-400">%</span>
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-suka-gray-50">
          <div
            className={`h-full rounded-full transition-all duration-700 ${activeProgress === 100 ? "bg-suka-green" : "bg-suka-orange"}`}
            style={{ width: `${activeProgress}%` }}
          />
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-suka-gray-50 p-3 text-center">
            <p className="text-lg font-bold text-suka-ink">{activeTickedItems}<span className="text-sm font-medium text-gray-400">/{activeTotalItems}</span></p>
            <p className="mt-0.5 text-xs text-gray-500">Tugas selesai</p>
          </div>
          <div className="rounded-xl bg-suka-gray-50 p-3 text-center">
            <p className={`text-lg font-bold ${activeAllRequiredDone ? "text-suka-green" : "text-red-500"}`}>
              {activeTickedRequired}<span className="text-sm font-medium text-gray-400">/{activeTotalRequired}</span>
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Wajib selesai</p>
          </div>
          <div className="rounded-xl bg-suka-gray-50 p-3 text-center">
            <p className={`flex items-center justify-center gap-1 text-sm font-bold leading-7 ${activeAllRequiredDone ? "text-suka-green" : "text-amber-600"}`}>
              {activeAllRequiredDone ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              {activeAllRequiredDone ? (activeTab === "buka" ? "Siap Buka" : "Siap Tutup") : "Belum Siap"}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">Status</p>
          </div>
        </div>
      </div>

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

      {/* Category Detail */}
      {categories.length === 0 ? (
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-12 text-center">
          <ClipboardCheck size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Belum ada template checklist. Buat dulu di menu Manajemen Checklist.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(activeTab === "buka" ? bukaCats : tutupCats).length === 0 ? (
            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
              <p className="text-gray-400 text-sm">Tidak ada tugas {activeTab === "buka" ? "buka" : "tutup"} toko.</p>
            </div>
          ) : (
            (activeTab === "buka" ? bukaCats : tutupCats).map(cat => {
              const catItems = cat.checklist_items || [];
              const catTicked = catItems.filter(item => ticks.some(t => t.item_id === item.id)).length;
              const catDone = catTicked === catItems.length && catItems.length > 0;
              const catRequiredTotal = catItems.filter(i => i.is_required).length;
              const catRequiredDone = catItems.filter(i => i.is_required && ticks.some(t => t.item_id === i.id)).length;
              const isOpen = !collapsed[cat.id];
  
              return (
                <div key={cat.id} className={`overflow-hidden rounded-2xl border bg-white ${catDone ? "border-suka-green/40" : "border-suka-gray-200"}`}>
                  <button
                    className={`flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left transition-colors sm:px-5 ${catDone ? "bg-green-50" : "bg-suka-gray-50/60 hover:bg-suka-gray-50"}`}
                    onClick={() => setCollapsed(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <div className={`h-2.5 w-2.5 flex-shrink-0 rounded-full ${catDone ? "bg-suka-green" : catRequiredDone === catRequiredTotal ? "bg-amber-400" : "bg-suka-orange"}`} />
                      <h2 className={`text-sm font-bold sm:text-base ${catDone ? "text-suka-green" : "text-suka-ink"}`}>{cat.name}</h2>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catDone ? "bg-green-100 text-suka-green" : "bg-orange-100 text-suka-orange"}`}>
                        {catTicked}/{catItems.length} selesai
                      </span>
                      {catRequiredTotal > 0 && (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${catRequiredDone === catRequiredTotal ? "bg-green-100 text-suka-green" : "bg-red-100 text-red-500"}`}>
                          {catRequiredDone}/{catRequiredTotal} wajib
                        </span>
                      )}
                    </div>
                    {isOpen ? <ChevronUp size={18} className="flex-shrink-0 text-gray-400" /> : <ChevronDown size={18} className="flex-shrink-0 text-gray-400" />}
                  </button>
  
                  {isOpen && (
                    <div className="divide-y divide-suka-gray-200/50">
                      {catItems.map(item => {
                        const tick = ticks.find(t => t.item_id === item.id);
                        const isTicked = !!tick;
                        const tickerName = tick ? (staffMap[tick.ticked_by] ?? "Staf") : null;
  
                        return (
                          <div
                            key={item.id}
                            className={`flex items-center gap-3.5 px-4 py-3 sm:px-5 ${isTicked ? "bg-green-50/50" : ""}`}
                          >
                            <div className={`flex-shrink-0 ${isTicked ? "text-suka-green" : "text-gray-200"}`}>
                              {isTicked ? <CheckCircle2 size={22} /> : <Circle size={22} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium ${isTicked ? "text-gray-500 line-through" : "text-gray-800"}`}>
                                {item.task_name}
                              </p>
                              {isTicked && tick && (
                                <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400">
                                  <User size={11} />
                                  <span className="font-medium text-suka-brown">{tickerName}</span>
                                  · {dayjs(tick.ticked_at).format("HH:mm")}
                                </p>
                              )}
                              {!isTicked && (
                                <p className="mt-0.5 text-xs text-gray-400">Belum dikerjakan</p>
                              )}
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              {item.is_required && !isTicked && (
                                <span className="rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                                  Wajib
                                </span>
                              )}
                              {isTicked && (
                                <span className="rounded border border-green-100 bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-suka-green">
                                  ✓ Done
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* All done banner */}
      {activeTotalItems > 0 && activeProgress === 100 && (
        <div className="rounded-2xl bg-suka-green p-6 text-center text-white">
          <CheckCircle2 size={40} className="mx-auto mb-2" />
          <h2 className="text-xl font-bold">Tugas {activeTab === "buka" ? "Buka Toko" : "Tutup Toko"} Selesai!</h2>
          <p className="mt-1 opacity-80">
            {activeTab === "buka" 
              ? "Outlet siap beroperasi penuh." 
              : "Outlet siap untuk ditutup dan kru bisa pulang."}
          </p>
        </div>
      )}
    </div>
  );
}
