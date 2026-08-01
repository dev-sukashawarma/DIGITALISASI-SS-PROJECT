"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, Spinner, EmptyState } from "@suka/design-system";
import { ListChecks, Plus, Edit, Trash2, X as XIcon, Store } from "lucide-react";
import { useAuth } from '@suka/auth';
import { createClient } from "@/lib/supabase";
import { useToast } from "@/lib/feedback/toast";
import { PageHeader } from "@/components/PageHeader";
import { Select } from "@/components/Select";
import { OutletSwitcher } from "@/components/OutletSwitcher";

type ChecklistItem = {
  id: string;
  category_id: string;
  task_name: string;
  is_required: boolean;
};

type Phase = "buka" | "tutup";

type ChecklistCategory = {
  id: string;
  name: string;
  outlet_id: string;
  phase?: Phase | null;
  checklist_items: ChecklistItem[];
};

const PHASE_LABEL: Record<Phase, string> = {
  buka: "Sebelum Buka",
  tutup: "Sebelum Pulang",
};

const GLOBAL_OUTLET_ID = '00000000-0000-0000-0000-000000000000';
const CHECKLIST_KEY = (outletId: string) => ["checklist-management", outletId];

export default function ChecklistManagementPage() {
  const { outletStaff } = useAuth();
  const supabase = createClient();
  const toast = useToast();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<Phase>("buka");

  const [showCatModal, setShowCatModal] = useState(false);
  const [catName, setCatName] = useState("");
  const [catPhase, setCatPhase] = useState<Phase>("buka");
  const [catOutletId, setCatOutletId] = useState<string>("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);

  const [showItemModal, setShowItemModal] = useState(false);
  const [activeCatId, setActiveCatId] = useState<string | null>(null);
  const [itemName, setItemName] = useState("");
  const [itemRequired, setItemRequired] = useState(true);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [selectedOutletId, setSelectedOutletId] = useState<string>("");

  useEffect(() => {
    if (outletStaff?.outlet_id && !selectedOutletId) {
      setSelectedOutletId(outletStaff.outlet_id);
    }
  }, [outletStaff]);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: CHECKLIST_KEY(selectedOutletId),
    enabled: !!selectedOutletId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklist_categories")
        .select("*, checklist_items(*)")
        .in("outlet_id", [selectedOutletId, GLOBAL_OUTLET_ID])
        .order("created_at", { ascending: true });
      if (error) { toast.show("err", "Gagal memuat checklist"); return []; }
      return (data || []) as ChecklistCategory[];
    },
  });

  const { data: outlets = [] } = useQuery({
    queryKey: ["all-outlets"],
    queryFn: async () => {
      const isSpv = outletStaff?.role === 'spv' || outletStaff?.role === 'admin' || outletStaff?.role === 'regional_manager' || outletStaff?.role === 'area_manager';
      let ids: string[] = [];
      if (!isSpv) {
        const { data: rpcData } = await supabase.rpc("accessible_outlet_ids");
        ids = rpcData?.map((r: any) => typeof r === 'string' ? r : r.accessible_outlet_ids) || [];
      }
      
      let query = supabase.from("outlets").select("id, name").neq("id", GLOBAL_OUTLET_ID).order("name");
      if (!isSpv && ids.length > 0) {
        query = query.in("id", ids);
      } else if (!isSpv) {
        return [];
      }
      
      const { data } = await query;
      return data || [];
    }
  });

  function refresh() {
    if (selectedOutletId) qc.invalidateQueries({ queryKey: CHECKLIST_KEY(selectedOutletId) });
  }

  // CATEGORY ACTIONS
  async function handleSaveCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!catName.trim()) return;

    const targetOutletId = catOutletId === "global" ? GLOBAL_OUTLET_ID : catOutletId;

    if (editingCatId) {
      const { error } = await supabase.from("checklist_categories").update({ name: catName, phase: catPhase, outlet_id: targetOutletId }).eq("id", editingCatId);
      if (error) toast.show("err", "Gagal mengupdate kategori");
      else toast.show("ok", "Kategori diupdate");
    } else {
      const { error } = await supabase.from("checklist_categories").insert({ name: catName, phase: catPhase, outlet_id: targetOutletId });
      if (error) toast.show("err", "Gagal membuat kategori");
      else toast.show("ok", "Kategori dibuat");
    }

    setShowCatModal(false); setCatName(""); setCatPhase("buka"); setCatOutletId(selectedOutletId); setEditingCatId(null);
    refresh();
  }

  async function handleDeleteCategory(id: string, name: string) {
    if (!confirm(`Hapus kategori "${name}" beserta semua tugas di dalamnya?`)) return;
    const { error } = await supabase.from("checklist_categories").delete().eq("id", id);
    if (error) toast.show("err", "Gagal menghapus kategori");
    else { toast.show("ok", "Kategori dihapus"); refresh(); }
  }

  // ITEM ACTIONS
  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!itemName.trim() || !activeCatId) return;

    if (editingItemId) {
      const { error } = await supabase.from("checklist_items").update({ task_name: itemName, is_required: itemRequired }).eq("id", editingItemId);
      if (error) toast.show("err", "Gagal mengupdate tugas");
      else toast.show("ok", "Tugas diupdate");
    } else {
      const { error } = await supabase.from("checklist_items").insert({ category_id: activeCatId, task_name: itemName, is_required: itemRequired });
      if (error) toast.show("err", "Gagal membuat tugas");
      else toast.show("ok", "Tugas dibuat");
    }

    setShowItemModal(false); setItemName(""); setItemRequired(true); setEditingItemId(null); setActiveCatId(null);
    refresh();
  }

  async function handleDeleteItem(id: string, name: string) {
    if (!confirm(`Hapus tugas "${name}"?`)) return;
    const { error } = await supabase.from("checklist_items").delete().eq("id", id);
    if (error) toast.show("err", "Gagal menghapus tugas");
    else { toast.show("ok", "Tugas dihapus"); refresh(); }
  }

  const headerAndSwitcher = (
    <>
      <PageHeader
        icon={<ListChecks size={20} />}
        title="Manajemen Checklist"
        subtitle="Kelola kategori dan tugas operasional harian"
        action={
          <Button
            onClick={() => { setCatName(""); setCatPhase("buka"); setEditingCatId(null); setCatOutletId(selectedOutletId); setShowCatModal(true); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl sm:w-auto"
          >
            <Plus size={18} /> Tambah Kategori
          </Button>
        }
      />
      <OutletSwitcher currentOutletId={selectedOutletId} onChange={setSelectedOutletId} />
    </>
  );

  if (!selectedOutletId) {
    return (
      <div className="space-y-5">
        {headerAndSwitcher}
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

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-5">
      {headerAndSwitcher}

      {/* Tabs */}
      <div className="flex p-1 space-x-1 bg-gray-100/80 rounded-xl border border-gray-200 w-full sm:max-w-md">
        <button
          onClick={() => setActiveTab("buka")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "buka" 
              ? "bg-white text-suka-orange shadow-sm ring-1 ring-black/5" 
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
          }`}
        >
          Sebelum Buka
        </button>
        <button
          onClick={() => setActiveTab("tutup")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === "tutup" 
              ? "bg-white text-indigo-500 shadow-sm ring-1 ring-black/5" 
              : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
          }`}
        >
          Sebelum Pulang
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="rounded-2xl border border-suka-gray-200 bg-white p-12 text-center">
          <ListChecks size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="font-medium text-gray-500">Belum ada kategori checklist</p>
          <p className="mt-1 text-sm text-gray-400">Mulai dengan membuat kategori seperti &quot;Persiapan Buka&quot; atau &quot;Kebersihan&quot;.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {categories
            .filter(cat => activeTab === "tutup" ? cat.phase === "tutup" : cat.phase !== "tutup")
            .map(cat => (
            <div key={cat.id} className="overflow-hidden rounded-2xl border border-suka-gray-200 bg-white">
              <div className="flex flex-col gap-2 border-b border-suka-gray-200 bg-suka-gray-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-suka-ink">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cat.phase === "tutup" ? "bg-indigo-500" : "bg-suka-orange"}`} />
                  <span className="truncate">{cat.name}</span>
                  {cat.outlet_id === GLOBAL_OUTLET_ID && (
                    <span className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                      GLOBAL
                    </span>
                  )}
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${cat.phase === "tutup" ? "bg-indigo-50 text-indigo-600" : "bg-orange-50 text-suka-orange"}`}>
                    {PHASE_LABEL[cat.phase === "tutup" ? "tutup" : "buka"]}
                  </span>
                  <span className="shrink-0 text-xs font-normal text-gray-400">
                    {cat.checklist_items?.length || 0} tugas
                  </span>
                </h2>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActiveCatId(cat.id);
                      setItemName("");
                      setItemRequired(true);
                      setEditingItemId(null);
                      setShowItemModal(true);
                    }}
                    className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-suka-orange transition-colors hover:bg-orange-50"
                  >
                    <Plus size={15} /> Tambah Tugas
                  </button>
                  <div className="mx-1 h-5 w-px bg-gray-200" />
                  <button
                    onClick={() => { setCatName(cat.name); setCatPhase(cat.phase === "tutup" ? "tutup" : "buka"); setCatOutletId(cat.outlet_id === GLOBAL_OUTLET_ID ? "global" : cat.outlet_id); setEditingCatId(cat.id); setShowCatModal(true); }}
                    className="rounded-lg p-2 text-blue-500 transition-colors hover:bg-blue-50"
                    title="Edit Kategori"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(cat.id, cat.name)}
                    className="rounded-lg p-2 text-red-500 transition-colors hover:bg-red-50"
                    title="Hapus Kategori"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="p-3 sm:p-4">
                {cat.checklist_items && cat.checklist_items.length > 0 ? (
                  <ul className="divide-y divide-suka-gray-200/50">
                    {cat.checklist_items.map(item => (
                      <li key={item.id} className="group flex items-center justify-between gap-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-suka-gray-50/70">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`h-2 w-2 flex-shrink-0 rounded-full ${item.is_required ? "bg-red-400" : "bg-gray-300"}`} />
                          <span className="truncate text-sm text-gray-800">{item.task_name}</span>
                          {item.is_required && (
                            <span className="shrink-0 rounded border border-red-100 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                              Wajib
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                          <button
                            onClick={() => {
                              setActiveCatId(cat.id);
                              setItemName(item.task_name);
                              setItemRequired(item.is_required);
                              setEditingItemId(item.id);
                              setShowItemModal(true);
                            }}
                            className="rounded-lg p-2 text-blue-500 hover:bg-blue-50" title="Edit Tugas"
                          >
                            <Edit size={15} />
                          </button>
                          <button
                            onClick={() => handleDeleteItem(item.id, item.task_name)}
                            className="rounded-lg p-2 text-red-500 hover:bg-red-50" title="Hapus Tugas"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-center text-sm italic text-gray-400">Belum ada tugas di kategori ini.</p>
                )}
              </div>
            </div>
          ))}
          {categories.filter(cat => activeTab === "tutup" ? cat.phase === "tutup" : cat.phase !== "tutup").length === 0 && (
            <div className="py-12 text-center border-2 border-dashed border-gray-200 rounded-2xl">
              <p className="text-gray-400 text-sm">Tidak ada kategori untuk fase ini.</p>
            </div>
          )}
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-suka-ink">{editingCatId ? "Edit Kategori" : "Kategori Baru"}</h2>
              <button onClick={() => setShowCatModal(false)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"><XIcon size={20} /></button>
            </div>
            <form onSubmit={handleSaveCategory} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Kategori</label>
                <input
                  type="text" required value={catName} onChange={e => setCatName(e.target.value)} autoFocus
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20"
                  placeholder="Contoh: Keamanan & Akses"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Fase</label>
                <Select
                  value={catPhase} onChange={val => setCatPhase(val as Phase)}
                  options={[
                    { label: "Sebelum Buka (setelah absen hadir)", value: "buka" },
                    { label: "Sebelum Pulang (sebelum absen pulang)", value: "tutup" }
                  ]}
                  className="w-full"
                />
                <p className="mt-1 text-xs text-gray-400">Menentukan checklist ini muncul di seksi mana untuk kru.</p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Terapkan Ke</label>
                <Select
                  value={catOutletId} onChange={val => setCatOutletId(val)}
                  options={[
                    { label: "Seluruh Cabang (Global)", value: "global" },
                    ...outlets.map((o: any) => ({ label: o.name, value: o.id }))
                  ]}
                  className="w-full"
                  searchable
                />
                <p className="mt-1 text-xs text-gray-400">Pilih apakah checklist ini hanya berlaku untuk satu outlet tertentu, atau untuk semua outlet.</p>
              </div>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setShowCatModal(false)} className="rounded-xl">Batal</Button>
                <Button type="submit" className="rounded-xl">Simpan</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-bold text-suka-ink">{editingItemId ? "Edit Tugas" : "Tugas Baru"}</h2>
              <button onClick={() => setShowItemModal(false)} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"><XIcon size={20} /></button>
            </div>
            <form onSubmit={handleSaveItem} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Nama Tugas</label>
                <input
                  type="text" required value={itemName} onChange={e => setItemName(e.target.value)} autoFocus
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 outline-none focus:border-suka-orange focus:ring-2 focus:ring-suka-orange/20"
                  placeholder="Contoh: Cek tabung gas LPG"
                />
              </div>
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${itemRequired ? "border-red-200 bg-red-50" : "border-gray-200 bg-white hover:bg-gray-50"}`}>
                <input
                  type="checkbox" checked={itemRequired} onChange={e => setItemRequired(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-red-500"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-800">Tugas Wajib</p>
                  <p className="text-xs text-gray-500">Tugas ini harus diselesaikan sebelum operasional dimulai</p>
                </div>
              </label>
              <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <Button type="button" variant="ghost" onClick={() => setShowItemModal(false)} className="rounded-xl">Batal</Button>
                <Button type="submit" className="rounded-xl">Simpan</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
