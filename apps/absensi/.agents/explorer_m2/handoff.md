# M2 (SPV Dashboard) Handoff Report

## 1. Observation
- The SPV navigation menu is defined in `src/app/dashboard/layout.tsx` within the `navItems` array when `isSPV` is true.
- The database schema for checklist templates was successfully migrated in `supabase/migrations/20260611000000_m1_absensi_checklist.sql`.
  - Table `checklist_categories`: `id`, `outlet_id`, `name`, `created_at`, `updated_at`.
  - Table `checklist_items`: `id`, `category_id`, `task_name`, `is_required`, `created_at`, `updated_at`. Note that the requirement flag is named `is_required` (boolean), not `required`.
- RLS policies exist on these tables restricting read/write access based on `auth.uid()` and their `outlet_id` matched via the `outlet_staff` table. SPVs have full access.
- Supabase client is instantiated via `createClient()` from `@/lib/supabase`. 
- Current user info is retrieved via `useAuth()` hook which provides `outletStaff` (including `outletStaff.outlet_id`).
- There are no extensive reusable UI components (e.g., shadcn). Standard Tailwind CSS classes are used for UI construction.

## 2. Logic Chain
1. **Routing**: Create the new CRUD interface at `src/app/dashboard/checklist/page.tsx` since `src/app/dashboard/*` is the SPV route structure.
2. **Navigation**: Modify `src/app/dashboard/layout.tsx` to include the new page in the SPV's sidebar navigation. Add an import for a suitable icon (e.g., `ListTodo` from `lucide-react`) and insert it into `navItems`.
3. **Data Fetching**: The page should use `const supabase = createClient()` and fetch nested data using `supabase.from('checklist_categories').select('*, checklist_items(*)')`.
4. **Mutations**: 
   - **Create Category**: Insert `{ outlet_id: outletStaff.outlet_id, name }` into `checklist_categories`.
   - **Create Item**: Insert `{ category_id, task_name, is_required }` into `checklist_items`.
   - **Update/Delete**: Update or delete rows using their `id`. Because of ON DELETE CASCADE, deleting a category removes its items.
5. **UI Structure**: A client-side React component (`"use client"`) that displays a list of categories. Each category acts as a card/section containing its items. Modals, inline edits, or simple prompt inputs can be used for the CRUD actions, styled with Tailwind CSS to match the existing SukaAbsen theme (e.g., `suka-orange`, `suka-brown`).

## 3. Caveats
- `checklist_items.is_required` is a boolean. Ensure the item creation/edit form includes a checkbox or toggle for "Wajib".
- RLS handles security, so no extra server-side validation is strictly needed, but the UI should gracefully handle Supabase errors (e.g., foreign key violations, RLS rejections).
- The implementer must check if `outletStaff` is loaded before querying or mutating data.

## 4. Conclusion
The environment and schema are fully prepared for M2 implementation. The next step is to assign an implementer to write the SPV Checklist page and update the dashboard layout.

## 5. Verification Method
1. Log in as an SPV.
2. Navigate to `/dashboard/checklist`.
3. Perform full CRUD operations:
   - Create a category "Opening".
   - Create an item "Nyalakan Lampu" under "Opening".
   - Edit the item to make it not required.
   - Delete the category.
4. Verify all actions reflect instantly on the UI and persist in the database.
