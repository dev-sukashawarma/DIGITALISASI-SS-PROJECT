import { describe, it, expect } from "vitest";

describe("Checklist Role Access - HR (admin_hr)", () => {
  const isAllOutletRole = (role?: string) =>
    ['spv', 'admin', 'admin_hr', 'owner', 'regional_manager', 'area_manager'].includes(role || '');

  const shouldHaveIsiChecklist = (role?: string) => {
    if (role === 'admin_hr') return false;
    return true;
  };

  const isWajibTutupOutlet = (role?: string, diKantorPusat = false) => {
    if (diKantorPusat) return false;
    if (role === 'admin_hr') return false;
    return true;
  };

  it("HR (admin_hr) memiliki akses melihat semua outlet di OutletSwitcher", () => {
    expect(isAllOutletRole("admin_hr")).toBe(true);
    expect(isAllOutletRole("admin")).toBe(true);
    expect(isAllOutletRole("regional_manager")).toBe(true);
    expect(isAllOutletRole("crew")).toBe(false);
  });

  it("HR (admin_hr) tidak memiliki menu Isi Checklist harian", () => {
    expect(shouldHaveIsiChecklist("admin_hr")).toBe(false);
    expect(shouldHaveIsiChecklist("crew")).toBe(true);
    expect(shouldHaveIsiChecklist("leader")).toBe(true);
  });

  it("HR (admin_hr) dibebaskan dari kewajiban menunggu checklist penutupan outlet saat absen pulang", () => {
    expect(isWajibTutupOutlet("admin_hr", false)).toBe(false);
    expect(isWajibTutupOutlet("crew", false)).toBe(true);
    expect(isWajibTutupOutlet("crew", true)).toBe(false);
  });
});
