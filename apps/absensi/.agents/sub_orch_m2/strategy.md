## Synthesized Implementation Strategy for M2 (SPV Dashboard)

### Consensus
Both Explorers agree that:
1. **Route & Navigation**: The SPV dashboard is situated at `/dashboard`, governed by `src/app/dashboard/layout.tsx`. A new link (e.g. `/dashboard/checklist`) should be added to the `navItems` array for `isSPV`.
2. **Page Component**: The CRUD UI must be created at `src/app/dashboard/checklist/page.tsx` as a Next.js Client Component.
3. **Database Schema**: 
   - `checklist_categories` (`id`, `name`, `outlet_id`)
   - `checklist_items` (`id`, `category_id`, `task_name`, `is_required`) -> *Note: Use `is_required` boolean instead of `required`*.
   - Read data using `supabase.from('checklist_categories').select('*, checklist_items(*)')`.
   - When creating a category, ensure `outlet_id: outletStaff.outlet_id`.
4. **UI Details**: Since `@suka/design-system` lacks a robust Modal component, build custom Tailwind CSS overlays/modals using `fixed inset-0` and existing `Card`/`Button`/`Input` components.

### Gaps
None. The database and RLS policies are fully prepared by M1.

### Action Plan
1. Edit `src/app/dashboard/layout.tsx`.
2. Create `src/app/dashboard/checklist/page.tsx`.
3. Verify build and run.
