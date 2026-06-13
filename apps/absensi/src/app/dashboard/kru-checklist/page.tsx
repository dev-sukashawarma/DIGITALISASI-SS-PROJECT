"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@suka/design-system";
import { ListChecks, CheckCircle2, Circle, ChevronDown, ChevronUp, User, Lock, Sunrise, Sunset } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";
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

export default function KruChecklistPage() {
  const { outletStaff } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState<ChecklistCategory[]>([]);
  const [ticks, setTicks] = useState<TickRow[]>([]);
  const [staffMap, setStaffMap] = useState<Record<string, string>>({}); // id -> name
  const [recordId, setRecordId] = useState<string | null>(null);
  const [hasClockedIn, setHasClockedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [ticking, setTicking] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"buka" | "tutup">("buka");
  const supabaseRef = useRef(createClient());
  const channelRef = useRef<any>(null);
  const subscribedRef = useRef(false);
  const hasSetInitialTab = useRef(false);

  const today = dayjs().format("YYYY-MM-DD");

  useEffect(() => {
    if (!outletStaff?.outlet_id) return;
    subscribedRef.current = false;
    init();
    return () => {
      subscribedRef.current = false;
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
    await Promise.all([
      loadCategories(supabase),
      loadStaffMap(supabase),
      loadClockInStatus(supabase),
    ]);
    const rid = await ensureRecord(supabase);
    if (rid) {
      await loadTicks(supabase, rid);
      subscribeRealtime(rid);
    }
    setLoading(false);
  }

  // Cek apakah staf yang login sudah absen hadir (type "in") hari ini.
  // Gating: belum absen hadir → tidak boleh mencentang checklist.
  async function loadClockInStatus(supabase: ReturnType<typeof createClient>) {
    if (!outletStaff?.id) return;
    const utcToday = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("attendance")
      .select("type")
      .eq("outlet_staff_id", outletStaff.id)
      .eq("type", "in")
      .gte("ts_server", `${utcToday}T00:00:00`)
      .lte("ts_server", `${utcToday}T23:59:59`)
      .limit(1);
    setHasClockedIn((data?.length ?? 0) > 0);
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

  async function loadCategories(supabase: ReturnType<typeof createClient>) {
    const { data, error } = await supabase
      .from("checklist_categories")
      .select("*, checklist_items(*)")
      .eq("outlet_id", outletStaff!.outlet_id)
      .order("created_at", { ascending: true });
    if (!error && data) setCategories(data);
  }

  async function ensureRecord(supabase: ReturnType<typeof createClient>): Promise<string | null> {
    // Upsert record harian — aman jika sudah ada (tidak throw error duplikat)
    const { data: upserted, error } = await supabase
      .from("daily_checklist_records")
      .upsert(
        { outlet_id: outletStaff!.outlet_id, date: today },
        { onConflict: "outlet_id,date", ignoreDuplicates: false }
      )
      .select("id")
      .single();

    if (error || !upserted) {
      // Fallback: coba ambil yang sudah ada
      const { data: fallback } = await supabase
        .from("daily_checklist_records")
        .select("id")
        .eq("outlet_id", outletStaff!.outlet_id)
        .eq("date", today)
        .single();
      if (fallback) { setRecordId(fallback.id); return fallback.id; }
      toast.show("err", "Gagal membuat sesi checklist hari ini");
      return null;
    }
    setRecordId(upserted.id);
    return upserted.id;
  }

  async function loadTicks(supabase: ReturnType<typeof createClient>, rid: string) {
    const { data } = await supabase
      .from("daily_checklist_ticks")
      .select("id, item_id, ticked_by, ticked_at, outlet_staff(name)")
      .eq("record_id", rid);
    setTicks((data as unknown as TickRow[]) || []);
  }

  function subscribeRealtime(rid: string) {
    // Guard: jangan subscribe ganda (React StrictMode memanggil effect 2x)
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    const supabase = supabaseRef.current;
    // Gunakan nama channel unik dengan timestamp agar tidak konflik
    const channelName = `checklist-ticks-${rid}-${Date.now()}`;
    const ch = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "daily_checklist_ticks", filter: `record_id=eq.${rid}` },
        async (payload: { new: Record<string, unknown> }) => {
          const { data: staffData } = await supabase
            .from("outlet_staff")
            .select("name")
            .eq("id", payload.new.ticked_by)
            .single();
          setTicks(prev => [
            ...prev.filter(t => t.item_id !== payload.new.item_id),
            { ...payload.new as TickRow, outlet_staff: staffData }
          ]);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "daily_checklist_ticks", filter: `record_id=eq.${rid}` },
        (payload: { old: Record<string, unknown> }) => {
          setTicks(prev => prev.filter(t => t.id !== payload.old.id));
        }
      )
      .subscribe();
    channelRef.current = ch;
  }

  async function toggleTick(itemId: string) {
    if (!recordId || !outletStaff) return;
    if (!hasClockedIn) {
      toast.show("err", "Absen hadir dulu sebelum mengisi checklist");
      return;
    }
    setTicking(itemId);
    const supabase = supabaseRef.current;

    const existing = ticks.find(t => t.item_id === itemId);
    if (existing) {
      // Un-tick — hanya bisa dibatalkan oleh yang mencentang
      if (existing.ticked_by !== outletStaff.id) {
        toast.show("err", `Hanya ${existing.outlet_staff?.name || "yang bersangkutan"} yang bisa membatalkan ini`);
        setTicking(null);
        return;
      }
      const { error } = await supabase
        .from("daily_checklist_ticks")
        .delete()
        .eq("id", existing.id);
      if (error) toast.show("err", "Gagal membatalkan centang");
      else setTicks(prev => prev.filter(t => t.id !== existing.id));
    } else {
      // Tick
      const { data, error } = await supabase
        .from("daily_checklist_ticks")
        .insert({ record_id: recordId, item_id: itemId, ticked_by: outletStaff.id })
        .select("id, item_id, ticked_by, ticked_at")
        .single();
      if (error) toast.show("err", "Gagal mencentang tugas");
      else setTicks(prev => [...prev, { ...data, outlet_staff: { name: outletStaff.name } }]);
    }
    setTicking(null);
  }

  const bukaCats = categories.filter(c => c.phase !== "tutup");
  const tutupCats = categories.filter(c => c.phase === "tutup");

  const bukaTotalItems = bukaCats.reduce((acc, c) => acc + (c.checklist_items?.length || 0), 0);
  const bukaTickedItems = bukaCats.reduce((acc, c) => acc + (c.checklist_items?.filter(item => ticks.some(t => t.item_id === item.id)).length || 0), 0);

  const tutupTotalItems = tutupCats.reduce((acc, c) => acc + (c.checklist_items?.length || 0), 0);
  const tutupTickedItems = tutupCats.reduce((acc, c) => acc + (c.checklist_items?.filter(item => ticks.some(t => t.item_id === item.id)).length || 0), 0);

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
  const activeTickedItems = activeTab === "buka" ? bukaTickedItems : tutupTickedItems;
  const activeProgress = activeTotalItems > 0 ? Math.round((activeTickedItems / activeTotalItems) * 100) : 0;

  const renderCategory = (cat: ChecklistCategory) => {
    const catItems = cat.checklist_items || [];
    const catTicked = catItems.filter(item => ticks.some(t => t.item_id === item.id)).length;
    const catDone = catTicked === catItems.length && catItems.length > 0;
    const isOpen = !collapsed[cat.id];

    return (
      <div key={cat.id} className={`overflow-hidden rounded-2xl border bg-white transition-all duration-300 ${catDone ? "border-suka-green/40" : "border-suka-gray-200"}`}>
        {/* Category Header */}
        <button
          className={`w-full flex items-center justify-between px-4 sm:px-5 py-4 text-left transition-colors ${catDone ? "bg-green-50" : "bg-suka-gray-50/60 hover:bg-suka-gray-50"}`}
          onClick={() => setCollapsed(prev => ({ ...prev, [cat.id]: !prev[cat.id] }))}
        >
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${catDone ? "bg-suka-green" : "bg-suka-orange"}`} />
            <h2 className={`font-bold text-base ${catDone ? "text-suka-green" : "text-suka-ink"}`}>{cat.name}</h2>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${catDone ? "bg-green-100 text-suka-green" : "bg-orange-100 text-suka-orange"}`}>
              {catTicked}/{catItems.length}
            </span>
          </div>
          {isOpen ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </button>

        {/* Items */}
        {isOpen && (
          <div className="divide-y divide-gray-50 px-2 py-1">
            {catItems.map(item => {
              const tick = ticks.find(t => t.item_id === item.id);
              const isTicked = !!tick;
              const isMe = tick?.ticked_by === outletStaff?.id;
              // Ambil nama dari staffMap (lebih reliable dari join RLS)
              const tickerName = tick ? (staffMap[tick.ticked_by] ?? tick.outlet_staff?.name ?? "Staf") : null;
              const isProcessing = ticking === item.id;
              const locked = !hasClockedIn;

              return (
                <button
                  key={item.id}
                  disabled={isProcessing || locked}
                  onClick={() => toggleTick(item.id)}
                  className={`w-full flex items-center gap-4 px-3 py-4 rounded-xl my-0.5 text-left transition-all duration-200 ${
                    isTicked
                      ? "bg-green-50 hover:bg-green-100"
                      : "hover:bg-slate-50"
                  } ${isProcessing ? "opacity-50 cursor-wait" : locked ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <div className={`flex-shrink-0 transition-all duration-200 ${isTicked ? "text-suka-green" : "text-gray-300 hover:text-suka-orange"}`}>
                    {isProcessing ? (
                      <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : isTicked ? (
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
            })}
          </div>
        )}
      </div>
    );
  };

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

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-12 text-center">
          <ListChecks size={48} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">Belum ada checklist untuk outlet ini</p>
          <p className="text-sm text-gray-400 mt-1">SPV dapat menambahkan daftar tugas dari menu Manajemen Checklist.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeTab === "buka" && (
            <section className="space-y-3 animate-fade-in">
              {bukaCats.length > 0 ? bukaCats.map(renderCategory) : (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                  <p className="text-gray-500 text-sm">Tidak ada tugas buka toko.</p>
                </div>
              )}
            </section>
          )}

          {activeTab === "tutup" && (
            <section className="space-y-3 animate-fade-in">
              {tutupCats.length > 0 ? tutupCats.map(renderCategory) : (
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
    </div>
  );
}
