# Token Group ID Hydration Fix Plan

## Problem
Imported sessions/scenario state were re-creating token groups with new IDs. Campaign encounter nodes still referenced old `customData.tokenGroupId`, so **Token Group (optional)** appeared empty after import.

## Fix
1. Add a shared token-group normalization helper in `tokenGroupStore`.
2. Preserve imported token group IDs (instead of calling `addGroup()` during hydration).
3. Reuse the same helper in both:
   - `sessionIO.applyProjectData` (`.mhsession` import path)
   - `DurableObjectRegistry` tokenGroups hydrator (`.mhdo` import path)

## Expected Result
Scenario nodes keep valid `customData.tokenGroupId` references after import, so token-group selections remain visible and functional.
