# Chat UI & Menu Buttons Plan

## Completed (v0.6.87)

### 1. Chat Store (`src/stores/chatStore.ts`)
- Zustand store with `ChatEntry` union type: `ChatMessage | ChatActionEntry`
- `addMessage()` for text chat, `addActionEntry()` for action history cards
- 200-entry rolling buffer

### 2. Chat Card UI (`src/components/cards/ChatCard.tsx`)
- Chat message bubbles (self vs others styling)
- Action history cards inline in chat log (shows source, targets, resolutions, damage)
- Typing indicator powered by `useMiscEphemeralStore.chatTyping`
- Input field calls `emitChatTyping()` on keypress for ephemeral typing indicators
- Auto-scroll on new entries

### 3. CardType & Registration
- Added `CardType.CHAT` to `cardTypes.ts`
- Added default config in `cardStore.ts`
- Registered render case in `CardManager.tsx`

### 4. Menu Buttons (`MenuCard.tsx`)
- "Quick Access" section at top of menu
- **Chat** button — visible to all players
- **Actions** button — gated behind `canControlUiMode` (DM-only)

### 5. Action → Chat Integration
- `actionStore` subscription auto-feeds new `ActionHistoryEntry` items into `chatStore`
