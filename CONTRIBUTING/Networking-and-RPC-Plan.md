What has been built
-------------------

Implemented comprehensive RPC functionality with UI mode control and initiative syncing across all clients.

What was added:

1.  UI Mode Store (src/stores/uiModeStore.ts): Manages DM/Play mode with local and remote control
2.  RPC Event Types: Added SetUiModePayload, OpenCardPayload, and SyncInitiativeOrderPayload to handle commands
3.  RPC Methods in SyncManager:
    -   rpcSetUiMode(): Broadcast UI mode to all players
    -   rpcOpenCard(): Remotely open cards for players
    -   rpcSyncInitiativeOrder(): Sync full initiative order
4.  RPC Event Handlers: Process incoming UI mode changes, card opens, and initiative syncs with message ID tracking
5.  Menu Card UI: Added UI mode toggle that broadcasts to all players when DM changes it

How it works:

-   DMs with proper permissions can change UI mode and it broadcasts to all connected players
-   Players see a "Locked by DM" badge when mode is set remotely
-   All RPC commands use the same message ID deduplication system
-   Initiative order changes sync to all clients without triggering re-sync loops

Current Architecture Overview
-----------------------------

Your multiplayer system uses a unidirectional sync pattern:

1.  Client → Server: Local actions emit events via syncManager → socketClient
2.  Server → Clients: Server broadcasts to other clients
3.  Clients receive: Handlers update local state without re-triggering sync

The key anti-pattern you're fighting is sync loops where:

-   Local action → emit to server
-   Server broadcasts back → client receives own update → emits again → infinite loop

🔍 Debugging Token & Region Sync Issues
---------------------------------------

### Files to Examine:

1\. Event Emission (Client → Server):

-   src/stores/sessionStore.ts - Token operations (lines 85-220)
-   src/stores/regionStore.ts - Region operations (lines 57-100)
-   src/lib/syncManager.ts - Actual socket emit calls (lines 613-657 for tokens, 848+ for regions)

2\. Event Reception (Server → Client):

-   src/lib/syncManager.ts:
    -   handleTokenUpdated (lines 299-345)
    -   handleRegionUpdated (lines 488-523)

3\. Canvas Rendering:

-   src/components/SimpleTabletop.tsx - The useEffect hooks that trigger redrawCanvas() on state changes

### Current Sync Pattern (Correct Pattern):

`// In Store (e.g., sessionStore, regionStore):  addToken(token)  {    const newToken =  {  ...token, id: token.id  ||  generateId()  };     // Update local state    set(state =>  ({ tokens:  [...state.tokens, newToken]  }));     // Only sync if no ID provided (local creation)    if  (!token.id)  {   syncManager.syncTokenAdd(newToken);    }  }    // In SyncManager handler:  handleTokenUpdated(data)  {    const currentUserId =  getCurrentUserId();     // CRITICAL: Ignore own updates    if  (data.userId  === currentUserId)  return;     // Apply remote update DIRECTLY to state   sessionStore.setTokens([...tokens, data.token]);    // DO NOT call sessionStore.addToken() - it would re-sync!  }`

### 🐛 Debugging Checklist:

1.  Check userId filtering: Search for data.userId === currentUserId - ensure all handlers have this check
2.  Look for dual code paths: Some handlers might call store methods that re-trigger sync
3.  Console log tracking: Add console.log with unique emojis to trace event flow:

    `console.log('🎯 LOCAL: Adding token', tokenId);  console.log('📡 EMIT: sync_token', payload);  console.log('📥 RECEIVE: token_updated', data);  console.log('✅ APPLIED: Token state updated');`

🚀 Adding RPC Functionality
---------------------------

RPC (Remote Procedure Call) is different from state sync - it's for commands rather than state updates.

### Files Involved:

1.  Event Definitions: src/types/multiplayerEvents.ts
2.  Socket Client: src/lib/socketClient.ts (no changes needed)
3.  Sync Manager: src/lib/syncManager.ts
4.  UI Mode Store: Create src/stores/uiModeStore.ts (new)
5.  Initiative Store: src/stores/initiativeStore.ts (already has sync)

### RPC Pattern vs State Sync:

`// STATE SYNC (what you have now):  // - Broadcasts state changes  // - All clients apply the same state  // Example: Token position, initiative order    // RPC (what you need):  // - Commands directed at specific users or all users  // - Clients react to commands, not state  // Example: "Switch to play mode", "Open this card"`

### Implementation Plan:

Phase 1: Debug Current Sync Issues
----------------------------------

### 1.1 Add Comprehensive Logging

File: src/lib/syncManager.ts

In handleTokenUpdated and handleRegionUpdated, add detailed logging:

`private  handleTokenUpdated(data:  SyncTokenPayload):  void  {    const currentUserId = useMultiplayerStore.getState().currentUserId;     console.log('📥 TOKEN EVENT:',  {   action: data.action,   fromUser: data.userId,   currentUser: currentUserId,   willIgnore: data.userId  === currentUserId   });     if  (data.userId  === currentUserId)  {    console.log('⏭️ IGNORING: Own token update');    return;    }     // ... rest of handler  }`

### 1.2 Verify Store Methods Don't Re-Sync

Files: src/stores/sessionStore.ts, src/stores/regionStore.ts

Check all update methods - they should ONLY call syncManager.sync* if the change originated locally:

-   addToken: Only sync if !token.id ✓ (already correct)
-   updateTokenPosition: Should ONLY be called by drag interactions, not by sync handlers
-   addRegion: Only sync if !regionData.id ✓ (already correct)
-   updateRegion: Check if this is being called by sync handler with sync data

Key pattern: Handlers should use setRegions() or setTokens() which bypass the sync logic.

### 1.3 Fix Region Sync

File: src/components/RegionControlPanel.tsx or wherever regions are created

Find where addRegion is called. Ensure it's called WITHOUT an id for new local regions:

`// Local creation (should sync):  regionStore.addRegion({   x, y, width, height,    // No 'id' field - let store generate it and sync  });    // Remote sync (should NOT re-sync):  regionStore.addRegion({   id: receivedId,  // Has ID - store will skip sync   x, y, width, height,  });`

Check the debug logs to see if addRegion is being called with or without an ID.

* * * * *

Phase 2: Add RPC Infrastructure
-------------------------------

### 2.1 Define RPC Event Types

File: src/types/multiplayerEvents.ts

Add new RPC-specific payloads:

`// ============= RPC Events (Commands, not state) =============    export  interface  SetUiModePayload  {   mode:  'dm'  |  'play';   targetUserId?:  string;  // If undefined, broadcast to all   timestamp:  number;   senderId:  string;  }    export  interface  OpenCardPayload  {   cardType:  string;   targetUserId?:  string;   timestamp:  number;   senderId:  string;  }    // Update ClientEvents:  export  const  ClientEvents  =  {    // ... existing events    RPC_SET_UI_MODE:  'rpc_set_ui_mode',    RPC_OPEN_CARD:  'rpc_open_card',  }  as  const;    // Update ServerEvents:  export  const  ServerEvents  =  {    // ... existing events    UI_MODE_CHANGED:  'ui_mode_changed',    CARD_OPENED:  'card_opened',  }  as  const;`

### 2.2 Create UI Mode Store

File: src/stores/uiModeStore.ts (NEW)

`import  { create }  from  'zustand';  import  { persist }  from  'zustand/middleware';    export  type  UiMode  =  'dm'  |  'play';    interface  UiModeState  {   currentMode:  UiMode;   lockedByDm:  boolean;  // If DM has locked the mode remotely     setMode:  (mode:  UiMode)  =>  void;    setModeFromRemote:  (mode:  UiMode, locked:  boolean)  =>  void;  }    export  const useUiModeStore =  create<UiModeState>()(    persist(    (set)  =>  ({   currentMode:  'dm',   lockedByDm:  false,     setMode:  (mode)  =>  {    set({ currentMode: mode, lockedByDm:  false  });    },     setModeFromRemote:  (mode, locked)  =>  {    console.log('🎮 UI Mode changed remotely:', mode,  'locked:', locked);    set({ currentMode: mode, lockedByDm: locked });    },    }),    {   name:  'vtt-ui-mode-storage',    }    )  );`

### 2.3 Add RPC Methods to SyncManager

File: src/lib/syncManager.ts

Add RPC emission methods (around line 850, after existing sync methods):

`// ============= RPC Methods (Commands) =============    /**  * Send UI mode change command * @param  mode - The UI mode to set  * @param  targetUserId - Specific user or undefined for all  */  rpcSetUiMode(mode:  'dm'  |  'play', targetUserId?:  string):  void  {    if  (!this.canSync())  return;     const payload:  SetUiModePayload  =  {   mode,   targetUserId,   timestamp:  Date.now(),   senderId: useMultiplayerStore.getState().currentUserId  ||  ''    };     console.log('📤 RPC: Set UI mode', payload);    this.socketClient?.emit('rpc_set_ui_mode', payload);  }    /**  * Send card open command */  rpcOpenCard(cardType:  string, targetUserId?:  string):  void  {    if  (!this.canSync())  return;     const payload:  OpenCardPayload  =  {   cardType,   targetUserId,   timestamp:  Date.now(),   senderId: useMultiplayerStore.getState().currentUserId  ||  ''    };     console.log('📤 RPC: Open card', payload);    this.socketClient?.emit('rpc_open_card', payload);  }`

### 2.4 Add RPC Event Handlers

File: src/lib/syncManager.ts

In setupEventHandlers() (around line 160), add:

`// RPC events  this.socketClient.on<SetUiModePayload>('ui_mode_changed',  this.handleUiModeChanged.bind(this));  this.socketClient.on<OpenCardPayload>('card_opened',  this.handleCardOpened.bind(this));`

Then add the handler methods (around line 580, after other handlers):

`private  handleUiModeChanged(data:  SetUiModePayload):  void  {    const currentUserId = useMultiplayerStore.getState().currentUserId;     // Check if this command is for us    if  (data.targetUserId  && data.targetUserId  !== currentUserId)  {    console.log('⏭️ UI mode command not for us');    return;    }     // Ignore our own commands (we already changed mode locally)    if  (data.senderId  === currentUserId)  {    console.log('⏭️ IGNORING: Own UI mode command');    return;    }     console.log('🎮 Received UI mode change:', data.mode);     // Apply the mode change    const uiModeStore = useUiModeStore.getState();    const isDmCommand = data.senderId  !== currentUserId;   uiModeStore.setModeFromRemote(data.mode, isDmCommand);  }    private  handleCardOpened(data:  OpenCardPayload):  void  {    const currentUserId = useMultiplayerStore.getState().currentUserId;     if  (data.targetUserId  && data.targetUserId  !== currentUserId)  {    return;    }     if  (data.senderId  === currentUserId)  {    return;    }     console.log('🎴 Received card open command:', data.cardType);     // Open the card    const cardStore = useCardStore.getState();    const card = cardStore.getCardByType(data.cardType  as  any);    if  (card)  {   cardStore.setVisibility(card.id,  true);   cardStore.bringToFront(card.id);    }  }`

* * * * *

Phase 3: Integrate RPC into UI
------------------------------

### 3.1 Add UI Mode Toggle

File: src/components/cards/MenuCard.tsx (or wherever your main menu is)

`import  { useUiModeStore }  from  '@/stores/uiModeStore';  import  { syncManager }  from  '@/lib/syncManager';    // In component:  const  { currentMode, lockedByDm, setMode }  =  useUiModeStore();    const handleModeChange =  (newMode:  'dm'  |  'play')  =>  {    // Update local mode    setMode(newMode);     // Broadcast to all players if we're DM    if  (hasPermission('control_ui', currentPlayerRoles))  {   syncManager.rpcSetUiMode(newMode);  // Broadcast to all    }  };    // In JSX:  <div className="flex gap-2">    <Button   variant={currentMode ===  'dm'  ?  'default'  :  'outline'}   onClick={()  =>  handleModeChange('dm')}   disabled={lockedByDm}    >    DM  Mode    </Button>    <Button   variant={currentMode ===  'play'  ?  'default'  :  'outline'}   onClick={()  =>  handleModeChange('play')}   disabled={lockedByDm}    >    Play  Mode    </Button>    {lockedByDm &&  <span className="text-xs text-muted-foreground">Locked by DM</span>}  </div>`

### 3.2 Use UI Mode to Control Visibility

File: src/pages/Index.tsx or wherever cards are rendered

`const  { currentMode }  =  useUiModeStore();    // Hide DM-only cards in play mode  const  shouldShowCard  =  (cardType:  CardType)  =>  {    if  (currentMode ===  'play')  {    const dmOnlyCards =  [CardType.FOG,  CardType.REGION_CONTROL,  CardType.ROLE_MANAGER];    return  !dmOnlyCards.includes(cardType);    }    return  true;  };`

* * * * *

Phase 4: Enhance Initiative Sync
--------------------------------

Initiative already has sync, but you can improve it:

### 4.1 Add Full Initiative Sync

File: src/stores/initiativeStore.ts

The store already syncs initiative actions. To ensure full state consistency, verify that handleInitiativeUpdated in syncManager.ts handles all action types:

`private  handleInitiativeUpdated(data:  SyncInitiativePayload):  void  {    const currentUserId = useMultiplayerStore.getState().currentUserId;    if  (data.userId  === currentUserId)  return;     console.log('🎲 Initiative updated from remote:', data.action);     const initiativeStore = useInitiativeStore.getState();     switch  (data.action)  {    case  'start_combat':    // Apply without re-syncing   initiativeStore.setState({   isInCombat:  true,   initiativeOrder: data.data?.initiativeOrder ||  [],   currentTurnIndex: data.data?.currentTurnIndex ||  0,   roundNumber: data.data?.roundNumber ||  1,    });    break;    case  'end_combat':   initiativeStore.setState({   isInCombat:  false,   currentTurnIndex:  0,   roundNumber:  1,   initiativeOrder:  [],    });    break;    case  'set_order':   initiativeStore.setState({   initiativeOrder: data.data?.initiativeOrder ||  []    });    break;    // ... handle other actions    }  }`

CRITICAL: Notice we're calling .setState() directly, NOT the action methods like .startCombat() which would re-trigger sync!

🎯 Best Practices for Avoiding Event Duplication
------------------------------------------------

### 1\. The Golden Rule: "Own Events Don't Echo"

`// ALWAYS check if update is from self  if  (data.userId  === currentUserId)  return;`

### 2\. Separate State Setters from Sync Actions

`// GOOD: Two code paths  addTokenLocal(token)  {    this.addTokenToState(token);   syncManager.syncTokenAdd(token);  }    addTokenFromRemote(token)  {    this.addTokenToState(token);    // No sync!  }    // BAD: One code path used for both  addToken(token, shouldSync =  true)  {    this.addTokenToState(token);    if  (shouldSync) syncManager.syncTokenAdd(token);  }`

### 3\. Use ID Presence as Sync Guard

`// If object has an ID, it came from server (don't re-sync)  if  (!token.id)  {   syncManager.syncTokenAdd(token);  }`

### 4\. Throttle High-Frequency Events

Already implemented for token position:

`// In syncManager initialization:  this.throttledSyncTokenPosition  =  throttle(    (tokenId, x, y)  =>  this.syncTokenPosition(tokenId, x, y),    100  // Max 10 updates/sec  );`

Consider adding for:

-   Region transforms (rotation, scaling)
-   Camera pan/zoom
-   Drawing tools

### 5\. Server Should Be Source of Truth

For critical state (initiative, combat), consider having the server validate and broadcast, rather than clients broadcasting directly.

* * * * *

📋 Implementation Order Recommendation
--------------------------------------

1.  First: Fix token/region sync (Phase 1) - this is critical
2.  Second: Add RPC infrastructure (Phase 2) - foundation for commands
3.  Third: Add UI mode toggle (Phase 3.1) - test RPC system
4.  Fourth: Enhance initiative (Phase 4) - improve existing sync
5.  Last: Add more RPC commands as needed (Phase 3.2+)