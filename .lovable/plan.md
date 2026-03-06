

## Fix: Jazz CoList Mutation API

**Problem**: Jazz CoLists are Proxy objects that don't allow direct `.push()` or `.splice()`. The correct API is `.$jazz.push()` and `.$jazz.splice()`.

**Root cause**: Three locations in `bridge.ts` use native array methods on Jazz CoLists:
1. Line 145: `jazzTokens.push(jt)` in `pushTokensToJazz`
2. Line 217: `jazzTokens.push(jt)` in `startBridge` (add detection)
3. Line 259: `jazzTokens.splice(i, 1)` in `startBridge` (remove detection)

**Fix**: Replace all three with the Jazz Proxy API:
- `jazzTokens.push(jt)` → `jazzTokens.$jazz.push(jt)`
- `jazzTokens.splice(i, 1)` → `jazzTokens.$jazz.splice(i, 1)`

**Files to edit**:
- `src/lib/jazz/bridge.ts` — 3 line changes
- `src/lib/version.ts` — bump to next patch

