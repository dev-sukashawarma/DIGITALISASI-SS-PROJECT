// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import ChecklistManagementPage from "./page";

// Mock dependencies
vi.mock("@suka/auth", () => ({
  useAuth: vi.fn(() => ({
    outletStaff: { outlet_id: "test-outlet-1" }
  }))
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
    useQuery: vi.fn((options: any) => {
      if (options?.queryFn) options.queryFn();
      return { data: [], isLoading: false };
    }),
  };
});

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockNeq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

const mockFrom = vi.fn(() => {
  const chain: any = {
    select: mockSelect,
    eq: mockEq,
    in: mockIn,
    neq: mockNeq,
    order: mockOrder,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
  };
  mockSelect.mockReturnValue(chain);
  mockEq.mockReturnValue(chain);
  mockIn.mockReturnValue(chain);
  mockNeq.mockReturnValue(chain);
  mockOrder.mockResolvedValue({ data: [], error: null });
  mockInsert.mockResolvedValue({ error: null });
  mockUpdate.mockResolvedValue({ error: null });
  mockDelete.mockReturnValue(chain);
  return chain;
});

vi.mock("@/lib/supabase", () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
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
