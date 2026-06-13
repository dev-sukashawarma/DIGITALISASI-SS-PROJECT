import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ChecklistManagementPage from "./page";

// Mock dependencies
vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(() => ({
    outletStaff: { outlet_id: "test-outlet-1" }
  }))
}));

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockFrom = vi.fn(() => {
  const chain: any = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete
  };
  mockSelect.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockUpdate.mockResolvedValue({ error: null });
  mockDelete.mockReturnValue(chain); // wait, delete().eq() resolves
  return chain;
});

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom
  }))
}));

const mockToastShow = vi.fn();
vi.mock("@/lib/feedback/toast", () => ({
  useToast: vi.fn(() => ({
    show: mockToastShow
  }))
}));

describe("ChecklistManagementPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should handle missing checklist_items ordering", async () => {
    mockOrder.mockResolvedValueOnce({
      data: [
        {
          id: "cat-1",
          name: "Category 1",
          outlet_id: "test-outlet-1",
          checklist_items: [
            { id: "item-2", task_name: "Item B", is_required: true },
            { id: "item-1", task_name: "Item A", is_required: true },
          ]
        }
      ],
      error: null
    });

    render(<ChecklistManagementPage />);
    
    // Wait for load
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull(); // wait for spinner to go
    });

    // We can't actually verify the order bug visually in RTL without knowing the DOM,
    // but we can assert the load query missing the nested ordering.
    expect(mockSelect).toHaveBeenCalledWith("*, checklist_items(*)");
    expect(mockOrder).toHaveBeenCalledWith("created_at", { ascending: true });
    // It doesn't order checklist_items
  });
});
