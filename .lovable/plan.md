

## Fix: Duplicate Roles in Role Store

### Problem
When the app loads, duplicate "Dungeon Master" and "Player" roles appear in:
- The initial role selection modal
- The token context menu's "Assign to Role" submenu

### Root Cause
The role store has a race condition between:
1. Synchronous call to `initializeDefaultRoles()` at module load
2. Async rehydration from localStorage by the `persist` middleware

This causes default roles to be set twice or merged incorrectly.

### Solution

**File: `src/stores/roleStore.ts`**

1. Remove the synchronous `initializeDefaultRoles()` call at the bottom of the file

2. Move initialization into the `persist` middleware's `onRehydrateStorage` callback, which runs after localStorage data is loaded

3. Add a deduplication check by role `id` to ensure roles are unique

```text
Changes Summary:
┌────────────────────────────────────────────────────────────┐
│  Current Code (lines 220-232)                              │
├────────────────────────────────────────────────────────────┤
│  persist(                                                  │
│    (set, get) => ({ ... }),                                │
│    {                                                       │
│      name: 'vtt-role-storage',                             │
│      partialize: (state) => ({ roles: state.roles }),      │
│    }                                                       │
│  )                                                         │
│                                                            │
│  // Initialize default roles on store creation             │
│  const { initializeDefaultRoles } = useRoleStore.getState()│
│  initializeDefaultRoles();                                 │
└────────────────────────────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│  Fixed Code                                                │
├────────────────────────────────────────────────────────────┤
│  persist(                                                  │
│    (set, get) => ({ ... }),                                │
│    {                                                       │
│      name: 'vtt-role-storage',                             │
│      partialize: (state) => ({ roles: state.roles }),      │
│      onRehydrateStorage: () => (state) => {                │
│        if (state && state.roles.length === 0) {            │
│          state.initializeDefaultRoles();                   │
│        } else if (state) {                                 │
│          // Deduplicate roles by id                        │
│          const seen = new Set();                           │
│          const uniqueRoles = state.roles.filter(role => {  │
│            if (seen.has(role.id)) return false;            │
│            seen.add(role.id);                              │
│            return true;                                    │
│          });                                               │
│          if (uniqueRoles.length !== state.roles.length) {  │
│            useRoleStore.setState({ roles: uniqueRoles });  │
│          }                                                 │
│        }                                                   │
│      },                                                    │
│    }                                                       │
│  )                                                         │
│                                                            │
│  // REMOVED: Synchronous initializeDefaultRoles() call     │
└────────────────────────────────────────────────────────────┘
```

### Technical Details

- **`onRehydrateStorage`**: A Zustand persist callback that runs after localStorage data is loaded
- The callback receives the rehydrated state and can perform post-rehydration logic
- Deduplication uses a `Set` to track seen role IDs and filter out duplicates
- If duplicates are found, the store is updated with the unique roles

### Testing
After implementation:
1. Clear localStorage (or use incognito)
2. Load the app - should see exactly 2 roles (DM + Player)
3. Refresh the page - should still see exactly 2 roles
4. Right-click a token and check "Assign to Role" - no duplicates

