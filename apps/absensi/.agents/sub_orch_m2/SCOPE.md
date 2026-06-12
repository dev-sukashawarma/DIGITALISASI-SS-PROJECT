# Scope: M2 (SPV Dashboard)

## Architecture
- Framework: Next.js App Router
- Styling: Tailwind CSS, lucide-react for icons
- Database: Supabase

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M2 | SPV Dashboard | Next.js CRUD UI for SPV to manage checklist templates (categories and items). | M1 | IN_PROGRESS |

## Interface Contracts
- **Pages**: `src/app/spv/checklist/page.tsx` as per `PROJECT.md` (or `src/app/dashboard/checklist/page.tsx` if adapting to existing app structure). The page should display checklist categories and allow adding/editing/deleting them, and doing the same for items within categories.
- **Database Tables**:
  - `checklist_categories` (id, name, outlet_id)
  - `checklist_items` (id, category_id, task_name, required)
- **Supabase Client**: Standard supabase-js client to query/mutate.
- **Access Control**: Should verify user is logged in and belongs to an outlet, and ideally has spv role. The `useAuth` hook from `@/context/AuthContext` provides this.
- **Navigation**: Update `src/app/dashboard/layout.tsx` to add a link to the new Checklist Management page in the SPV's sidebar navigation (`navItems` where `isSPV` is true).

## Requirements
- SPV can create a new category (e.g., "Opening", "Closing").
- SPV can add items to a category (e.g., "Nyalakan lampu depan", "required: true").
- SPV can edit or delete categories and items.
- All actions must be associated with the currently logged-in SPV's `outlet_id`.
