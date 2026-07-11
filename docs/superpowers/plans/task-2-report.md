Task 2 Implementation Report

Implemented the UI updates in `ApprovalModal.tsx` as specified in the plan.
- Added state for `crosscheckData` and `isFetchingCrosscheck`
- Used `fetchCrosscheckStok` to fetch data on component mount
- Added inline warnings and global warnings based on the fetched data
- Replaced the stock indicators with real-time stock limits
- Note: Subagent encountered permission timeout when saving the full report, but the implementation was committed perfectly (commit `4c39ff87`).
