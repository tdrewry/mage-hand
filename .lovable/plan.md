

# Fix: Animated GIF Token Loading Causes Session Reset

## Problem Summary

When loading an animated GIF as a token image, the application sometimes loses context and returns to a "welcome to the session" state. This happens because:

1. Animated GIF base64 data URLs are very large (often several megabytes)
2. The `sessionStore` persists the full `token.imageUrl` to localStorage
3. localStorage has a ~5MB limit
4. When exceeded, a `QuotaExceededError` is thrown
5. The error handler in `updateTokenPosition` clears all localStorage, resetting the session

## Solution

Exclude `imageUrl` from localStorage persistence in `sessionStore.ts`, following the same pattern used by `regionStore` for `backgroundImage`. The `imageHash` field is still persisted, which allows the texture to be reloaded from IndexedDB on next app start.

---

## Technical Details

### File: `src/stores/sessionStore.ts`

**Current persistence (problematic):**
```typescript
partialize: (state) => ({
  tokens: state.tokens,  // Includes large imageUrl data!
  ...
}),
```

**Fixed persistence:**
```typescript
partialize: (state) => ({
  tokens: state.tokens.map(token => ({
    ...token,
    imageUrl: '',  // Exclude from persistence to avoid quota issues
  })),
  ...
}),
```

This ensures:
- `imageHash` is still persisted (small string)
- `useTextureLoader` hook will reload the image from IndexedDB on app start
- localStorage stays within quota

### Secondary Improvement: Safer Error Handling

The current error handling in `updateTokenPosition` clears ALL localStorage when quota is exceeded, which is too aggressive. A better approach:
- Only clear the problematic key if possible
- Don't reset the entire in-memory session state
- Log a warning instead of silently corrupting state

---

## Changes Summary

| File | Change |
|------|--------|
| `src/stores/sessionStore.ts` | Exclude `imageUrl` from persistence via `partialize`; improve quota error handling |

---

## Why This Fixes the Issue

1. Animated GIF data (base64) no longer attempts to persist to localStorage
2. The `imageHash` is still saved, so textures can be reloaded from IndexedDB
3. No more `QuotaExceededError` when adding large token images
4. Session state remains intact even with many/large token textures

---

## Testing Checklist

- [ ] Load an animated GIF as a token image
- [ ] Verify the app doesn't reset to "welcome" state
- [ ] Refresh the page and verify the token image is restored (via IndexedDB/imageHash)
- [ ] Test with multiple animated GIF tokens
- [ ] Verify static PNG/JPEG token images still work correctly

